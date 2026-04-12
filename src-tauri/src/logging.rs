use std::collections::BTreeMap;
use std::fmt;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::{Condvar, Mutex};
use serde::Serialize;
use tauri::Emitter;
use tracing::{
    field::{Field, Visit},
    Event, Subscriber,
};
use tracing_subscriber::{layer::Context, layer::SubscriberExt, util::SubscriberInitExt, Layer};

use crate::pdf::ProgressEvent;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEvent {
    pub timestamp_ms: u64,
    pub level: String,
    pub target: String,
    pub message: String,
    pub fields: BTreeMap<String, String>,
}

impl LogEvent {
    pub fn new(
        level: impl Into<String>,
        target: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            timestamp_ms: current_timestamp_ms(),
            level: level.into(),
            target: target.into(),
            message: message.into(),
            fields: BTreeMap::new(),
        }
    }
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

struct BridgeState {
    app_handle: Option<tauri::AppHandle>,
    accepting_events: bool,
    in_flight_emits: usize,
}

impl Default for BridgeState {
    fn default() -> Self {
        Self {
            app_handle: None,
            accepting_events: true,
            in_flight_emits: 0,
        }
    }
}

pub struct LogBridge {
    state: Mutex<BridgeState>,
    emits_drained: Condvar,
}

impl Default for LogBridge {
    fn default() -> Self {
        Self {
            state: Mutex::new(BridgeState::default()),
            emits_drained: Condvar::new(),
        }
    }
}

impl LogBridge {
    pub fn set_app_handle(&self, app_handle: tauri::AppHandle) {
        let mut state = self.state.lock();
        state.app_handle = Some(app_handle);
        state.accepting_events = true;
    }

    pub fn begin_shutdown(&self) {
        let mut state = self.state.lock();
        state.accepting_events = false;

        while state.in_flight_emits > 0 {
            self.emits_drained.wait(&mut state);
        }

        state.app_handle = None;
    }

    pub fn emit_log(&self, event: LogEvent) {
        self.emit("log", event);
    }

    pub fn emit_progress(&self, event: ProgressEvent) {
        self.emit("progress", event);
    }

    fn emit<S>(&self, event_name: &str, payload: S)
    where
        S: Serialize + Clone,
    {
        let Some((app_handle, _emit_guard)) = self.prepare_emit() else {
            return;
        };

        let _ = app_handle.emit(event_name, payload);
    }

    fn prepare_emit(&self) -> Option<(tauri::AppHandle, EmitGuard<'_>)> {
        let mut state = self.state.lock();
        if !state.accepting_events {
            return None;
        }

        let app_handle = state.app_handle.clone()?;
        state.in_flight_emits += 1;

        Some((app_handle, EmitGuard { bridge: self }))
    }

    #[cfg(test)]
    fn start_test_emit(&self) -> Option<EmitGuard<'_>> {
        let mut state = self.state.lock();
        if !state.accepting_events {
            return None;
        }

        state.in_flight_emits += 1;
        Some(EmitGuard { bridge: self })
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

struct EmitGuard<'a> {
    bridge: &'a LogBridge,
}

impl Drop for EmitGuard<'_> {
    fn drop(&mut self) {
        let mut state = self.bridge.state.lock();
        debug_assert!(state.in_flight_emits > 0);
        if state.in_flight_emits > 0 {
            state.in_flight_emits -= 1;
        }

        if state.in_flight_emits == 0 {
            self.bridge.emits_drained.notify_all();
        }
    }
}

impl<S> Layer<S> for LogLayer
where
    S: Subscriber,
{
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = EventVisitor::default();
        event.record(&mut visitor);

        let mut payload = LogEvent::new(
            event.metadata().level().as_str().to_string(),
            event.metadata().target().to_string(),
            visitor
                .message
                .unwrap_or_else(|| event.metadata().name().to_string()),
        );
        payload.fields = visitor.fields;

        self.bridge.emit_log(payload);
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

#[cfg(test)]
mod tests {
    use std::sync::{mpsc, Arc};
    use std::time::Duration;

    use super::LogBridge;

    #[test]
    fn emits_are_accepted_before_shutdown() {
        let bridge = LogBridge::default();
        let emit_guard = bridge.start_test_emit();

        assert!(emit_guard.is_some());
    }

    #[test]
    fn emits_are_dropped_after_shutdown() {
        let bridge = LogBridge::default();
        bridge.begin_shutdown();

        assert!(bridge.start_test_emit().is_none());
    }

    #[test]
    fn begin_shutdown_waits_for_in_flight_emit_to_finish() {
        let bridge = Arc::new(LogBridge::default());
        let emit_guard = bridge
            .start_test_emit()
            .expect("emit should begin before shutdown");
        let shutdown_bridge = Arc::clone(&bridge);
        let (started_tx, started_rx) = mpsc::channel();
        let (done_tx, done_rx) = mpsc::channel();

        let shutdown_thread = std::thread::spawn(move || {
            started_tx
                .send(())
                .expect("shutdown thread should signal start");
            shutdown_bridge.begin_shutdown();
            done_tx.send(()).expect("shutdown thread should complete");
        });

        started_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("shutdown thread should start promptly");
        assert!(done_rx.recv_timeout(Duration::from_millis(100)).is_err());

        drop(emit_guard);

        done_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("shutdown should complete after emit finishes");
        shutdown_thread
            .join()
            .expect("shutdown thread should exit cleanly");
        assert!(bridge.start_test_emit().is_none());
    }
}
