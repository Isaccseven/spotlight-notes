import { parseTokens, TOKEN_COLORS } from "@/lib/grammar";
import { useTheme } from "@/lib/theme/context";

interface Props {
  text: string;
  onTagClick?: (tag: string) => void;
  onIssueClick?: (issue: string) => void;
  onChannelClick?: (channel: string) => void;
  onTimeClick?: (time: string) => void;
}

export default function NoteText({
  text,
  onTagClick,
  onIssueClick,
  onChannelClick,
  onTimeClick,
}: Props) {
  const { isDark } = useTheme();
  const tokens = parseTokens(text);

  const textColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";

  return (
    <>
      {tokens.map((token, i) => {
        const isText = token.type === "text";
        const color = isText ? textColor : TOKEN_COLORS[token.type];

        const handleClick = () => {
          if (token.type === "tag" && onTagClick) {
            onTagClick(token.text.slice(1));
          } else if (token.type === "issue" && onIssueClick) {
            onIssueClick(token.text);
          } else if (token.type === "channel" && onChannelClick) {
            onChannelClick(token.text);
          } else if (token.type === "time" && onTimeClick) {
            onTimeClick(token.text);
          }
        };

        const clickable =
          !isText &&
          ((token.type === "tag" && onTagClick) ||
            (token.type === "issue" && onIssueClick) ||
            (token.type === "channel" && onChannelClick) ||
            (token.type === "time" && onTimeClick));

        return (
          <span
            key={i}
            onClick={handleClick}
            className={clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : undefined}
            style={{ color }}
            title={clickable ? `Click to ${token.type}` : undefined}
          >
            {token.text}
          </span>
        );
      })}
    </>
  );
}
