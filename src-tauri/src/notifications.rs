use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

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
}

impl NotificationQueue {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
        }
    }

    pub fn restore(&self, app: AppHandle) -> Result<(), String> {
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
            self.schedule(app.clone(), notification);
        }

        Ok(())
    }

    pub fn register(
        &self,
        app: AppHandle,
        message: String,
    ) -> Result<ScheduledNotification, String> {
        let delay_ms = parse_delay_ms(&message).ok_or("Invalid delay format")?;
        let now = current_time_ms();

        let body = message
            .split('@')
            .next()
            .unwrap_or(&message)
            .trim()
            .to_string();

        let notification = ScheduledNotification {
            id: uuid::Uuid::new_v4().to_string(),
            body,
            trigger_at: now + delay_ms,
            created_at: now,
        };

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

        self.schedule(app, notification.clone());
        Ok(notification)
    }

    pub fn cancel(&self, app: AppHandle, id: String) -> Result<(), String> {
        let mut tasks = self.tasks.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = tasks.remove(&id) {
            handle.abort();
        }
        drop(tasks);

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

    fn schedule(&self, app: AppHandle, notification: ScheduledNotification) {
        let notification_id = notification.id.clone();
        let body = notification.body.clone();
        let trigger_at = notification.trigger_at;
        let duration = Duration::from_millis(trigger_at.saturating_sub(current_time_ms()));

        let handle = tokio::spawn(async move {
            tokio::time::sleep(duration).await;

            let _ = app
                .notification()
                .builder()
                .title("Spotlight Notes")
                .body(body)
                .show();

            let _ = app.emit("reminder_fired", notification_id.clone());

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
        });

        let mut tasks = self.tasks.lock().unwrap();
        tasks.insert(notification.id, handle.abort_handle());
    }
}

pub(crate) fn parse_delay_ms(message: &str) -> Option<u64> {
    let part_after_at = message.split('@').nth(1)?;
    let trimmed = part_after_at.trim();

    let re = regex::Regex::new(r"^(?i)(\d+)([smhd])").ok()?;
    let caps = re.captures(trimmed)?;

    let amount: u64 = caps[1].parse().ok()?;
    let unit = caps[2].to_lowercase().chars().next()?;

    let multiplier = match unit {
        's' => 1,
        'm' => 60,
        'h' => 60 * 60,
        'd' => 24 * 60 * 60,
        _ => return None,
    };

    Some(amount * multiplier * 1000)
}

#[tauri::command]
pub async fn register_notification(
    app: AppHandle,
    message: String,
) -> Result<ScheduledNotification, String> {
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
    fn test_parse_delay_seconds() {
        assert_eq!(parse_delay_ms("reminder @ 10s"), Some(10_000));
        assert_eq!(parse_delay_ms("reminder @10S"), Some(10_000));
    }

    #[test]
    fn test_parse_delay_minutes() {
        assert_eq!(parse_delay_ms("reminder @ 5m"), Some(300_000));
        assert_eq!(parse_delay_ms("reminder @2M"), Some(120_000));
    }

    #[test]
    fn test_parse_delay_hours() {
        assert_eq!(parse_delay_ms("reminder @ 1h"), Some(3_600_000));
        assert_eq!(parse_delay_ms("reminder @3H"), Some(10_800_000));
    }

    #[test]
    fn test_parse_delay_days() {
        assert_eq!(parse_delay_ms("reminder @ 1d"), Some(86_400_000));
        assert_eq!(parse_delay_ms("reminder @2D"), Some(172_800_000));
    }

    #[test]
    fn test_parse_delay_no_at_sign() {
        assert_eq!(parse_delay_ms("no delay here"), None);
    }

    #[test]
    fn test_parse_delay_invalid_unit() {
        assert_eq!(parse_delay_ms("reminder @ 5x"), None);
    }

    #[test]
    fn test_parse_delay_with_extra_text() {
        assert_eq!(parse_delay_ms("reminder @ 5m extra"), Some(300_000));
    }

    #[test]
    fn test_parse_delay_whitespace_variations() {
        assert_eq!(parse_delay_ms("reminder @5s"), Some(5_000));
        assert_eq!(parse_delay_ms("reminder @ 5s"), Some(5_000));
        assert_eq!(parse_delay_ms("reminder @  5s"), Some(5_000));
    }

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
