import { useTelemetry } from "@/lib/telemetry/use-telemetry";
import { DailyStats, WeeklyStats } from "@/lib/telemetry/types";

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  const display =
    value == null ? "—" : typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-1">
      <span className="text-white/40 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-white text-lg font-semibold tabular-nums">
        {display}
        {unit ? <span className="text-white/50 text-sm ml-1">{unit}</span> : null}
      </span>
    </div>
  );
}

function DailySection({ stats }: { stats: DailyStats }) {
  return (
    <div className="space-y-2">
      <h3 className="text-white/60 text-sm font-medium">Today</h3>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Captures" value={stats.captures} />
        <StatCard label="Shortcuts" value={stats.shortcutTriggers} />
        <StatCard
          label="Avg Capture Time"
          value={stats.avgCaptureMs}
          unit="ms"
        />
        <StatCard label="Sessions" value={stats.sessions} />
        <StatCard label="Reminders Scheduled" value={stats.remindersScheduled} />
        <StatCard label="Reminders Fired" value={stats.remindersFired} />
      </div>
    </div>
  );
}

function WeeklySection({ stats }: { stats: WeeklyStats }) {
  return (
    <div className="space-y-2">
      <h3 className="text-white/60 text-sm font-medium">
        Week ({stats.startDate} – {stats.endDate})
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Captures" value={stats.captures} />
        <StatCard label="Shortcuts" value={stats.shortcutTriggers} />
        <StatCard
          label="Avg Capture Time"
          value={stats.avgCaptureMs}
          unit="ms"
        />
        <StatCard label="Sessions" value={stats.sessions} />
        <StatCard
          label="Repeat Capture Rate"
          value={stats.repeatCaptureRate}
          unit="%"
        />
        <StatCard
          label="Reminder Completion"
          value={stats.reminderCompletionRate}
          unit="%"
        />
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function TelemetryDashboard({ onClose }: Props) {
  const { loading, daily, weekly, totalCaptures, totalShortcuts, refresh } =
    useTelemetry();

  return (
    <div data-modal className="px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold">Your Stats</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="text-white/40 hover:text-white text-xs uppercase tracking-wider transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total Captures" value={totalCaptures} />
            <StatCard label="Total Shortcuts" value={totalShortcuts} />
          </div>
          <DailySection stats={daily} />
          <WeeklySection stats={weekly} />
        </>
      )}
    </div>
  );
}
