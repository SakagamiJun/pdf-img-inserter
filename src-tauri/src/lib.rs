pub mod batch;
pub mod config;
pub mod coord;
pub mod error;
pub mod image;
pub mod logging;
pub mod pdf;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;
use tracing::{error, info, warn};

use crate::config::{AppConfig, PathSerializationMode, TaskConfig};
use crate::error::AppError;
use crate::image::{preview_url, ImageCache, PreviewStore};
use crate::logging::{init_tracing, LogBridge};
use crate::pdf::{
    find_pdf_files, get_page_count, get_text_positions, render_page_preview, PreviewOverlay,
    ProgressEvent,
};

const USER_DOCUMENT_SUBDIR: &str = "PDFImgInserter";
const PAGE_PREVIEW_STORE_CAPACITY: usize = 24;
const OVERLAY_PREVIEW_STORE_CAPACITY: usize = 256;

#[derive(Debug, Clone)]
struct AppPaths {
    config_dir: PathBuf,
    data_dir: PathBuf,
    cache_dir: PathBuf,
    log_dir: PathBuf,
    default_config_path: PathBuf,
    default_input_dir: PathBuf,
    default_output_dir: PathBuf,
}

impl AppPaths {
    fn ensure_directories(&self) -> crate::error::Result<()> {
        for path in [
            &self.config_dir,
            &self.data_dir,
            &self.cache_dir,
            &self.log_dir,
            &self.default_input_dir,
            &self.default_output_dir,
        ] {
            std::fs::create_dir_all(path).map_err(AppError::from)?;
        }

        Ok(())
    }

    fn is_managed_config(&self, path: &std::path::Path) -> bool {
        path == self.default_config_path || path.starts_with(&self.config_dir)
    }

    fn is_managed_path(&self, path: &Path) -> bool {
        path == self.default_config_path
            || path.starts_with(&self.config_dir)
            || path.starts_with(&self.data_dir)
            || path.starts_with(&self.cache_dir)
            || path.starts_with(&self.log_dir)
            || path.starts_with(&self.default_input_dir)
            || path.starts_with(&self.default_output_dir)
    }
}

#[derive(Default)]
struct AllowedPaths {
    files: HashSet<PathBuf>,
    dirs: HashSet<PathBuf>,
}

impl AllowedPaths {
    fn allow_file(&mut self, path: PathBuf) {
        self.files.insert(path);
    }

    fn allow_dir(&mut self, path: PathBuf) {
        self.dirs.insert(path);
    }

    fn allows_exact_path(&self, path: &Path) -> bool {
        self.files.contains(path) || self.dirs.contains(path)
    }

    fn allows_file(&self, path: &Path) -> bool {
        self.files.contains(path) || self.dirs.iter().any(|dir| path.starts_with(dir))
    }

    fn allows_dir(&self, path: &Path) -> bool {
        self.dirs.contains(path) || self.dirs.iter().any(|dir| path.starts_with(dir))
    }
}

fn normalize_access_path(path: &Path) -> crate::error::Result<PathBuf> {
    fn normalize_existing_or_parent(path: &Path) -> crate::error::Result<PathBuf> {
        if path.exists() {
            return path.canonicalize().map_err(AppError::from);
        }

        let parent = path
            .parent()
            .ok_or_else(|| AppError::InvalidPath(format!("路径无法归一化: {}", path.display())))?;
        let normalized_parent = normalize_existing_or_parent(parent)?;

        match path.file_name() {
            Some(file_name) => Ok(normalized_parent.join(file_name)),
            None => Ok(normalized_parent),
        }
    }

    if path.as_os_str().is_empty() {
        return Err(AppError::InvalidPath("路径不能为空".into()));
    }

    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().map_err(AppError::from)?.join(path)
    };

    normalize_existing_or_parent(&absolute)
}

pub(crate) fn runtime_project_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        extend_runtime_project_roots(&mut roots, &current_dir);
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            extend_runtime_project_roots(&mut roots, parent);
        }
    }

    roots
}

fn extend_runtime_project_roots(roots: &mut Vec<PathBuf>, start: &Path) {
    for ancestor in start.ancestors().take(7) {
        if !looks_like_runtime_project_root(ancestor) {
            continue;
        }

        let candidate = ancestor.to_path_buf();
        if !roots.contains(&candidate) {
            roots.push(candidate);
        }
    }
}

fn looks_like_runtime_project_root(path: &Path) -> bool {
    path.join("tauri.conf.json").exists()
        || path.join("src-tauri").join("tauri.conf.json").exists()
        || path.join("Cargo.toml").exists()
        || path.join("package.json").exists()
        || path.join(".git").exists()
}

