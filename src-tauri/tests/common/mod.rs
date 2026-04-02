#![allow(dead_code)]

use image::{ImageBuffer, Rgba};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct TempWorkspace {
    root: PathBuf,
}

impl TempWorkspace {
    pub fn new(prefix: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "pdf-img-inserter-{prefix}-{}-{}",
            std::process::id(),
            unique_suffix()
        ));

        std::fs::create_dir_all(&root).expect("failed to create temp workspace");

        Self { root }
    }

    pub fn path(&self) -> &Path {
        &self.root
    }

    pub fn create_dir(&self, relative: impl AsRef<Path>) -> PathBuf {
        let path = self.root.join(relative.as_ref());
        std::fs::create_dir_all(&path).expect("failed to create temp directory");
        path
    }

    pub fn write_file(&self, relative: impl AsRef<Path>, content: &str) -> PathBuf {
        let path = self.root.join(relative.as_ref());
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("failed to create parent directory");
        }
        std::fs::write(&path, content).expect("failed to write temp file");
        path
    }

    pub fn write_png(&self, relative: impl AsRef<Path>, width: u32, height: u32) -> PathBuf {
        let path = self.root.join(relative.as_ref());
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("failed to create image directory");
        }

        let image = ImageBuffer::from_fn(width, height, |x, y| {
            if (x + y) % 2 == 0 {
                Rgba([230u8, 57, 70, 255])
            } else {
                Rgba([29u8, 78, 216, 180])
            }
        });

        image.save(&path).expect("failed to write png");
        path
    }
}

impl Drop for TempWorkspace {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn unique_suffix() -> u64 {
    let ticks = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    ticks ^ counter
}
