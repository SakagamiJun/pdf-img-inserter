use std::collections::{hash_map::DefaultHasher, HashSet};
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};

use anyhow::Context;
use image::ImageFormat;
use pdfium_render::prelude::*;
use rand::RngExt;
use serde::Serialize;
use tracing::{debug, info, warn};

use crate::config::TaskConfig;
use crate::coord::{CoordTransform, PdfPlacementRect, RelativeRect, TextPosition};
use crate::error::{AppError, Result};
use crate::image::{ImageCache, PreparedImage};

const PREVIEW_TARGET_WIDTH: i32 = 1600;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResult {
    pub success: bool,
    pub insertions: u32,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ProgressEvent {
    BatchStarted {
        total: usize,
    },
    FileStarted {
        filename: String,
        index: usize,
        total: usize,
    },
    FileCompleted {
        filename: String,
        insertions: u32,
        completed: usize,
        total: usize,
    },
    FileError {
        filename: String,
        error: String,
        completed: usize,
        total: usize,
    },
    AllCompleted {
        success: u32,
        failed: u32,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewOverlay {
    pub task_name: String,
    pub match_rect: RelativeRect,
    pub image_rect: RelativeRect,
    pub image_url: String,
    pub selected: bool,
    pub randomized: bool,
}

#[derive(Debug)]
pub struct RenderedPreview {
    pub png_bytes: Vec<u8>,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub page_width_points: f32,
    pub page_height_points: f32,
    pub overlays: Vec<PreviewOverlay>,
}

pub fn create_pdfium_with_path(resource_dir: Option<&Path>) -> Result<(Pdfium, PathBuf)> {
    let library_name = Pdfium::pdfium_platform_library_name();
    let mut searched_paths = Vec::new();
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    let mut load_failures = Vec::new();

    if let Ok(path) = std::env::var("PDFIUM_DYNAMIC_LIB_PATH") {
        push_library_candidate(&mut candidates, PathBuf::from(path), &library_name);
    }

    if let Some(resource_dir) = resource_dir {
        candidates.push(resource_dir.join(&library_name));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join(&library_name));
            candidates.push(parent.join("pdfium").join(&library_name));
            candidates.push(parent.join("resources").join("pdfium").join(&library_name));

            #[cfg(target_os = "macos")]
            if let Some(contents_dir) = parent.parent() {
                candidates.push(
                    contents_dir
                        .join("Resources")
                        .join("pdfium")
                        .join(&library_name),
                );
            }
        }
    }

    for root in crate::runtime_project_roots() {
        candidates.push(root.join("resources/pdfium").join(&library_name));
        candidates.push(root.join("vendor/pdfium").join(&library_name));
        candidates.push(root.join("src-tauri/resources/pdfium").join(&library_name));
        candidates.push(root.join("src-tauri/vendor/pdfium").join(&library_name));
        candidates.push(root.join(&library_name));
    }
    candidates.push(Pdfium::pdfium_platform_library_name_at_path("./"));

    for candidate in candidates {
        if !seen.insert(candidate.clone()) {
            continue;
        }

        searched_paths.push(candidate.display().to_string());

        if candidate.exists() {
            match Pdfium::bind_to_library(&candidate) {
                Ok(bindings) => {
                    info!(path = %candidate.display(), "已加载 Pdfium 动态库");
                    return Ok((Pdfium::new(bindings), candidate));
                }
                Err(error) => load_failures.push(format!("{} ({error})", candidate.display())),
            }
        }
    }

    match Pdfium::bind_to_system_library() {
        Ok(bindings) => {
            info!("已通过系统动态库加载 Pdfium");
            Ok((Pdfium::new(bindings), PathBuf::from(library_name)))
        }
        Err(error) => {
            let mut message = format!(
                "{}。未找到可加载的 Pdfium 动态库 {}。",
                error,
                library_name.to_string_lossy()
            );

            if !load_failures.is_empty() {
                message.push_str(&format!(
                    " 已发现候选库但加载失败: {}。",
                    load_failures.join("；")
                ));
            }

            if !searched_paths.is_empty() {
                message.push_str(&format!(" 已检查路径: {}。", searched_paths.join(", ")));
            }

            message.push_str(
                " 开发环境可把库放到 src-tauri/vendor/pdfium/ 或 src-tauri/resources/pdfium/，也可以设置 PDFIUM_DYNAMIC_LIB_PATH。",
            );

            Err(AppError::PdfiumInit(message))
        }
    }
}

fn push_library_candidate(
    candidates: &mut Vec<PathBuf>,
    path: PathBuf,
    library_name: &std::ffi::OsStr,
) {
    let is_exact_library = path
        .file_name()
        .map(|filename| filename == library_name)
        .unwrap_or(false);

    if is_exact_library {
        candidates.push(path);
    } else {
        candidates.push(path.join(library_name));
    }
}

pub fn process_pdf_file(
    pdfium: &Pdfium,
    input_path: &Path,
    output_path: &Path,
    tasks: &[TaskConfig],
    image_cache: &ImageCache,
) -> Result<ProcessResult> {
    info!(file = %input_path.display(), task_count = tasks.len(), "开始处理 PDF");

    let document = pdfium
        .load_pdf_from_file(input_path, None)
        .with_context(|| format!("打开 PDF 失败: {}", input_path.display()))?;
    let mut total_insertions = 0u32;

    for page_idx in 0..document.pages().len() {
        let mut page = document
            .pages()
            .get(PdfPageIndex::from(page_idx as u16))
            .with_context(|| format!("读取第 {} 页失败", page_idx + 1))?;

        let page_width = page.width().value;
        let page_height = page.height().value;
        let transform = CoordTransform::new(page_width, page_height);
        let mut page_insertions = 0u32;

        for task in tasks.iter().filter(|task| task.enabled) {
            let matches = search_text_in_page(&page, &task.search_text, page_idx as u16)?;
            if matches.is_empty() {
                debug!(task = %task.name, page = page_idx + 1, "未找到匹配文本");
                continue;
            }

            let prepared = image_cache.prepare(&task.image_path, task.target_height_points)?;

            for matched in matches {
                let placement = compute_runtime_placement(&transform, &matched, task, &prepared);

                if !transform.is_visible(placement) {
                    warn!(
                        task = %task.name,
                        page = page_idx + 1,
                        file = %input_path.display(),
                        "图片放置区域完全超出页面，已跳过"
                    );
                    continue;
                }

                insert_image(&mut page, &prepared, placement)?;
                total_insertions += 1;
                page_insertions += 1;
            }
        }

        if page_insertions > 0 {
            debug!(
                page = page_idx + 1,
                insertions = page_insertions,
                "页面图片插入完成"
            );
        }
    }

    document
        .save_to_file(output_path)
        .with_context(|| format!("保存 PDF 失败: {}", output_path.display()))?;

    Ok(ProcessResult {
        success: true,
        insertions: total_insertions,
        message: format!("成功处理，共 {} 处插入", total_insertions),
        error: None,
    })
}

pub fn search_text_in_page(
    page: &PdfPage,
    text: &str,
    page_index: u16,
) -> Result<Vec<TextPosition>> {
    let text_page = match page.text() {
        Ok(text_page) => text_page,
        Err(error) => {
            warn!(
                page = page_index + 1,
                error = %error,
                "提取文本层失败，按无匹配处理"
            );
            return Ok(Vec::new());
        }
    };

    let search = match text_page.search(text, &PdfSearchOptions::default()) {
        Ok(search) => search,
        Err(error) => {
            warn!(
                page = page_index + 1,
                needle = text,
                error = %error,
                "文本层不可搜索，按无匹配处理"
            );
            return Ok(Vec::new());
        }
    };

    let mut positions = Vec::new();

    while let Some(segments) = search.find_next() {
        for segment in segments.iter() {
            positions.push(TextPosition::from_pdf_rect(segment.bounds(), page_index));
        }
    }

    Ok(positions)
}

pub fn get_page_count(pdfium: &Pdfium, path: &Path) -> Result<u16> {
    let document = pdfium
        .load_pdf_from_file(path, None)
        .with_context(|| format!("打开 PDF 失败: {}", path.display()))?;
    Ok(document.pages().len() as u16)
}

pub fn find_pdf_files(dir: &Path) -> Result<Vec<PathBuf>> {
    if !dir.exists() || !dir.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "输入目录不存在: {}",
            dir.display()
        )));
    }

    let mut pdf_files = std::fs::read_dir(dir)
        .with_context(|| format!("读取输入目录失败: {}", dir.display()))?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("pdf"))
                    .unwrap_or(false)
        })
        .collect::<Vec<_>>();

    pdf_files.sort_by(|left, right| left.file_name().cmp(&right.file_name()));
    Ok(pdf_files)
}