pub struct AppState {
    image_cache: ImageCache,
    page_preview_store: PreviewStore,
    overlay_preview_store: PreviewStore,
    pdfium_resource_dir: RwLock<Option<PathBuf>>,
    pdfium_lib_path: RwLock<Option<PathBuf>>,
    allowed_paths: RwLock<AllowedPaths>,
    app_paths: RwLock<Option<AppPaths>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            image_cache: ImageCache::default(),
            page_preview_store: PreviewStore::new(PAGE_PREVIEW_STORE_CAPACITY, "page-preview"),
            overlay_preview_store: PreviewStore::new(
                OVERLAY_PREVIEW_STORE_CAPACITY,
                "overlay-preview",
            ),
            pdfium_resource_dir: RwLock::new(None),
            pdfium_lib_path: RwLock::new(None),
            allowed_paths: RwLock::new(AllowedPaths::default()),
            app_paths: RwLock::new(None),
        }
    }
}

impl AppState {
    fn set_pdfium_resource_dir(&self, path: Option<PathBuf>) {
        *self.pdfium_resource_dir.write() = path;
    }

    fn pdfium_resource_dir(&self) -> Option<PathBuf> {
        self.pdfium_resource_dir.read().clone()
    }

    fn set_pdfium_lib_path(&self, path: PathBuf) {
        *self.pdfium_lib_path.write() = Some(path);
    }

    fn pdfium_lib_path(&self) -> Option<PathBuf> {
        self.pdfium_lib_path.read().clone()
    }

    fn set_app_paths(&self, paths: AppPaths) {
        *self.app_paths.write() = Some(paths);
    }

    fn app_paths(&self) -> crate::error::Result<AppPaths> {
        self.app_paths
            .read()
            .clone()
            .ok_or_else(|| AppError::Config("应用目录尚未初始化".into()))
    }

    fn create_pdfium(&self) -> crate::error::Result<pdfium_render::prelude::Pdfium> {
        if let Some(lib_path) = self.pdfium_lib_path() {
            return pdfium_render::prelude::Pdfium::bind_to_library(&lib_path)
                .map(pdfium_render::prelude::Pdfium::new)
                .map_err(|e| AppError::PdfiumInit(e.to_string()));
        }

        let resource_dir = self.pdfium_resource_dir();
        let (pdfium, lib_path) = crate::pdf::create_pdfium_with_path(resource_dir.as_deref())?;
        self.set_pdfium_lib_path(lib_path);
        Ok(pdfium)
    }

    fn allow_managed_paths(&self, paths: &AppPaths) -> crate::error::Result<()> {
        let mut access = self.allowed_paths.write();

        for dir in [
            &paths.config_dir,
            &paths.data_dir,
            &paths.cache_dir,
            &paths.log_dir,
            &paths.default_input_dir,
            &paths.default_output_dir,
        ] {
            access.allow_dir(normalize_access_path(dir)?);
        }

        access.allow_file(normalize_access_path(&paths.default_config_path)?);

        Ok(())
    }

    fn register_allowed_file(&self, path: &Path) -> crate::error::Result<PathBuf> {
        let normalized = normalize_access_path(path)?;
        self.allowed_paths.write().allow_file(normalized.clone());
        Ok(normalized)
    }

    fn register_allowed_dir(&self, path: &Path) -> crate::error::Result<PathBuf> {
        let normalized = normalize_access_path(path)?;
        self.allowed_paths.write().allow_dir(normalized.clone());
        Ok(normalized)
    }

    fn allow_loaded_config(&self, config: &AppConfig) -> crate::error::Result<()> {
        self.register_allowed_dir(&config.global.input_folder)?;
        self.register_allowed_dir(&config.global.output_folder)?;

        for task in &config.tasks {
            if !task.image_path.as_os_str().is_empty() {
                self.register_allowed_file(&task.image_path)?;
            }
        }

        Ok(())
    }

    fn ensure_allowed_exact_path(&self, path: &Path, label: &str) -> crate::error::Result<PathBuf> {
        let normalized = normalize_access_path(path)?;
        let app_paths = self.app_paths()?;

        if app_paths.is_managed_path(&normalized)
            || self.allowed_paths.read().allows_exact_path(&normalized)
        {
            Ok(normalized)
        } else {
            Err(AppError::InvalidPath(format!(
                "{label} 未通过授权，请通过应用内选择器重新选择: {}",
                path.display()
            )))
        }
    }

    fn ensure_allowed_existing_file(
        &self,
        path: &Path,
        label: &str,
    ) -> crate::error::Result<PathBuf> {
        let normalized = normalize_access_path(path)?;
        let app_paths = self.app_paths()?;

        if !app_paths.is_managed_path(&normalized)
            && !self.allowed_paths.read().allows_file(&normalized)
        {
            return Err(AppError::InvalidPath(format!(
                "{label} 未通过授权，请通过应用内选择器重新选择: {}",
                path.display()
            )));
        }

        if !normalized.exists() || !normalized.is_file() {
            return Err(AppError::InvalidPath(format!(
                "{label} 不存在或不是文件: {}",
                path.display()
            )));
        }

        Ok(normalized)
    }

