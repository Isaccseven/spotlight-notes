import { sendNotification } from "@tauri-apps/plugin-notification";
import type { RouteMatch } from "./types";

export function openIssueAction(baseUrl = "https://github.com/issues"): (match: RouteMatch) => void {
  return (match) => {
    const issueTokens = match.tokens.filter((t) => t.type === "issue");
    for (const token of issueTokens) {
      const issueId = token.text.replace("@issue", "").trim();
      const url = issueId ? `${baseUrl}/${issueId}` : baseUrl;
      window.open(url, "_blank");
    }
  };
}

export function copyChannelMentionAction(): (match: RouteMatch) => void {
  return (match) => {
    const channelTokens = match.tokens.filter((t) => t.type === "channel");
    for (const token of channelTokens) {
      const channel = token.text.replace("@channel/", "").trim();
      if (channel) {
        navigator.clipboard.writeText(channel).catch(console.error);
        sendNotification({ title: "Spotlight Notes", body: `Copied #${channel} to clipboard` });
      }
    }
  };
}

export function showTagNotificationAction(): (match: RouteMatch) => void {
  return (match) => {
    const tags = match.tokens
      .filter((t) => t.type === "tag")
      .map((t) => t.text.slice(1));
    if (tags.length > 0) {
      sendNotification({
        title: "Spotlight Notes",
        body: `Note tagged: ${tags.join(", ")}`,
      });
    }
  };
}
