use serde::Deserialize;
use std::path::Path;

#[derive(Deserialize)]
pub struct ExportFile {
    pub filename: String,
    pub content: String,
}

#[tauri::command]
pub fn write_export_files(dir: String, files: Vec<ExportFile>) -> Result<(), String> {
    let base = Path::new(&dir);
    if !base.exists() {
        std::fs::create_dir_all(base).map_err(|e| format!("Failed to create directory: {e}"))?;
    }
    for file in files {
        let path = base.join(&file.filename);
        std::fs::write(&path, &file.content)
            .map_err(|e| format!("Failed to write {}: {e}", file.filename))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn run_shell_command(command: String, input: Option<String>) -> Result<String, String> {
    let mut child = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&command)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    if let Some(text) = input {
        use tokio::io::AsyncWriteExt;
        let mut stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        stdin.write_all(text.as_bytes()).await.map_err(|e| e.to_string())?;
    }

    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!(
            "Command exited with code {:?}: {}",
            output.status.code(),
            if stderr.is_empty() { stdout } else { stderr }
        ));
    }

    Ok(stdout)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_write_export_files_creates_files() {
        let tmp = std::env::temp_dir().join("spotlight-export-test");
        let _ = std::fs::remove_dir_all(&tmp);
        let files = vec![
            ExportFile {
                filename: "test.md".to_string(),
                content: "# Hello".to_string(),
            },
            ExportFile {
                filename: "test.json".to_string(),
                content: r#"{"a":1}"#.to_string(),
            },
        ];
        let result = write_export_files(tmp.to_string_lossy().to_string(), files);
        assert!(result.is_ok());
        assert!(tmp.join("test.md").exists());
        assert_eq!(
            std::fs::read_to_string(tmp.join("test.md")).unwrap(),
            "# Hello"
        );
        assert_eq!(
            std::fs::read_to_string(tmp.join("test.json")).unwrap(),
            r#"{"a":1}"#
        );
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
