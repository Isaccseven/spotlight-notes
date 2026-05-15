use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Deserialize, Serialize)]
pub struct ExportFile {
    pub filename: String,
    pub content: String,
}

fn sanitize_filename(name: &str) -> Result<String, String> {
    if name.is_empty() {
        return Err("Filename cannot be empty".into());
    }
    // Reject any path that contains directory separators or parent-directory references
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("Invalid filename: {name}"));
    }
    // Only use the final filename component in case of any other traversal tricks
    Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Invalid filename: {name}"))
}

/// Split a command string into program + arguments, respecting single and double quotes.
/// This avoids invoking a shell interpreter and prevents injection of shell metacharacters.
fn split_shell_words(input: &str) -> Result<Vec<String>, String> {
    let mut words: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut chars = input.chars().peekable();
    let mut in_single = false;
    let mut in_double = false;

    while let Some(ch) = chars.next() {
        if in_single {
            if ch == '\'' {
                in_single = false;
            } else {
                current.push(ch);
            }
            continue;
        }
        if in_double {
            if ch == '"' {
                in_double = false;
            } else {
                current.push(ch);
            }
            continue;
        }
        match ch {
            '\'' => in_single = true,
            '"' => in_double = true,
            ' ' | '\t' => {
                if !current.is_empty() {
                    words.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }
    if !current.is_empty() {
        words.push(current);
    }
    if words.is_empty() {
        return Err("Empty command".into());
    }
    Ok(words)
}

#[tauri::command]
pub fn write_export_files(dir: String, files: Vec<ExportFile>) -> Result<(), String> {
    let base = Path::new(&dir);
    if !base.exists() {
        std::fs::create_dir_all(base).map_err(|e| format!("Failed to create directory: {e}"))?;
    }
    for file in files {
        let safe_name = sanitize_filename(&file.filename)?;
        let path = base.join(&safe_name);
        // Double-check the resolved path stays inside base
        if !path.starts_with(base) {
            return Err(format!("Path traversal detected: {}", file.filename));
        }
        std::fs::write(&path, &file.content)
            .map_err(|e| format!("Failed to write {}: {e}", file.filename))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn run_shell_command(command: String, input: Option<String>) -> Result<String, String> {
    let parts = split_shell_words(&command)?;
    let program = &parts[0];
    let args = &parts[1..];

    let mut child = tokio::process::Command::new(program)
        .args(args)
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

    #[test]
    fn test_sanitize_filename_rejects_traversal() {
        assert!(sanitize_filename("../../../etc/passwd").is_err());
        assert!(sanitize_filename("foo/bar").is_err());
        assert!(sanitize_filename("foo\\bar").is_err());
        assert!(sanitize_filename("..").is_err());
        assert_eq!(sanitize_filename("notes.md").unwrap(), "notes.md");
    }

    #[test]
    fn test_split_shell_words_basic() {
        assert_eq!(
            split_shell_words("echo hello").unwrap(),
            vec!["echo", "hello"]
        );
    }

    #[test]
    fn test_split_shell_words_quotes() {
        assert_eq!(
            split_shell_words("echo 'hello world'").unwrap(),
            vec!["echo", "hello world"]
        );
        assert_eq!(
            split_shell_words("echo \"hello world\"").unwrap(),
            vec!["echo", "hello world"]
        );
    }

    #[test]
    fn test_split_shell_words_empty() {
        assert!(split_shell_words("").is_err());
        assert!(split_shell_words("   ").is_err());
    }
}
