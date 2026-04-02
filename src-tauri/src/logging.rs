use std::collections::BTreeMap;
use std::fmt;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::RwLock;
use serde::Serialize;
use tauri::Emitter;
use tracing::{
    field::{Field, Visit},
    Event, Subscriber,
};
use tracing_subscriber::{layer::Context, layer::SubscriberExt, util::SubscriberInitExt, Layer};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEvent {
    pub timestamp_ms: u64,
    pub level: String,
    pub target: String,
    pub message: String,
    pub fields: BTreeMap<String, String>,
}

#[derive(Default)]
pub struct LogBridge {
    app_handle: RwLock<Option<tauri::AppHandle>>,
}

impl LogBridge {
    pub fn set_app_handle(&self, app_handle: tauri::AppHandle) {
        *self.app_handle.write() = Some(app_handle);
    }

    fn emit(&self, event: LogEvent) {
        if let Some(app_handle) = self.app_handle.read().as_ref() {
            let _ = app_handle.emit("log", event);
        }
    }
}

pub fn init_tracing(bridge: Arc<LogBridge>) {
    let log_layer = LogLayer { bridge };
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_ansi(false)
        .with_target(false)
        .without_time();

    let _ = tracing_subscriber::registry()
        .with(fmt_layer)
        .with(log_layer)
        .try_init();
}

struct LogLayer {
    bridge: Arc<LogBridge>,
}

impl<S> Layer<S> for LogLayer
where
    S: Subscriber,
{
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = EventVisitor::default();
        event.record(&mut visitor);

        let payload = LogEvent {
            timestamp_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            level: event.metadata().level().as_str().to_string(),
            target: event.metadata().target().to_string(),
            message: visitor
                .message
                .unwrap_or_else(|| event.metadata().name().to_string()),
            fields: visitor.fields,
        };

        self.bridge.emit(payload);
    }
}

#[derive(Default)]
struct EventVisitor {
    message: Option<String>,
    fields: BTreeMap<String, String>,
}

impl Visit for EventVisitor {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.record_value(field, value.to_string());
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        self.record_value(field, value.to_string());
    }

    fn record_i64(&mut self, field: &Field, value: i64) {
        self.record_value(field, value.to_string());
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.record_value(field, value.to_string());
    }

    fn record_f64(&mut self, field: &Field, value: f64) {
        self.record_value(field, value.to_string());
    }

    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        self.record_value(field, format!("{value:?}"));
    }
}

impl EventVisitor {
    fn record_value(&mut self, field: &Field, value: String) {
        if field.name() == "message" {
            self.message = Some(value);
        } else {
            self.fields.insert(field.name().to_string(), value);
        }
    }
}
