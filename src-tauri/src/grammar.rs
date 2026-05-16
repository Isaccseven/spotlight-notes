use serde::{Deserialize, Serialize};

/// A single parsed token from inline note syntax.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "content", rename_all = "snake_case")]
pub enum GrammarToken {
    Text(String),
    Tag(String),
    Time { raw: String, amount: u64, unit: char },
    Issue(String),
    Channel(String),
}

/// The fully parsed result of a note string.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedNote {
    pub raw: String,
    pub tokens: Vec<GrammarToken>,
    pub tags: Vec<String>,
    pub delays_ms: Vec<u64>,
    pub issues: Vec<String>,
    pub channels: Vec<String>,
    pub clean_body: String,
}

fn is_token_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '/' || c == '-'
}

fn should_enter_token_mode(text: &str, pos: usize) -> bool {
    if pos == 0 {
        return true;
    }
    match text.chars().nth(pos.saturating_sub(1)) {
        Some(c) => !c.is_alphanumeric() && c != '_' && c != '/' && c != '-',
        None => true,
    }
}

fn classify_token(text: &str) -> &'static str {
    if text.starts_with("@issue") {
        return "issue";
    }
    if text.starts_with("@channel") {
        return "channel";
    }
    "channel" // generic @mention falls to channel
}

fn parse_time_unit(unit: char) -> Option<u64> {
    let multiplier = match unit.to_ascii_lowercase() {
        's' => 1,
        'm' => 60,
        'h' => 60 * 60,
        'd' => 24 * 60 * 60,
        _ => return None,
    };
    Some(multiplier * 1000)
}

#[tauri::command]
pub fn parse_note_command(text: String) -> ParsedNote {
    parse_note(&text)
}

