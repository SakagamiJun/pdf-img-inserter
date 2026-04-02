use super::models::AppConfig;
use crate::error::Result;
use anyhow::Context;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathSerializationMode {
    Absolute,
    Portable,
}

pub fn load_config(path: &Path) -> Result<AppConfig> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("读取配置文件失败: {}", path.display()))?;
    let mut config: AppConfig = toml::from_str(&content)
        .with_context(|| format!("解析配置文件失败: {}", path.display()))?;

    let base_dir = path.parent().unwrap_or_else(|| Path::new("."));
    config.resolve_paths(base_dir);

    config.validate().map_err(crate::error::AppError::Config)?;

    Ok(config)
}

pub fn save_config(path: &Path, config: &AppConfig, mode: PathSerializationMode) -> Result<()> {
    config.validate().map_err(crate::error::AppError::Config)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("创建配置目录失败: {}", parent.display()))?;
    }

    let mut serializable = config.clone();
    if mode == PathSerializationMode::Portable {
        let base_dir = path.parent().unwrap_or_else(|| Path::new("."));
        make_config_portable(&mut serializable, base_dir);
    }

    let content = toml::to_string_pretty(&serializable)
        .with_context(|| format!("序列化配置失败: {}", path.display()))?;
    std::fs::write(path, content)
        .with_context(|| format!("写入配置文件失败: {}", path.display()))?;

    Ok(())
}

pub fn create_default_config(
    path: &Path,
    input_folder: &Path,
    output_folder: &Path,
    mode: PathSerializationMode,
) -> Result<()> {
    let mut config = AppConfig::with_example();
    config.global.input_folder = input_folder.to_path_buf();
    config.global.output_folder = output_folder.to_path_buf();

    std::fs::create_dir_all(input_folder)
        .with_context(|| format!("创建默认输入目录失败: {}", input_folder.display()))?;
    std::fs::create_dir_all(output_folder)
        .with_context(|| format!("创建默认输出目录失败: {}", output_folder.display()))?;

    save_config(path, &config, mode)
}

pub fn normalize_legacy_managed_paths(
    config: &mut AppConfig,
    legacy_config_path: &Path,
    new_input_folder: &Path,
    new_output_folder: &Path,
) {
    let base_dir = legacy_config_path
        .parent()
        .unwrap_or_else(|| Path::new("."));
    let legacy_input_folder = base_dir.join("input_pdfs");
    let legacy_output_folder = base_dir.join("output_pdfs");

    if paths_match(&config.global.input_folder, &legacy_input_folder) {
        config.global.input_folder = new_input_folder.to_path_buf();
    }

    if paths_match(&config.global.output_folder, &legacy_output_folder) {
        config.global.output_folder = new_output_folder.to_path_buf();
    }
}

fn make_config_portable(config: &mut AppConfig, base_dir: &Path) {
    config.global.input_folder = relativize_for_config(&config.global.input_folder, base_dir);
    config.global.output_folder = relativize_for_config(&config.global.output_folder, base_dir);

    for task in &mut config.tasks {
        task.image_path = relativize_for_config(&task.image_path, base_dir);
    }
}

fn relativize_for_config(path: &Path, base_dir: &Path) -> PathBuf {
    if path.is_relative() {
        return path.to_path_buf();
    }

    relative_path(path, base_dir).unwrap_or_else(|| path.to_path_buf())
}

fn relative_path(path: &Path, base: &Path) -> Option<PathBuf> {
    if path.is_relative() || base.is_relative() {
        return None;
    }

    let path_components = path.components().collect::<Vec<_>>();
    let base_components = base.components().collect::<Vec<_>>();

    let shared = path_components
        .iter()
        .zip(base_components.iter())
        .take_while(|(left, right)| left == right)
        .count();

    if shared == 0 {
        return None;
    }

    let mut result = PathBuf::new();

    for component in &base_components[shared..] {
        if matches!(component, Component::Normal(_)) {
            result.push("..");
        }
    }

    for component in &path_components[shared..] {
        match component {
            Component::Normal(part) => result.push(part),
            Component::CurDir => {}
            Component::ParentDir => result.push(".."),
            Component::RootDir | Component::Prefix(_) => {}
        }
    }

    if result.as_os_str().is_empty() {
        Some(PathBuf::from("."))
    } else {
        Some(result)
    }
}

fn paths_match(left: &Path, right: &Path) -> bool {
    normalize_path(left) == normalize_path(right)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
        }
    }

    if normalized.as_os_str().is_empty() {
        PathBuf::from(".")
    } else {
        normalized
    }
}
