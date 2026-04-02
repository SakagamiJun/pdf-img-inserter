mod common;

use std::sync::Arc;

use common::TempWorkspace;
use pdf_img_inserter_lib::image::{
    calculate_display_dimensions, calculate_raster_dimensions, ImageCache,
};

#[test]
fn original_cache_reuses_decoded_image_for_same_path() {
    let workspace = TempWorkspace::new("image-cache-original");
    let image_path = workspace.write_png("images/stamp.png", 80, 40);
    let cache = ImageCache::new(4);

    let first = cache.original(&image_path).unwrap();
    let second = cache.original(&image_path).unwrap();

    assert!(Arc::ptr_eq(&first, &second));
}

#[test]
fn prepared_cache_reuses_same_height_and_splits_different_heights() {
    let workspace = TempWorkspace::new("image-cache-prepared");
    let image_path = workspace.write_png("images/stamp.png", 100, 50);
    let cache = ImageCache::new(4);

    let first = cache.prepare(&image_path, 60.0).unwrap();
    let second = cache.prepare(&image_path, 60.0).unwrap();
    let resized = cache.prepare(&image_path, 90.0).unwrap();

    assert!(Arc::ptr_eq(&first, &second));
    assert!(!Arc::ptr_eq(&first, &resized));
    assert_eq!(first.display_height_points, 60.0);
    assert_eq!(resized.display_height_points, 90.0);
    assert!(resized.raster.height() > first.raster.height());
}

#[test]
fn display_and_raster_dimensions_follow_target_height() {
    let (display_width, display_height) = calculate_display_dimensions(200, 100, 72.0);
    let (raster_width, raster_height) = calculate_raster_dimensions(200, 100, 72.0);

    assert!((display_width - 144.0).abs() < 0.01);
    assert!((display_height - 72.0).abs() < 0.01);
    assert_eq!(raster_width, 288);
    assert_eq!(raster_height, 144);
}