/// Parse a note string into typed tokens and extracted metadata.
///
/// Recognised inline syntax:
///   #tag         → Tag
///   @10s         → Time (seconds, minutes, hours, days)
///   @issue-123   → Issue
///   @channel/dev → Channel
///   @username    → Channel (generic mention)
pub fn parse_note(text: &str) -> ParsedNote {
    let mut tokens: Vec<GrammarToken> = Vec::new();
    let mut tags: Vec<String> = Vec::new();
    let mut delays_ms: Vec<u64> = Vec::new();
    let mut issues: Vec<String> = Vec::new();
    let mut channels: Vec<String> = Vec::new();

    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];

        if (ch == '#' || ch == '@') && should_enter_token_mode(text, i) {
            let start = i;
            i += 1;

            if ch == '#' {
                while i < chars.len() && is_token_char(chars[i]) {
                    i += 1;
                }
                let token_text: String = chars[start..i].iter().collect();
                if token_text.len() > 1 {
                    let tag_name = token_text[1..].to_lowercase();
                    tags.push(tag_name.clone());
                    tokens.push(GrammarToken::Tag(tag_name));
                } else {
                    tokens.push(GrammarToken::Text("#".to_string()));
                }
            } else {
                // Try to parse @time: @\d+[smhd]
                if i < chars.len() && chars[i].is_ascii_digit() {
                    let num_start = i;
                    while i < chars.len() && chars[i].is_ascii_digit() {
                        i += 1;
                    }
                    if i < chars.len() {
                        let unit = chars[i].to_ascii_lowercase();
                        if let Some(multiplier) = parse_time_unit(unit) {
                            i += 1;
                            let raw: String = chars[start..i].iter().collect();
                            let amount_str: String = chars[num_start..i - 1].iter().collect();
                            if let Ok(amount) = amount_str.parse::<u64>() {
                                let delay_ms = amount * multiplier;
                                delays_ms.push(delay_ms);
                                tokens.push(GrammarToken::Time {
                                    raw,
                                    amount,
                                    unit,
                                });
                                continue;
                            }
                        }
                    }
                    // Not a valid time token — backtrack to after @
                    i = num_start;
                }

                while i < chars.len() && is_token_char(chars[i]) {
                    i += 1;
                }
                let token_text: String = chars[start..i].iter().collect();
                if token_text.len() > 1 {
                    match classify_token(&token_text) {
                        "issue" => {
                            let val = token_text[6..].to_string();
                            issues.push(val.clone());
                            tokens.push(GrammarToken::Issue(val));
                        }
                        "channel" => {
                            let val = if token_text.starts_with("@channel/") {
                                token_text[9..].to_string()
                            } else {
                                token_text[1..].to_string()
                            };
                            channels.push(val.clone());
                            tokens.push(GrammarToken::Channel(val));
                        }
                        _ => unreachable!(),
                    }
                } else {
                    tokens.push(GrammarToken::Text("@".to_string()));
                }
            }
        } else {
            let text_start = i;
            while i < chars.len() {
                let c = chars[i];
                if (c == '#' || c == '@') && should_enter_token_mode(text, i) {
                    break;
                }
                i += 1;
            }
            let text_segment: String = chars[text_start..i].iter().collect();
            tokens.push(GrammarToken::Text(text_segment));
        }
    }

    // Merge consecutive text tokens
    let mut merged: Vec<GrammarToken> = Vec::new();
    let mut current_text = String::new();

    for token in tokens {
        match token {
            GrammarToken::Text(s) => {
                current_text.push_str(&s);
            }
            other => {
                if !current_text.is_empty() {
                    merged.push(GrammarToken::Text(current_text.clone()));
                    current_text.clear();
                }
                merged.push(other);
            }
        }
    }
    if !current_text.is_empty() {
        merged.push(GrammarToken::Text(current_text));
    }

    // Build clean_body from text tokens only, collapsing runs of whitespace.
    let raw_body = merged
        .iter()
        .filter_map(|t| match t {
            GrammarToken::Text(s) => Some(s.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("");

    let mut clean_body = String::with_capacity(raw_body.len());
    let mut in_space = true; // start true so leading spaces are stripped
    for ch in raw_body.chars() {
        if ch.is_whitespace() {
            if !in_space {
                clean_body.push(' ');
                in_space = true;
            }
        } else {
            clean_body.push(ch);
            in_space = false;
        }
    }
    if clean_body.ends_with(' ') {
        clean_body.pop();
    }

    // Deduplicate tags while preserving order
    let mut seen = std::collections::HashSet::new();
    tags.retain(|t| seen.insert(t.clone()));

    ParsedNote {
        raw: text.to_string(),
        tokens: merged,
        tags,
        delays_ms,
        issues,
        channels,
        clean_body,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_string() {
        let parsed = parse_note("");
        assert!(parsed.tokens.is_empty());
        assert!(parsed.tags.is_empty());
        assert!(parsed.delays_ms.is_empty());
        assert!(parsed.issues.is_empty());
        assert!(parsed.channels.is_empty());
        assert_eq!(parsed.clean_body, "");
    }

    #[test]
    fn test_plain_text() {
        let parsed = parse_note("hello world");
        assert_eq!(parsed.tokens, vec![GrammarToken::Text("hello world".to_string())]);
        assert_eq!(parsed.clean_body, "hello world");
    }

    #[test]
    fn test_tag() {
        let parsed = parse_note("meeting notes #work");
        assert_eq!(parsed.tags, vec!["work"]);
        assert_eq!(parsed.clean_body, "meeting notes");
        assert_eq!(
            parsed.tokens,
            vec![
                GrammarToken::Text("meeting notes ".to_string()),
                GrammarToken::Tag("work".to_string()),
            ]
        );
    }

    #[test]
    fn test_multiple_tags() {
        let parsed = parse_note("alpha #foo #bar #foo");
        assert_eq!(parsed.tags, vec!["foo", "bar"]);
    }

    #[test]
    fn test_tag_case_normalization() {
        let parsed = parse_note("#WORK #Urgent");
        assert_eq!(parsed.tags, vec!["work", "urgent"]);
    }

    #[test]
    fn test_time_seconds() {
        let parsed = parse_note("remind me @10s");
        assert_eq!(parsed.delays_ms, vec![10_000]);
        assert_eq!(parsed.clean_body, "remind me");
        assert_eq!(
            parsed.tokens,
            vec![
                GrammarToken::Text("remind me ".to_string()),
                GrammarToken::Time {
                    raw: "@10s".to_string(),
                    amount: 10,
                    unit: 's',
                },
            ]
        );
    }

    #[test]
    fn test_time_minutes() {
        let parsed = parse_note("@5m reminder");
        assert_eq!(parsed.delays_ms, vec![300_000]);
    }

    #[test]
    fn test_time_hours() {
        let parsed = parse_note("meeting @2h now");
        assert_eq!(parsed.delays_ms, vec![7_200_000]);
    }

    #[test]
    fn test_time_days() {
        let parsed = parse_note("deadline @1d");
        assert_eq!(parsed.delays_ms, vec![86_400_000]);
    }

    #[test]
    fn test_time_uppercase_unit() {
        let parsed = parse_note("@10S");
        assert_eq!(parsed.delays_ms, vec![10_000]);
        assert_eq!(
            parsed.tokens[0],
            GrammarToken::Time {
                raw: "@10S".to_string(),
                amount: 10,
                unit: 's',
            }
        );
    }

    #[test]
    fn test_multiple_time_tokens() {
        let parsed = parse_note("@1m and @2h");
        assert_eq!(parsed.delays_ms, vec![60_000, 7_200_000]);
    }

    #[test]
    fn test_invalid_time_not_a_token() {
        let parsed = parse_note("email@example.com");
        assert!(parsed.delays_ms.is_empty());
        assert_eq!(parsed.tokens, vec![GrammarToken::Text("email@example.com".to_string())]);
    }

    #[test]
    fn test_issue_token() {
        let parsed = parse_note("fix @issue-123");
        assert_eq!(parsed.issues, vec!["-123"]);
        assert_eq!(
            parsed.tokens,
            vec![
                GrammarToken::Text("fix ".to_string()),
                GrammarToken::Issue("-123".to_string()),
            ]
        );
    }

    #[test]
    fn test_channel_token() {
        let parsed = parse_note("ask @channel/dev");
        assert_eq!(parsed.channels, vec!["dev"]);
        assert_eq!(
            parsed.tokens,
            vec![
                GrammarToken::Text("ask ".to_string()),
                GrammarToken::Channel("dev".to_string()),
            ]
        );
    }

    #[test]
    fn test_generic_mention_falls_to_channel() {
        let parsed = parse_note("ask @username");
        assert_eq!(parsed.channels, vec!["username"]);
        assert_eq!(
            parsed.tokens,
            vec![
                GrammarToken::Text("ask ".to_string()),
                GrammarToken::Channel("username".to_string()),
            ]
        );
    }

    #[test]
    fn test_complex_note() {
        let parsed = parse_note("deploy @10s #urgent @issue-42 ask @channel/dev");
        assert_eq!(parsed.delays_ms, vec![10_000]);
        assert_eq!(parsed.tags, vec!["urgent"]);
        assert_eq!(parsed.issues, vec!["-42"]);
        assert_eq!(parsed.channels, vec!["dev"]);
        assert_eq!(parsed.clean_body, "deploy ask");
    }

    #[test]
    fn test_token_characters() {
        let parsed = parse_note("#tag_with_underscore #tag/with/slash #tag-with-dash");
        assert_eq!(parsed.tags, vec!["tag_with_underscore", "tag/with/slash", "tag-with-dash"]);
    }

    #[test]
    fn test_no_token_after_boundary() {
        let parsed = parse_note("test ##notatag");
        assert_eq!(parsed.tags, vec!["notatag"]);
    }

    #[test]
    fn test_tag_at_start() {
        let parsed = parse_note("#start tag");
        assert_eq!(parsed.tags, vec!["start"]);
        assert_eq!(parsed.clean_body, "tag");
    }
}
