use std::num::NonZeroUsize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use lru::LruCache;
use parking_lot::RwLock;

#[derive(Debug, Clone)]
pub struct PreviewAsset {
    pub mime_type: &'static str,
    pub bytes: Arc<Vec<u8>>,
}

pub struct PreviewStore {
    token_prefix: &'static str,
    sequence: AtomicU64,
    assets: RwLock<LruCache<String, PreviewAsset>>,
}

impl PreviewStore {
    pub fn new(capacity: usize, token_prefix: &'static str) -> Self {
        Self {
            token_prefix,
            sequence: AtomicU64::new(1),
            assets: RwLock::new(LruCache::new(NonZeroUsize::new(capacity.max(8)).unwrap())),
        }
    }

    pub fn insert_png(&self, bytes: Vec<u8>) -> String {
        let token = format!(
            "{}-{}",
            self.token_prefix,
            self.sequence.fetch_add(1, Ordering::Relaxed)
        );

        self.assets.write().put(
            token.clone(),
            PreviewAsset {
                mime_type: "image/png",
                bytes: Arc::new(bytes),
            },
        );

        token
    }

    pub fn get(&self, token: &str) -> Option<PreviewAsset> {
        self.assets.write().get(token).cloned()
    }
}

pub fn preview_url(token: &str) -> String {
    #[cfg(any(target_os = "windows", target_os = "android"))]
    {
        format!("http://preview.localhost/{token}.png")
    }

    #[cfg(not(any(target_os = "windows", target_os = "android")))]
    {
        format!("preview://localhost/{token}.png")
    }
}

impl Default for PreviewStore {
    fn default() -> Self {
        Self::new(24, "preview")
    }
}