pub fn render_page_preview(
    pdfium: &Pdfium,
    path: &Path,
    page_index: u16,
    tasks: &[TaskConfig],
    selected_task_name: Option<&str>,
    image_cache: &ImageCache,
    preview_store: &crate::image::PreviewStore,
) -> Result<RenderedPreview> {
    let document = pdfium
        .load_pdf_from_file(path, None)
        .with_context(|| format!("打开预览 PDF 失败: {}", path.display()))?;
    let page_count = document.pages().len() as u16;

    if page_index >= page_count {
        return Err(AppError::InvalidPath(format!(
            "页码 {} 超出范围",
            page_index + 1
        )));
    }

    let page = document
        .pages()
        .get(PdfPageIndex::from(page_index))
        .with_context(|| format!("读取预览页失败: {}", page_index + 1))?;
    let page_width_points = page.width().value;
    let page_height_points = page.height().value;
    let transform = CoordTransform::new(page_width_points, page_height_points);

    let render_config = PdfRenderConfig::new()
        .set_target_width(PREVIEW_TARGET_WIDTH)
        .set_maximum_height(PREVIEW_TARGET_WIDTH * 2)
        .rotate_if_landscape(PdfPageRenderRotation::None, false);

    let preview_image = page.render_with_config(&render_config)?.as_image();
    let pixel_width = preview_image.width();
    let pixel_height = preview_image.height();

    let mut png_buffer = Cursor::new(Vec::new());
    preview_image
        .write_to(&mut png_buffer, ImageFormat::Png)
        .context("编码预览图片失败")?;

    let overlays = build_preview_overlays(
        &page,
        page_index,
        tasks,
        selected_task_name,
        &transform,
        image_cache,
        preview_store,
    )?;

    Ok(RenderedPreview {
        png_bytes: png_buffer.into_inner(),
        pixel_width,
        pixel_height,
        page_width_points,
        page_height_points,
        overlays,
    })
}

