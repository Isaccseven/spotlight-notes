import { parseTokens } from "@/lib/grammar";

interface Props {
  text: string;
}

export default function NoteBadges({ text }: Props) {
  const tokens = parseTokens(text);
  const issues = tokens.filter((t) => t.type === "issue").map((t) => t.text);
  const channels = tokens.filter((t) => t.type === "channel").map((t) => t.text);
  const times = tokens.filter((t) => t.type === "time").map((t) => t.text);

  if (issues.length === 0 && channels.length === 0 && times.length === 0) {
    return null;
  }

  return (
    <span className="flex items-center gap-1.5 flex-shrink-0">
      {issues.map((issue) => (
        <span
          key={issue}
          className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400/80"
          title="Issue"
        >
          {issue}
        </span>
      ))}
      {channels.map((ch) => (
        <span
          key={ch}
          className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400/80"
          title="Channel"
        >
          {ch}
        </span>
      ))}
      {times.map((t) => (
        <span
          key={t}
          className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400/80"
          title="Reminder"
        >
          {t}
        </span>
      ))}
    </span>
  );
}