    fn ensure_allowed_existing_dir(
        &self,
        path: &Path,
        label: &str,
    ) -> crate::error::Result<PathBuf> {
        let normalized = normalize_access_path(path)?;
        let app_paths = self.app_paths()?;

        if !app_paths.is_managed_path(&normalized)
            && !self.allowed_paths.read().allows_dir(&normalized)
        {
            return Err(AppError::InvalidPath(format!(
                "{label} 未通过授权，请通过应用内选择器重新选择: {}",
                path.display()
            )));
        }

        if !normalized.exists() || !normalized.is_dir() {
            return Err(AppError::InvalidPath(format!(
                "{label} 不存在或不是文件夹: {}",
                path.display()
            )));
        }

        Ok(normalized)
    }

    fn ensure_allowed_dir_path(&self, path: &Path, label: &str) -> crate::error::Result<PathBuf> {
        let normalized = normalize_access_path(path)?;
        let app_paths = self.app_paths()?;

        if !app_paths.is_managed_path(&normalized)
            && !self.allowed_paths.read().allows_dir(&normalized)
        {
            return Err(AppError::InvalidPath(format!(
                "{label} 未通过授权，请通过应用内选择器重新选择: {}",
                path.display()
            )));
        }

        if normalized.exists() && !normalized.is_dir() {
            return Err(AppError::InvalidPath(format!(
                "{label} 不是文件夹: {}",
                path.display()
            )));
        }

        Ok(normalized)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewResponse {
    image_url: String,
    pixel_width: u32,
    pixel_height: u32,
    page_width_points: f32,
    page_height_points: f32,
    overlays: Vec<PreviewOverlay>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DialogFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(Debug)]
enum BatchWorkerEvent {
    Started {
        filename: String,
        index: usize,
    },
    Finished {
        filename: String,
        result: Result<batch::BatchWorkerResponse, String>,
    },
}

pub(crate) fn validate_runtime_task_fields(task: &TaskConfig) -> crate::error::Result<()> {
    if task.name.trim().is_empty() {
        return Err(AppError::Config("任务名称不能为空".into()));
    }
    if task.search_text.trim().is_empty() {
        return Err(AppError::Config("搜索文本不能为空".into()));
    }
    if task.image_path.as_os_str().is_empty() {
        return Err(AppError::Config("图片路径不能为空".into()));
    }
    if task.target_height_points < 0.0 || !task.target_height_points.is_finite() {
        return Err(AppError::Config(
            "目标高度必须是大于等于 0 的有限数值".into(),
        ));
    }
    if task.target_height_points > crate::config::MAX_TARGET_HEIGHT_POINTS {
        return Err(AppError::Config(format!(
            "目标高度过大 (最大允许 {} points): {}",
            crate::config::MAX_TARGET_HEIGHT_POINTS,
            task.target_height_points
        )));
    }
    if task.random_offset_x > 10_000 || task.random_offset_y > 10_000 {
        return Err(AppError::Config(
            "随机偏移过大，请检查单位是否为 PDF points".into(),
        ));
    }

    Ok(())
}

fn validate_runtime_task(task: &TaskConfig, state: &AppState) -> crate::error::Result<()> {
    validate_runtime_task_fields(task)?;
    state.ensure_allowed_existing_file(&task.image_path, &format!("任务图片 ({})", task.name))?;
    Ok(())
}

fn validate_config_access(config: &AppConfig, state: &AppState) -> crate::error::Result<()> {
    state.ensure_allowed_existing_dir(&config.global.input_folder, "输入目录")?;
    state.ensure_allowed_dir_path(&config.global.output_folder, "输出目录")?;

    for task in &config.tasks {
        validate_runtime_task(task, state)?;
    }

    Ok(())
}

fn apply_dialog_filters<R: tauri::Runtime>(
    mut dialog: tauri_plugin_dialog::FileDialogBuilder<R>,
    filters: &[DialogFilter],
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    for filter in filters {
        let extensions = filter
            .extensions
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
        dialog = dialog.add_filter(filter.name.clone(), &extensions);
    }

    dialog
}

pub(crate) fn ensure_distinct_output(
    input: &std::path::Path,
    output: &std::path::Path,
) -> crate::error::Result<()> {
    let input = input
        .canonicalize()
        .map_err(|e| AppError::InvalidPath(format!("解析输入路径失败: {e}")))?;
    let output = output
        .canonicalize()
        .or_else(|_| Ok(output.to_path_buf()))
        .map_err(|e: std::io::Error| AppError::InvalidPath(format!("解析输出路径失败: {e}")))?;

    if input == output {
        return Err(AppError::Config("输出文件不能覆盖输入文件".into()));
    }

    Ok(())
}

fn register_selected_file_path(
    file: tauri_plugin_dialog::FilePath,
    state: &AppState,
) -> Result<String, String> {
    let path = file
        .into_path()
        .map_err(|_| "所选文件无法转换为本地文件系统路径".to_string())?;
    let normalized = state
        .register_allowed_file(&path)
        .map_err(|error| error.to_string())?;

    Ok(normalized.to_string_lossy().to_string())
}

fn register_selected_folder_path(
    folder: tauri_plugin_dialog::FilePath,
    state: &AppState,
) -> Result<String, String> {
    let path = folder
        .into_path()
        .map_err(|_| "所选文件夹无法转换为本地文件系统路径".to_string())?;
    let normalized = state
        .register_allowed_dir(&path)
        .map_err(|error| error.to_string())?;

    Ok(normalized.to_string_lossy().to_string())
}

#[tauri::command]
async fn pick_file_path(
    title: String,
    filters: Option<Vec<DialogFilter>>,
    state: tauri::State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let state = Arc::clone(state.inner());
    let (tx, rx) = oneshot::channel();
    let dialog = apply_dialog_filters(
        app.dialog().file().set_title(title),
        filters.as_deref().unwrap_or(&[]),
    );

    dialog.pick_file(move |file| {
        let result = file
            .map(|file| register_selected_file_path(file, state.as_ref()))
            .transpose();
        let _ = tx.send(result);
    });

    rx.await
        .map_err(|_| "文件选择对话框未返回结果".to_string())?
}

#[tauri::command]
async fn pick_folder_path(
    title: String,
    state: tauri::State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        let state = Arc::clone(state.inner());
        let (tx, rx) = oneshot::channel();

        app.dialog()
            .file()
            .set_title(title)
            .pick_folder(move |folder| {
                let result = folder
                    .map(|folder| register_selected_folder_path(folder, state.as_ref()))
                    .transpose();
                let _ = tx.send(result);
            });

        rx.await
            .map_err(|_| "文件夹选择对话框未返回结果".to_string())?
    }

    #[cfg(not(desktop))]
    {
        let _ = (title, state, app);
        Err("当前平台不支持文件夹选择".into())
    }
}

#[tauri::command]
fn load_config(path: String, state: tauri::State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
    let config_path = state
        .ensure_allowed_exact_path(Path::new(&path), "配置文件")
        .map_err(|error| error.to_string())?;

    let config = config::load_config(&config_path).map_err(|error| error.to_string())?;
    state
        .allow_loaded_config(&config)
        .map_err(|error| error.to_string())?;

    Ok(config)
}

#[tauri::command]
fn save_config(
    path: String,
    config: AppConfig,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let config_path = state
        .ensure_allowed_exact_path(Path::new(&path), "配置文件")
        .map_err(|error| error.to_string())?;
    let app_paths = state.app_paths().map_err(|error| error.to_string())?;
    validate_config_access(&config, state.inner()).map_err(|error| error.to_string())?;

    let serialization_mode = if app_paths.is_managed_config(&config_path) {
        PathSerializationMode::Absolute
    } else {
        PathSerializationMode::Portable
    };

    config::save_config(&config_path, &config, serialization_mode)
        .and_then(|_| state.allow_loaded_config(&config))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_default_config_path(state: tauri::State<'_, Arc<AppState>>) -> Result<String, String> {
    state
        .app_paths()
        .map(|paths| paths.default_config_path.to_string_lossy().to_string())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_default_config(
    path: String,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let config_path = state
        .ensure_allowed_exact_path(Path::new(&path), "配置文件")
        .map_err(|error| error.to_string())?;
    let app_paths = state.app_paths().map_err(|error| error.to_string())?;

    if app_paths.is_managed_config(&config_path) {
        migrate_legacy_default_config(&config_path, &app_paths)
            .map_err(|error| error.to_string())?;

        if config_path.exists() {
            if config::load_config(&config_path).is_ok() {
                return Ok(());
            }

            let backup_path =
                broken_config_backup_path(&config_path).map_err(|error| error.to_string())?;
            std::fs::rename(&config_path, &backup_path).map_err(|error| {
                format!(
                    "默认配置已损坏，且无法备份到 {}: {}",
                    backup_path.display(),
                    error
                )
            })?;
            warn!(
                original = %config_path.display(),
                backup = %backup_path.display(),
                "默认配置无效，已备份并将重建"
            );
        }

        return config::create_default_config(
            &config_path,
            &app_paths.default_input_dir,
            &app_paths.default_output_dir,
            PathSerializationMode::Absolute,
        )
        .map_err(|error| error.to_string());
    }

    let base_dir = config_path
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    config::create_default_config(
        &config_path,
        &base_dir.join("input_pdfs"),
        &base_dir.join("output_pdfs"),
        PathSerializationMode::Portable,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_page_count_cmd(path: String, state: tauri::State<'_, Arc<AppState>>) -> Result<u16, String> {
    let pdf_path = state
        .ensure_allowed_existing_file(Path::new(&path), "PDF 文件")
        .map_err(|error| error.to_string())?;
    let pdfium = state.create_pdfium().map_err(|error| error.to_string())?;

    get_page_count(&pdfium, &pdf_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn search_text_in_pdf(
    path: String,
    page: u16,
    text: String,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<Vec<coord::TextPosition>, String> {
    let pdf_path = state
        .ensure_allowed_existing_file(Path::new(&path), "PDF 文件")
        .map_err(|error| error.to_string())?;
    let pdfium = state.create_pdfium().map_err(|error| error.to_string())?;

    get_text_positions(&pdfium, &pdf_path, page, &text).map_err(|error| error.to_string())
}

#[tauri::command]
async fn process_files(
    input_folder: String,
    output_folder: String,
    tasks: Vec<TaskConfig>,
    preview_file: Option<String>,
    state: tauri::State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let state = Arc::clone(state.inner());
    let input_path = state
        .ensure_allowed_existing_dir(Path::new(&input_folder), "输入目录")
        .map_err(|error| error.to_string())?;
    let output_path = state
        .ensure_allowed_dir_path(Path::new(&output_folder), "输出目录")
        .map_err(|error| error.to_string())?;
    let preview_file = preview_file
        .as_deref()
        .map(|path| state.ensure_allowed_existing_file(Path::new(path), "预览 PDF"))
        .transpose()
        .map_err(|error| error.to_string())?
        .map(|path| path.to_string_lossy().to_string());

    for task in &tasks {
        validate_runtime_task(task, &state).map_err(|e| e.to_string())?;
    }

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        std::fs::create_dir_all(&output_path).map_err(|error| error.to_string())?;

        let pdf_files = resolve_processing_targets(&input_path, preview_file.as_deref())
            .map_err(|error| error.to_string())?;

        for input_file in &pdf_files {
            let filename = input_file
                .file_name()
                .ok_or_else(|| "输入文件名无效".to_string())?;
            let output_file = output_path.join(filename);
            ensure_distinct_output(input_file, &output_file).map_err(|e| e.to_string())?;
        }

        let total = pdf_files.len();

        let _ = app.emit("progress", ProgressEvent::BatchStarted { total });

        if total == 0 {
            let _ = app.emit(
                "log",
                logging::LogEvent {
                    timestamp_ms: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    level: "WARN".to_string(),
                    target: "batch".to_string(),
                    message: "没有找到可处理的 PDF 文件。".to_string(),
                    fields: Default::default(),
                },
            );
            let _ = app.emit(
                "progress",
                ProgressEvent::AllCompleted {
                    success: 0,
                    failed: 0,
                },
            );
            return Ok(());
        }

        info!(
            input = %input_path.display(),
            output = %output_path.display(),
            file_count = total,
            task_count = tasks.len(),
            "开始批量处理 PDF"
        );

        let executable_path = std::env::current_exe().map_err(|error| error.to_string())?;
        let worker_count = batch::current_worker_count(total);
        let success_count = AtomicU32::new(0);
        let failed_count = AtomicU32::new(0);
        let completed_count = AtomicUsize::new(0);
        let next_index = AtomicUsize::new(0);
        let tasks = Arc::new(tasks);
        let pdf_files = Arc::new(pdf_files);
        let output_path = Arc::new(output_path);
        let pdfium_resource_dir = state.pdfium_resource_dir();
        let (tx, rx) = mpsc::channel::<BatchWorkerEvent>();

        let _ = app.emit(
            "log",
            logging::LogEvent {
                timestamp_ms: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                level: "INFO".to_string(),
                target: "batch".to_string(),
                message: format!("已启用 {worker_count} 个批处理子进程"),
                fields: Default::default(),
            },
        );

        std::thread::scope(|scope| {
            for _ in 0..worker_count {
                let tx = tx.clone();
                let executable_path = executable_path.clone();
                let tasks = Arc::clone(&tasks);
                let pdf_files = Arc::clone(&pdf_files);
                let output_path = Arc::clone(&output_path);
                let pdfium_resource_dir = pdfium_resource_dir.clone();
                let next_index = &next_index;

                scope.spawn(move || loop {
                    let index = next_index.fetch_add(1, Ordering::Relaxed);
                    if index >= pdf_files.len() {
                        break;
                    }

                    let input_file = pdf_files[index].clone();
                    let filename = input_file
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_else(|| format!("file-{}", index + 1));
                    let output_file = output_path.join(
                        input_file
                            .file_name()
                            .map(PathBuf::from)
                            .unwrap_or_else(|| PathBuf::from(&filename)),
                    );

                    let _ = tx.send(BatchWorkerEvent::Started {
                        filename: filename.clone(),
                        index,
                    });

                    let result = batch::run_worker_process(
                        &executable_path,
                        &input_file,
                        &output_file,
                        tasks.as_slice(),
                        pdfium_resource_dir.as_deref(),
                    )
                    .map_err(|error| error.to_string());

                    let _ = tx.send(BatchWorkerEvent::Finished { filename, result });
                });
            }

            drop(tx);

            for event in rx {
                match event {
                    BatchWorkerEvent::Started { filename, index } => {
                        let _ = app.emit(
                            "progress",
                            ProgressEvent::FileStarted {
                                filename,
                                index,
                                total,
                            },
                        );
                    }
                    BatchWorkerEvent::Finished { filename, result } => {
                        let completed = completed_count.fetch_add(1, Ordering::Relaxed) + 1;

                        match result {
                            Ok(processed) => {
                                success_count.fetch_add(1, Ordering::Relaxed);
                                let _ = app.emit(
                                    "progress",
                                    ProgressEvent::FileCompleted {
                                        filename,
                                        insertions: processed.insertions,
                                        completed,
                                        total,
                                    },
                                );
                            }
                            Err(process_error) => {
                                failed_count.fetch_add(1, Ordering::Relaxed);
                                error!(error = %process_error, file = %filename, "PDF 处理失败");
                                let _ = app.emit(
                                    "progress",
                                    ProgressEvent::FileError {
                                        filename,
                                        error: process_error,
                                        completed,
                                        total,
                                    },
                                );
                            }
                        }
                    }
                }
            }
        });

        let _ = app.emit(
            "progress",
            ProgressEvent::AllCompleted {
                success: success_count.load(Ordering::Relaxed),
                failed: failed_count.load(Ordering::Relaxed),
            },
        );

        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn render_preview(
    path: String,
    page: u16,
    tasks: Vec<TaskConfig>,
    selected_task_name: Option<String>,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<PreviewResponse, String> {
    let state = Arc::clone(state.inner());
    let pdf_path = state
        .ensure_allowed_existing_file(Path::new(&path), "预览 PDF")
        .map_err(|error| error.to_string())?;

    for task in &tasks {
        validate_runtime_task(task, &state).map_err(|e| e.to_string())?;
    }

    tokio::task::spawn_blocking(move || {
        let pdfium = state.create_pdfium()?;
        let rendered = render_page_preview(
            &pdfium,
            &pdf_path,
            page,
            &tasks,
            selected_task_name.as_deref(),
            &state.image_cache,
            &state.overlay_preview_store,
        )?;
        let image_bytes = rendered.png_bytes;
        let token = state.page_preview_store.insert_png(image_bytes);

        Ok::<PreviewResponse, crate::error::AppError>(PreviewResponse {
            image_url: preview_url(&token),
            pixel_width: rendered.pixel_width,
            pixel_height: rendered.pixel_height,
            page_width_points: rendered.page_width_points,
            page_height_points: rendered.page_height_points,
            overlays: rendered.overlays,
        })
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState::default());
    let log_bridge = Arc::new(LogBridge::default());
    init_tracing(Arc::clone(&log_bridge));

    tauri::Builder::default()
        .register_uri_scheme_protocol("preview", {
            let state = Arc::clone(&state);
            move |_context, request| {
                let token = request
                    .uri()
                    .path()
                    .trim_start_matches('/')
                    .trim_end_matches(".png");

                match state
                    .page_preview_store
                    .get(token)
                    .or_else(|| state.overlay_preview_store.get(token))
                {
                    Some(asset) => tauri::http::Response::builder()
                        .status(200)
                        .header("Content-Type", asset.mime_type)
                        .header("Cache-Control", "no-store")
                        .body((*asset.bytes).clone())
                        .unwrap(),
                    None => tauri::http::Response::builder()
                        .status(404)
                        .header("Content-Type", "text/plain; charset=utf-8")
                        .body(format!("preview asset not found: {token}").into_bytes())
                        .unwrap(),
                }
            }
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup({
            let state = Arc::clone(&state);
            let log_bridge = Arc::clone(&log_bridge);
            move |app| {
                let app_paths = resolve_app_paths(&app.handle())?;
                app_paths.ensure_directories()?;

                let pdfium_resource_dir =
                    match app.path().resolve("pdfium", tauri::path::BaseDirectory::Resource) {
                        Ok(path) => {
                            info!(path = %path.display(), "已解析 Pdfium 资源目录");
                            Some(path)
                        }
                        Err(error) => {
                            warn!(error = %error, "未能解析 Pdfium 资源目录，将继续使用 vendor/env 回退");
                            None
                        }
                    };

                info!(
                    config = %app_paths.default_config_path.display(),
                    input = %app_paths.default_input_dir.display(),
                    output = %app_paths.default_output_dir.display(),
                    "应用目录初始化完成"
                );

                state.set_pdfium_resource_dir(pdfium_resource_dir);
                state.set_app_paths(app_paths);
                state.allow_managed_paths(&state.app_paths()?)?;
                log_bridge.set_app_handle(app.handle().clone());
                info!("应用初始化完成");
                Ok(())
            }
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            pick_file_path,
            pick_folder_path,
            load_config,
            save_config,
            get_default_config_path,
            create_default_config,
            get_page_count_cmd,
            search_text_in_pdf,
            process_files,
            render_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn broken_config_backup_path(path: &std::path::Path) -> crate::error::Result<PathBuf> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| AppError::Config(format!("默认配置路径无效: {}", path.display())))?;

    Ok(path.with_file_name(format!("{file_name}.broken-{timestamp}.bak")))
}

fn resolve_app_paths(app: &tauri::AppHandle) -> crate::error::Result<AppPaths> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| AppError::Config(format!("解析应用配置目录失败: {error}")))?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Config(format!("解析应用数据目录失败: {error}")))?;
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| AppError::Config(format!("解析应用缓存目录失败: {error}")))?;
    let log_dir = app
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| data_dir.join("logs"));
    let user_documents_root = app
        .path()
        .document_dir()
        .or_else(|_| app.path().download_dir())
        .or_else(|_| app.path().home_dir())
        .map_err(|error| AppError::Config(format!("解析用户文档目录失败: {error}")))?;
    let user_workspace_dir = user_documents_root.join(USER_DOCUMENT_SUBDIR);

    Ok(AppPaths {
        default_config_path: config_dir.join("config.toml"),
        default_input_dir: user_workspace_dir.join("input"),
        default_output_dir: user_workspace_dir.join("exports"),
        config_dir,
        data_dir,
        cache_dir,
        log_dir,
    })
}

fn migrate_legacy_default_config(
    target_path: &std::path::Path,
    app_paths: &AppPaths,
) -> crate::error::Result<()> {
    if target_path.exists() {
        return Ok(());
    }

    for candidate in legacy_default_config_candidates() {
        if candidate == target_path
            || !candidate.exists()
            || app_paths.is_managed_config(&candidate)
        {
            continue;
        }

        match config::load_config(&candidate).and_then(|mut cfg| {
            config::normalize_legacy_managed_paths(
                &mut cfg,
                &candidate,
                &app_paths.default_input_dir,
                &app_paths.default_output_dir,
            );
            config::save_config(target_path, &cfg, PathSerializationMode::Absolute)
        }) {
            Ok(()) => {
                info!(
                    from = %candidate.display(),
                    to = %target_path.display(),
                    "已迁移旧版默认配置到应用目录"
                );
                return Ok(());
            }
            Err(error) => {
                warn!(
                    from = %candidate.display(),
                    error = %error,
                    "旧版默认配置迁移失败，将继续创建新的默认配置"
                );
            }
        }
    }

    Ok(())
}

fn legacy_default_config_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("config.toml"));
    }

    for root in runtime_project_roots() {
        candidates.push(root.join("config.toml"));
        candidates.push(root.join("src-tauri").join("config.toml"));
    }

    let mut unique = Vec::new();
    for candidate in candidates {
        if !unique.contains(&candidate) {
            unique.push(candidate);
        }
    }

    unique
}

fn resolve_processing_targets(
    input_folder: &std::path::Path,
    preview_file: Option<&str>,
) -> crate::error::Result<Vec<PathBuf>> {
    if input_folder.exists() && input_folder.is_dir() {
        let files = find_pdf_files(input_folder)?;
        if !files.is_empty() {
            return Ok(files);
        }
    }

    if let Some(preview_file) = preview_file {
        let preview_path = PathBuf::from(preview_file);
        let is_pdf = preview_path
            .extension()
            .map(|ext| ext.eq_ignore_ascii_case("pdf"))
            .unwrap_or(false);

        if preview_path.exists() && preview_path.is_file() && is_pdf {
            info!(file = %preview_path.display(), "输入目录为空，回退为处理当前预览 PDF");
            return Ok(vec![preview_path]);
        }
    }

    if !input_folder.exists() {
        return Err(crate::error::AppError::InvalidPath(format!(
            "输入目录不存在，且未选择可回退处理的预览 PDF: {}",
            input_folder.display()
        )));
    }

    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_root(prefix: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "pdf-img-inserter-lib-{prefix}-{}-{}",
            std::process::id(),
            unique_suffix()
        ));
        std::fs::create_dir_all(&root).expect("temp root should be created");
        root
    }

    fn unique_suffix() -> u64 {
        let ticks = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64;
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        ticks ^ counter
    }

    fn test_app_paths(root: &Path) -> AppPaths {
        AppPaths {
            config_dir: root.join("app/config"),
            data_dir: root.join("app/data"),
            cache_dir: root.join("app/cache"),
            log_dir: root.join("app/logs"),
            default_config_path: root.join("app/config/config.toml"),
            default_input_dir: root.join("Documents/PDFImgInserter/input"),
            default_output_dir: root.join("Documents/PDFImgInserter/exports"),
        }
    }

    #[test]
    fn broken_config_backup_path_preserves_parent_and_marks_file() {
        let root = temp_root("backup-path");
        let path = root.join("config.toml");
        let backup = broken_config_backup_path(&path).expect("backup path should be generated");

        assert_eq!(backup.parent(), path.parent());
        assert!(backup
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .starts_with("config.toml.broken-"));
        assert!(backup
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .ends_with(".bak"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn selected_folder_only_grants_access_to_descendant_files() {
        let root = temp_root("allowed-paths");
        let selected_dir = root.join("picked/input");
        let selected_pdf = selected_dir.join("invoice.pdf");
        let rejected_pdf = root.join("outside/secret.pdf");
        let app_paths = test_app_paths(&root);

        std::fs::create_dir_all(&selected_dir).expect("selected dir should exist");
        std::fs::create_dir_all(rejected_pdf.parent().expect("parent should exist"))
            .expect("outside dir should exist");
        std::fs::write(&selected_pdf, b"pdf").expect("selected pdf should exist");
        std::fs::write(&rejected_pdf, b"pdf").expect("outside pdf should exist");
        app_paths
            .ensure_directories()
            .expect("managed app paths should exist");

        let state = AppState::default();
        state.set_app_paths(app_paths.clone());
        state
            .allow_managed_paths(&app_paths)
            .expect("managed paths should be authorized");
        state
            .register_allowed_dir(&selected_dir)
            .expect("selected dir should be authorized");

        assert!(state
            .ensure_allowed_existing_file(&selected_pdf, "PDF 文件")
            .is_ok());
        assert!(state
            .ensure_allowed_existing_file(&rejected_pdf, "PDF 文件")
            .is_err());

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn overlay_preview_store_retains_large_task_batch() {
        let state = AppState::default();
        let first = state.overlay_preview_store.insert_png(vec![1]);

        for value in 0..64u8 {
            state.overlay_preview_store.insert_png(vec![value]);
        }

        assert!(state.overlay_preview_store.get(&first).is_some());
        assert!(state.page_preview_store.get(&first).is_none());
    }

    #[test]
    fn preview_stores_use_distinct_token_namespaces() {
        let state = AppState::default();
        let page_token = state.page_preview_store.insert_png(vec![1]);
        let overlay_token = state.overlay_preview_store.insert_png(vec![2]);

        assert_ne!(page_token, overlay_token);
        assert!(page_token.starts_with("page-preview-"));
        assert!(overlay_token.starts_with("overlay-preview-"));
    }

    #[test]
    fn tauri_security_config_keeps_preview_origin_and_scoped_assets() {
        let config_path = runtime_project_roots()
            .into_iter()
            .flat_map(|root| {
                [
                    root.join("tauri.conf.json"),
                    root.join("src-tauri/tauri.conf.json"),
                ]
            })
            .find(|path| path.exists())
            .expect("tauri.conf.json should be discoverable from runtime project roots");
        let config = std::fs::read_to_string(&config_path).expect("tauri.conf.json should exist");
        let json: serde_json::Value =
            serde_json::from_str(&config).expect("tauri.conf.json should be valid json");

        let csp = json["app"]["security"]["csp"]
            .as_str()
            .expect("csp should be configured");
        assert!(
            csp.contains("img-src")
                && csp.contains("preview:")
                && csp.contains("http://preview.localhost"),
            "csp should allow packaged preview images on all supported platforms"
        );

        let scopes = json["app"]["security"]["assetProtocol"]["scope"]
            .as_array()
            .expect("assetProtocol.scope should be an array");
        let actual_scopes = scopes
            .iter()
            .map(|value| value.as_str().expect("scope entries should be strings"))
            .collect::<Vec<_>>();

        assert_eq!(
            actual_scopes,
            vec![
                "$APPCONFIG/**",
                "$APPDATA/**",
                "$APPCACHE/**",
                "$APPLOG/**",
                "$RESOURCE/**",
            ]
        );
    }
}
