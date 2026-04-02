use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub const MAX_TARGET_HEIGHT_POINTS: f32 = 2_000.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskConfig {
    pub name: String,
    pub search_text: String,
    pub image_path: PathBuf,
    #[serde(default)]
    pub base_offset_x: i32,
    #[serde(default)]
    pub base_offset_y: i32,
    #[serde(default)]
    pub random_offset_x: u32,
    #[serde(default)]
    pub random_offset_y: u32,
    #[serde(default = "default_target_height")]
    pub target_height_points: f32,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_target_height() -> f32 {
    50.0
}

fn default_enabled() -> bool {
    true
}

impl TaskConfig {
    pub fn resolve_paths(&mut self, base_dir: &Path) {
        if self.image_path.is_relative() {
            self.image_path = base_dir.join(&self.image_path);
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("任务名称不能为空".into());
        }
        if self.search_text.trim().is_empty() {
            return Err("搜索文本不能为空".into());
        }
        if self.image_path.to_string_lossy().is_empty() {
            return Err("图片路径不能为空".into());
        }
        if !self.image_path.exists() || !self.image_path.is_file() {
            return Err(format!("图片不存在: {}", self.image_path.display()));
        }
        if self.target_height_points < 0.0 || !self.target_height_points.is_finite() {
            return Err("目标高度必须是大于等于 0 的有限数值".into());
        }
        if self.target_height_points > MAX_TARGET_HEIGHT_POINTS {
            return Err(format!(
                "目标高度过大 (最大允许 {} points): {}",
                MAX_TARGET_HEIGHT_POINTS, self.target_height_points
            ));
        }
        if self.random_offset_x > 10_000 || self.random_offset_y > 10_000 {
            return Err("随机偏移过大，请检查单位是否为 PDF points".into());
        }
        Ok(())
    }
}

impl Default for TaskConfig {
    fn default() -> Self {
        Self {
            name: String::new(),
            search_text: String::new(),
            image_path: PathBuf::new(),
            base_offset_x: 0,
            base_offset_y: 0,
            random_offset_x: 0,
            random_offset_y: 0,
            target_height_points: 50.0,
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfig {
    #[serde(default = "default_input_folder")]
    pub input_folder: PathBuf,
    #[serde(default = "default_output_folder")]
    pub output_folder: PathBuf,
}

fn default_input_folder() -> PathBuf {
    PathBuf::from("./input_pdfs")
}

fn default_output_folder() -> PathBuf {
    PathBuf::from("./output_pdfs")
}

impl Default for GlobalConfig {
    fn default() -> Self {
        Self {
            input_folder: default_input_folder(),
            output_folder: default_output_folder(),
        }
    }
}

impl GlobalConfig {
    pub fn resolve_paths(&mut self, base_dir: &Path) {
        if self.input_folder.is_relative() {
            self.input_folder = base_dir.join(&self.input_folder);
        }
        if self.output_folder.is_relative() {
            self.output_folder = base_dir.join(&self.output_folder);
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if !self.input_folder.exists() || !self.input_folder.is_dir() {
            return Err(format!("输入目录不存在: {}", self.input_folder.display()));
        }

        if self.output_folder.exists() && !self.output_folder.is_dir() {
            return Err(format!(
                "输出路径不是目录: {}",
                self.output_folder.display()
            ));
        }

        if let Some(parent) = self.output_folder.parent() {
            if !parent.exists() {
                return Err(format!("输出目录的父级不存在: {}", parent.display()));
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub global: GlobalConfig,
    #[serde(default)]
    pub tasks: Vec<TaskConfig>,
}

impl AppConfig {
    pub fn resolve_paths(&mut self, base_dir: &Path) {
        self.global.resolve_paths(base_dir);
        self.tasks
            .iter_mut()
            .for_each(|task| task.resolve_paths(base_dir));
    }

    pub fn validate(&self) -> Result<(), String> {
        self.global.validate()?;

        let mut names = HashSet::new();
        for task in &self.tasks {
            if !names.insert(task.name.trim().to_string()) {
                return Err(format!("任务名称重复: {}", task.name));
            }
            task.validate()?;
        }
        Ok(())
    }

    pub fn with_example() -> Self {
        Self {
            global: GlobalConfig::default(),
            tasks: Vec::new(),
        }
    }
}
