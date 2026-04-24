"use client";

import type { Alert } from "@/types";

const severityConfig = {
  info: { color: "#00d4ff", icon: "ℹ", bg: "rgba(0,212,255,0.08)" },
  warning: { color: "#ffd700", icon: "⚠", bg: "rgba(255,215,0,0.08)" },
  critical: { color: "#ff2d55", icon: "✗", bg: "rgba(255,45,85,0.08)" },
  success: { color: "#00ff88", icon: "✓", bg: "rgba(0,255,136,0.08)" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

interface Props {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

export default function AlertsPanel({ alerts, onDismiss }: Props) {
  const unread = alerts.filter((a) => !a.read);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(8,15,30,0.95) 0%, rgba(5,10,20,0.98) 100%)",
        border: "1px solid rgba(255,215,0,0.12)",
        boxShadow: "0 0 20px rgba(255,215,0,0.04)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,215,0,0.08)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" style={{ boxShadow: "0 0 6px #ffd700" }} />
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-widest">Alerts</h3>
        </div>
        {unread.length > 0 && (
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
            style={{ color: "#ffd700", background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)" }}
          >
            {unread.length} NEW
          </span>
        )}
      </div>

      <div className="overflow-y-auto max-h-64">
        {alerts.map((alert) => {
          const cfg = severityConfig[alert.severity];
          return (
            <div
              key={alert.id}
              className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                opacity: alert.read ? 0.5 : 1,
              }}
              onClick={() => onDismiss(alert.id)}
            >
              <span className="flex-shrink-0 text-sm" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-gray-300 leading-tight">{alert.message}</p>
                <p className="text-[9px] font-mono text-gray-600 mt-0.5">{timeAgo(alert.timestamp)}</p>
              </div>
              {!alert.read && (
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