pub fn get_text_positions(
    pdfium: &Pdfium,
    path: &Path,
    page_index: u16,
    text: &str,
) -> Result<Vec<TextPosition>> {
    let document = pdfium
        .load_pdf_from_file(path, None)
        .with_context(|| format!("打开 PDF 失败: {}", path.display()))?;
    let page_count = document.pages().len() as u16;

    if page_index >= page_count {
        return Err(AppError::InvalidPath(format!(
            "页码 {} 超出范围",
            page_index + 1
        )));
    }

    let page = document
        .pages()
        .get(PdfPageIndex::from(page_index))
        .with_context(|| format!("读取第 {} 页失败", page_index + 1))?;

    search_text_in_page(&page, text, page_index)
}

fn build_preview_overlays(
    page: &PdfPage,
    page_index: u16,
    tasks: &[TaskConfig],
    selected_task_name: Option<&str>,
    transform: &CoordTransform,
    image_cache: &ImageCache,
    preview_store: &crate::image::PreviewStore,
) -> Result<Vec<PreviewOverlay>> {
    let mut overlays = Vec::new();

    for task in tasks.iter().filter(|task| task.enabled) {
        let matches = search_text_in_page(page, &task.search_text, page_index)?;
        if matches.is_empty() {
            continue;
        }

        let prepared = image_cache.prepare(&task.image_path, task.target_height_points)?;

        let mut png_buffer = Cursor::new(Vec::new());
        prepared
            .raster
            .write_to(&mut png_buffer, ImageFormat::Png)
            .context("编码预览叠加图失败")?;
        let token = preview_store.insert_png(png_buffer.into_inner());
        let image_url = crate::image::preview_url(&token);

        for (match_index, matched) in matches.iter().enumerate() {
            let placement =
                compute_preview_placement(transform, matched, task, &prepared, match_index);

            overlays.push(PreviewOverlay {
                task_name: task.name.clone(),
                match_rect: transform.text_rect_to_relative(matched),
                image_rect: transform.placement_rect_to_relative(placement),
                image_url: image_url.clone(),
                selected: selected_task_name
                    .map(|selected| selected == task.name)
                    .unwrap_or(false),
                randomized: task.random_offset_x > 0 || task.random_offset_y > 0,
            });
        }
    }

    Ok(overlays)
}

