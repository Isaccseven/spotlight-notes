use std::time::Duration;

use tauri_plugin_notification::NotificationExt;

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
pub async fn register_notification(app: tauri::AppHandle, message: String) -> Result<(), String> {
    let delay_ms = parse_delay_ms(&message).ok_or("Invalid delay format")?;

    let state = app
        .notification()
        .permission_state()
        .map_err(|e| e.to_string())?;

    if state != tauri_plugin_notification::PermissionState::Granted {
        return Err("Notification permission not granted".into());
    }

    let body = message
        .split('@')
        .next()
        .unwrap_or(&message)
        .trim()
        .to_string();

    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(delay_ms)).await;

        let _ = app
            .notification()
            .builder()
            .title("Spotlight Notes")
            .body(body)
            .show();
    });

    Ok(())
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
}
