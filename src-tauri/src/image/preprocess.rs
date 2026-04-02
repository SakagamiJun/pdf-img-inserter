use std::path::Path;
use std::sync::Arc;

use anyhow::Context;
use image::DynamicImage;

use crate::error::Result;

const EXPORT_PIXEL_SCALE: f32 = 2.0;

#[derive(Debug)]
pub struct PreparedImage {
    pub raster: DynamicImage,
    pub display_width_points: f32,
    pub display_height_points: f32,
}

pub fn load_original(path: &Path) -> Result<DynamicImage> {
    image::open(path)
        .with_context(|| format!("读取图片失败: {}", path.display()))
        .map_err(Into::into)
}

pub fn prepare_image(
    original: &DynamicImage,
    target_height_points: f32,
) -> Result<Arc<PreparedImage>> {
    let source_width = original.width();
    let source_height = original.height();

    let (display_width_points, display_height_points) =
        calculate_display_dimensions(source_width, source_height, target_height_points);
    let (pixel_width, pixel_height) =
        calculate_raster_dimensions(source_width, source_height, target_height_points);

    let raster = if pixel_width == source_width && pixel_height == source_height {
        original.clone()
    } else {
        original.resize(
            pixel_width,
            pixel_height,
            image::imageops::FilterType::Lanczos3,
        )
    };

    Ok(Arc::new(PreparedImage {
        raster,
        display_width_points,
        display_height_points,
    }))
}

pub fn calculate_display_dimensions(
    original_width: u32,
    original_height: u32,
    target_height_points: f32,
) -> (f32, f32) {
    if target_height_points <= 0.0 || original_height == 0 {
        return (original_width as f32, original_height as f32);
    }

    let aspect_ratio = original_width as f32 / original_height as f32;
    let display_height = target_height_points.max(1.0);
    let display_width = (display_height * aspect_ratio).max(1.0);

    (display_width, display_height)
}

pub fn calculate_raster_dimensions(
    original_width: u32,
    original_height: u32,
    target_height_points: f32,
) -> (u32, u32) {
    if target_height_points <= 0.0 || original_height == 0 {
        return (original_width.max(1), original_height.max(1));
    }

    let scale = (target_height_points * EXPORT_PIXEL_SCALE).max(1.0) / original_height as f32;
    let width = (original_width as f32 * scale).round().max(1.0) as u32;
    let height = (original_height as f32 * scale).round().max(1.0) as u32;

    (width, height)
}
