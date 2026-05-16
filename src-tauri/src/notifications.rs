use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

use crate::grammar;

const STORE_PATH: &str = "notes.json";
const NOTIFICATIONS_KEY: &str = "pending_notifications";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScheduledNotification {
    pub id: String,
    pub body: String,
    pub trigger_at: u64,
    pub created_at: u64,
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn filter_expired(notifications: Vec<ScheduledNotification>, now: u64) -> Vec<ScheduledNotification> {
    notifications
        .into_iter()
        .filter(|n| n.trigger_at > now)
        .collect()
}

pub struct NotificationQueue {
    tasks: Mutex<HashMap<String, tokio::task::AbortHandle>>,
    store_lock: Arc<Mutex<()>>,
}

impl NotificationQueue {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
            store_lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn restore(&self, app: AppHandle) -> Result<(), String> {
        let _guard = self.store_lock.lock().map_err(|e| e.to_string())?;
        let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
        let now = current_time_ms();

        let notifications: Vec<ScheduledNotification> = store
            .get(NOTIFICATIONS_KEY)
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();

        let pending = filter_expired(notifications, now);

        store.set(
            NOTIFICATIONS_KEY,
            serde_json::to_value(&pending).map_err(|e| e.to_string())?,
        );

        for notification in pending {
            self.schedule(app.clone(), notification)?;
        }

        Ok(())
    }

    /// Register one or more notifications from a pre-parsed note.
    pub fn register_from_parsed(
        &self,
        app: AppHandle,
        parsed: &grammar::ParsedNote,
    ) -> Result<Vec<ScheduledNotification>, String> {
        if parsed.delays_ms.is_empty() {
            return Ok(Vec::new());
        }

        let now = current_time_ms();
        let clean_body = parsed.clean_body.clone();
        let mut scheduled = Vec::with_capacity(parsed.delays_ms.len());

        for (idx, delay_ms) in parsed.delays_ms.iter().enumerate() {
            let body = if idx == 0 {
                clean_body.clone()
            } else {
                format!("{} (reminder {})", clean_body, idx + 1)
            };

            let notification = ScheduledNotification {
                id: uuid::Uuid::new_v4().to_string(),
                body,
                trigger_at: now + delay_ms,
                created_at: now,
            };

            {
                let _guard = self.store_lock.lock().map_err(|e| e.to_string())?;
                let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
                let mut existing: Vec<ScheduledNotification> = store
                    .get(NOTIFICATIONS_KEY)
                    .and_then(|v| serde_json::from_value(v).ok())
                    .unwrap_or_default();

                existing.push(notification.clone());
                store.set(
                    NOTIFICATIONS_KEY,
                    serde_json::to_value(&existing).map_err(|e| e.to_string())?,
                );
            }

            self.schedule(app.clone(), notification.clone())?;

            let _ = app.emit("reminder_scheduled", &notification);
            scheduled.push(notification);
        }

        Ok(scheduled)
    }

    /// Legacy entry-point: parse the raw message with the grammar module,
    /// then delegate to `register_from_parsed`.
    pub fn register(
        &self,
        app: AppHandle,
        message: String,
    ) -> Result<Vec<ScheduledNotification>, String> {
        let parsed = grammar::parse_note(&message);
        self.register_from_parsed(app, &parsed)
    }

    pub fn cancel(&self, app: AppHandle, id: String) -> Result<(), String> {
        let mut tasks = self.tasks.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = tasks.remove(&id) {
            handle.abort();
        }

        let _guard = self.store_lock.lock().map_err(|e| e.to_string())?;
        let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
        let mut existing: Vec<ScheduledNotification> = store
            .get(NOTIFICATIONS_KEY)
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();

        existing.retain(|n| n.id != id);
        store.set(
            NOTIFICATIONS_KEY,
            serde_json::to_value(&existing).map_err(|e| e.to_string())?,
        );

        Ok(())
    }

    fn schedule(&self, app: AppHandle, notification: ScheduledNotification) -> Result<(), String> {
        let notification_id = notification.id.clone();
        let body = notification.body.clone();
        let trigger_at = notification.trigger_at;
        let duration = Duration::from_millis(trigger_at.saturating_sub(current_time_ms()));

        let store_lock = self.store_lock.clone();
        let handle = tokio::spawn(async move {
            tokio::time::sleep(duration).await;

            let _ = app
                .notification()
                .builder()
                .title("Spotlight Notes")
                .body(body)
                .show();

            let _ = app.emit("reminder_fired", notification_id.clone());

            if let Ok(_guard) = store_lock.lock() {
                if let Ok(store) = app.store(STORE_PATH) {
                    let mut existing: Vec<ScheduledNotification> = store
                        .get(NOTIFICATIONS_KEY)
                        .and_then(|v| serde_json::from_value(v).ok())
                        .unwrap_or_default();

                    existing.retain(|n| n.id != notification_id);
                    let _ = store.set(
                        NOTIFICATIONS_KEY,
                        serde_json::to_value(&existing).unwrap_or(serde_json::Value::Null),
                    );
                }
            }
        });

        let mut tasks = self.tasks.lock().map_err(|e| e.to_string())?;
        tasks.insert(notification.id, handle.abort_handle());
        Ok(())
    }
}

#[tauri::command]
pub async fn register_notification(
    app: AppHandle,
    message: String,
) -> Result<Vec<ScheduledNotification>, String> {
    let state = app
        .notification()
        .permission_state()
        .map_err(|e| e.to_string())?;

    if state != tauri_plugin_notification::PermissionState::Granted {
        return Err("Notification permission not granted".into());
    }

    let queue = app.state::<NotificationQueue>();
    queue.register(app.clone(), message)
}

#[tauri::command]
pub async fn cancel_notification(app: AppHandle, id: String) -> Result<(), String> {
    let queue = app.state::<NotificationQueue>();
    queue.cancel(app.clone(), id)
}

#[tauri::command]
pub fn list_pending_notifications(app: AppHandle) -> Result<Vec<ScheduledNotification>, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let notifications: Vec<ScheduledNotification> = store
        .get(NOTIFICATIONS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    Ok(notifications)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduled_notification_serde() {
        let n = ScheduledNotification {
            id: "abc-123".into(),
            body: "test body".into(),
            trigger_at: 1_000,
            created_at: 0,
        };
        let json = serde_json::to_value(&n).unwrap();
        let deserialized: ScheduledNotification = serde_json::from_value(json).unwrap();
        assert_eq!(n, deserialized);
    }

    #[test]
    fn test_filter_expired_removes_old() {
        let now = 1000;
        let notifications = vec![
            ScheduledNotification {
                id: "1".into(),
                body: "past".into(),
                trigger_at: 500,
                created_at: 0,
            },
            ScheduledNotification {
                id: "2".into(),
                body: "future".into(),
                trigger_at: 1500,
                created_at: 0,
            },
        ];
        let filtered = filter_expired(notifications, now);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, "2");
    }

    #[test]
    fn test_filter_expired_keeps_all_when_future() {
        let now = 0;
        let notifications = vec![
            ScheduledNotification {
                id: "1".into(),
                body: "a".into(),
                trigger_at: 100,
                created_at: 0,
            },
            ScheduledNotification {
                id: "2".into(),
                body: "b".into(),
                trigger_at: 200,
                created_at: 0,
            },
        ];
        let filtered = filter_expired(notifications, now);
        assert_eq!(filtered.len(), 2);
    }

    #[test]
    fn test_filter_expired_empty() {
        let filtered = filter_expired(vec![], 1000);
        assert!(filtered.is_empty());
    }
}
