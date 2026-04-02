use anyhow::Error as AnyhowError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Pdfium 初始化失败: {0}")]
    PdfiumInit(String),

    #[error("PDF 处理错误: {0}")]
    Pdf(#[from] pdfium_render::prelude::PdfiumError),

    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("配置错误: {0}")]
    Config(String),

    #[error("图片处理错误: {0}")]
    Image(String),

    #[error("路径无效: {0}")]
    InvalidPath(String),

    #[error("TOML 解析错误: {0}")]
    TomlDeserialize(#[from] toml::de::Error),

    #[error("TOML 序列化错误: {0}")]
    TomlSerialize(#[from] toml::ser::Error),

    #[error(transparent)]
    Other(#[from] AnyhowError),
}

impl From<image::ImageError> for AppError {
    fn from(err: image::ImageError) -> Self {
        Self::Image(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