fn compute_runtime_placement(
    transform: &CoordTransform,
    matched: &TextPosition,
    task: &TaskConfig,
    prepared: &PreparedImage,
) -> PdfPlacementRect {
    let mut rng = rand::rng();

    let random_x = if task.random_offset_x > 0 {
        rng.random_range(-(task.random_offset_x as i32)..=(task.random_offset_x as i32)) as f32
    } else {
        0.0
    };
    let random_y = if task.random_offset_y > 0 {
        rng.random_range(-(task.random_offset_y as i32)..=(task.random_offset_y as i32)) as f32
    } else {
        0.0
    };

    transform.image_rect_from_text_anchor(
        matched,
        task.base_offset_x as f32 + random_x,
        task.base_offset_y as f32 + random_y,
        prepared.display_width_points,
        prepared.display_height_points,
    )
}

fn compute_preview_placement(
    transform: &CoordTransform,
    matched: &TextPosition,
    task: &TaskConfig,
    prepared: &PreparedImage,
    match_index: usize,
) -> PdfPlacementRect {
    let (random_x, random_y) = preview_offsets(task, matched.page, match_index);

    transform.image_rect_from_text_anchor(
        matched,
        task.base_offset_x as f32 + random_x,
        task.base_offset_y as f32 + random_y,
        prepared.display_width_points,
        prepared.display_height_points,
    )
}

fn preview_offsets(task: &TaskConfig, page: u16, match_index: usize) -> (f32, f32) {
    (
        deterministic_offset(&task.name, page, match_index, task.random_offset_x),
        deterministic_offset(
            &format!("{}-y", task.name),
            page,
            match_index,
            task.random_offset_y,
        ),
    )
}

fn deterministic_offset(seed: &str, page: u16, match_index: usize, range: u32) -> f32 {
    if range == 0 {
        return 0.0;
    }

    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    page.hash(&mut hasher);
    match_index.hash(&mut hasher);
    let value = hasher.finish() % (range as u64 * 2 + 1);

    value as f32 - range as f32
}

fn insert_image(
    page: &mut PdfPage,
    prepared: &PreparedImage,
    placement: PdfPlacementRect,
) -> Result<()> {
    page.objects_mut()
        .create_image_object(
            PdfPoints::new(placement.left),
            PdfPoints::new(placement.bottom),
            &prepared.raster,
            Some(PdfPoints::new(placement.width)),
            Some(PdfPoints::new(placement.height)),
        )
        .with_context(|| "创建 PDF 图片对象失败，底层使用 FPDFPageObj_NewImageObj".to_string())?;

    Ok(())
}
