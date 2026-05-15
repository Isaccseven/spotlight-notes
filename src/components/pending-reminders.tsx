import { ScheduledNotification } from "@/types/notification";

interface Props {
  reminders: ScheduledNotification[];
  onCancel: (id: string) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PendingReminders({ reminders, onCancel }: Props) {
  if (reminders.length === 0) return null;

  return (
    <div className="border-t border-white/10 px-5 py-2 max-h-32 overflow-y-auto">
      <h3 className="text-white/50 text-xs uppercase tracking-wider mb-1.5">
        Pending Reminders
      </h3>
      {reminders.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 py-1 group"
        >
          <span className="w-1 h-1 rounded-full bg-amber-400/70 flex-shrink-0" />
          <span className="flex-1 text-white/70 text-sm leading-snug truncate">
            {r.body}
          </span>
          <span className="text-white/40 text-xs flex-shrink-0">
            {formatTime(r.trigger_at)}
          </span>
          <button
            onClick={() => onCancel(r.id)}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-all text-white/60 text-xs"
            aria-label="Cancel reminder"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
