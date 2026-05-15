import { parseTokens, TOKEN_COLORS } from "@/lib/grammar";
import { useTheme } from "@/lib/theme/context";

export default function NoteText({ text }: { text: string }) {
  const { isDark } = useTheme();
  const tokens = parseTokens(text);

  const textColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";

  return (
    <>
      {tokens.map((token, i) => (
        <span
          key={i}
          style={{
            color:
              token.type === "text" ? textColor : TOKEN_COLORS[token.type],
          }}
        >
          {token.text}
        </span>
      ))}
    </>
  );
}
