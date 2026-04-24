"use client";

import type { GlobalActivity } from "@/types";

const agentColors: Record<string, string> = {
  research: "#00d4ff",
  coding: "#00ff88",
  browsing: "#7c3aed",
  automation: "#ff6b00",
  content: "#00ffc3",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

interface Props {
  activities: GlobalActivity[];
}

export default function GlobalActivityFeed({ activities }: Props) {
  return (
    <div
      className="rounded-xl flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(8,15,30,0.95) 0%, rgba(5,10,20,0.98) 100%)",
        border: "1px solid rgba(0,212,255,0.15)",
        boxShadow: "0 0 20px rgba(0,212,255,0.05)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: "0 0 6px #00d4ff" }} />
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-widest">Activity Feed</h3>
        </div>
        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{activities.length} events</span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
        {activities.map((activity) => {
          const color = agentColors[activity.agentId] || "#00d4ff";
          const typeColor = activity.type === "success" ? "#00ff88" : activity.type === "warning" ? "#ffd700" : activity.type === "error" ? "#ff2d55" : "#00d4ff";
          return (
            <div
              key={activity.id}
              className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Agent badge */}
              <div
                className="flex-shrink-0 mt-0.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
              >
                {activity.agentName.toUpperCase().slice(0, 3)}
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-gray-300 leading-tight">{activity.message}</p>
              </div>

              {/* Time + indicator */}
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor, boxShadow: `0 0 4px ${typeColor}` }} />
                <span className="text-[9px] font-mono text-gray-600">{timeAgo(activity.timestamp)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
