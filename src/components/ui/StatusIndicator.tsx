"use client";

import type { AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { label: string; color: string; bg: string; pulse: boolean }> = {
  active:    { label: "ACTIVE",     color: "#00ff88", bg: "rgba(0,255,136,0.15)",   pulse: true },
  idle:      { label: "IDLE",       color: "#888aaa", bg: "rgba(136,138,170,0.15)", pulse: false },
  thinking:  { label: "THINKING",   color: "#ffd700", bg: "rgba(255,215,0,0.15)",   pulse: true },
  executing: { label: "EXECUTING",  color: "#00d4ff", bg: "rgba(0,212,255,0.15)",   pulse: true },
  error:     { label: "ERROR",      color: "#ff2d55", bg: "rgba(255,45,85,0.15)",   pulse: true },
  completed: { label: "COMPLETED",  color: "#00ffc3", bg: "rgba(0,255,195,0.15)",   pulse: false },
};

interface Props {
  status: AgentStatus;
  size?: "sm" | "md";
}

export default function StatusIndicator({ status, size = "md" }: Props) {
  const cfg = statusConfig[status];
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const px = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm font-mono font-bold tracking-widest ${textSize} ${px}`}
      style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.color}40` }}
    >
      <span
        className={`${dotSize} rounded-full ${cfg.pulse ? "animate-pulse" : ""}`}
        style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
      />
      {cfg.label}
    </span>
  );
}
