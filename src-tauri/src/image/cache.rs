use image::DynamicImage;
use lru::LruCache;
use parking_lot::RwLock;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::error::Result;

use super::preprocess::{load_original, prepare_image, PreparedImage};

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
struct PreparedImageKey {
    path: PathBuf,
    target_height_bits: u32,
}

/// Image cache with LRU eviction for both original and resized images.
pub struct ImageCache {
    original_images: RwLock<LruCache<PathBuf, Arc<DynamicImage>>>,
    prepared_images: RwLock<LruCache<PreparedImageKey, Arc<PreparedImage>>>,
}

impl ImageCache {
    pub fn new(cache_size: usize) -> Self {
        let original_capacity = NonZeroUsize::new(cache_size.max(1)).unwrap();
        let prepared_capacity = NonZeroUsize::new((cache_size.max(1) * 3).max(8)).unwrap();

        Self {
            original_images: RwLock::new(LruCache::new(original_capacity)),
            prepared_images: RwLock::new(LruCache::new(prepared_capacity)),
        }
    }

    pub fn original(&self, path: &Path) -> Result<Arc<DynamicImage>> {
        let key = path.to_path_buf();

        {
            let mut cache = self.original_images.write();
            if let Some(image) = cache.get(&key) {
                return Ok(Arc::clone(image));
            }
        }

        let image = Arc::new(load_original(path)?);

        {
            let mut cache = self.original_images.write();
            cache.put(key, Arc::clone(&image));
        }

        Ok(image)
    }

    pub fn prepare(&self, path: &Path, target_height_points: f32) -> Result<Arc<PreparedImage>> {
        let key = PreparedImageKey {
            path: path.to_path_buf(),
            target_height_bits: target_height_points.to_bits(),
        };

        {
            let mut cache = self.prepared_images.write();
            if let Some(prepared) = cache.get(&key) {
                return Ok(Arc::clone(prepared));
            }
        }

        let original = self.original(path)?;
        let prepared = prepare_image(original.as_ref(), target_height_points)?;

        {
            let mut cache = self.prepared_images.write();
            cache.put(key, Arc::clone(&prepared));
        }

        Ok(prepared)
    }
}

impl Default for ImageCache {
    fn default() -> Self {
        Self::new(64)
    }
}
