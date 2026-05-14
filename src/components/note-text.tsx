const DELAY_PATTERN = /(@\d+[smhd])/i;

interface Part {
  text: string;
  isDelay: boolean;
}

function parseParts(text: string): Part[] {
  return text
    .split(DELAY_PATTERN)
    .map((part) => ({ text: part, isDelay: DELAY_PATTERN.test(part) }));
}

export default function NoteText({ text }: { text: string }) {
  const parts = parseParts(text);

  return (
    <>
      {parts.map((part, i) =>
        part.isDelay ? (
          <span key={i} style={{ color: "#f07167" }}>
            {part.text}
          </span>
        ) : (
          <span key={i} style={{ color: "rgba(255,255,255,0.8)" }}>{part.text}</span>
        )
      )}
    </>
  );
}
