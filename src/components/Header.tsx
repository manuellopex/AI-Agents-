"use client";

import { useState, useEffect } from "react";
import type { Agent, SystemMetrics } from "@/types";

interface Props {
  agents: Agent[];
  metrics: SystemMetrics;
  onStartAll: () => void;
  onPauseAll: () => void;
  onEmergencyStop: () => void;
  systemPaused: boolean;
}

export default function Header({ agents, metrics, onStartAll, onPauseAll, onEmergencyStop, systemPaused }: Props) {
  const [now, setNow] = useState(new Date());
  const activeCount = agents.filter((a) => a.status !== "idle" && a.status !== "error").length;
  const errorCount  = agents.filter((a) => a.status === "error").length;
  const totalTasks  = agents.reduce((sum, a) => sum + a.metrics.tasksQueued, 0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

  return (
    <header
      className="relative flex-shrink-0"
      style={{
        background: "linear-gradient(180deg, rgba(5,10,20,0.98) 0%, rgba(8,15,30,0.95) 100%)",
        borderBottom: "1px solid rgba(0,212,255,0.15)",
        boxShadow: "0 4px 30px rgba(0,0,0,0.5), 0 1px 0 rgba(0,212,255,0.1)",
      }}
    >
      {/* Top accent line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #00d4ff, #7c3aed, #00d4ff, transparent)" }} />

      {/* ─── Mobile layout (< sm) ─────────────────────────────────── */}
      <div className="sm:hidden px-3 py-2 space-y-2">
        {/* Row 1: brand + live badge + e-stop */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LogoMark />
            <div>
              <h1 className="text-sm font-bold tracking-widest text-white uppercase">Mission Control</h1>
              <p className="text-[9px] font-mono text-cyan-400/70 uppercase tracking-widest hidden xs:block">AI Agent Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LiveBadge paused={systemPaused} />
            <button onClick={onEmergencyStop} className="px-2 py-1 rounded text-[10px] font-mono font-bold uppercase" style={{ background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.4)", color: "#ff2d55" }}>
              STOP
            </button>
          </div>
        </div>
        {/* Row 2: stats strip + controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <StatPill label="Agents" value={`${activeCount}/5`} color="#00ff88" />
            <StatPill label="Queue" value={totalTasks} color="#00d4ff" />
            <StatPill label="Today" value={metrics.totalTasksToday} color="#00ffc3" />
            {errorCount > 0 && <StatPill label="Err" value={errorCount} color="#ff2d55" />}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onStartAll} className="px-2 py-1 rounded text-[9px] font-mono font-bold uppercase" style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)", color: "#00ff88" }}>Start</button>
            <button onClick={onPauseAll} className="px-2 py-1 rounded text-[9px] font-mono font-bold uppercase" style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#ffd700" }}>Pause</button>
          </div>
        </div>
      </div>

      {/* ─── Tablet layout (sm – lg) ─────────────────────────────── */}
      <div className="hidden sm:flex lg:hidden items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <h1 className="text-base font-bold tracking-widest text-white uppercase">Mission Control</h1>
            <p className="text-[9px] font-mono text-cyan-400/70 uppercase tracking-widest">Real-Time AI Agent Operations</p>
          </div>
        </div>
        {/* Stats */}
        <div className="flex items-center gap-4">
          <StatBlock label="Active" value={`${activeCount}/5`} color="#00ff88" />
          <StatBlock label="Queue"  value={totalTasks}        color="#00d4ff" />
          <StatBlock label="Today"  value={metrics.totalTasksToday} color="#00ffc3" />
          <LiveBadge paused={systemPaused} />
        </div>
        {/* Controls + clock */}
        <div className="flex items-center gap-2">
          <div className="text-right mr-1">
            <div className="text-xs font-mono font-bold text-cyan-300">{timeStr}</div>
            <div className="text-[9px] font-mono text-gray-500">{dateStr}</div>
          </div>
          <button onClick={onStartAll}      className="px-2.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase" style={{ background: "rgba(0,255,136,0.1)",  border: "1px solid rgba(0,255,136,0.3)",  color: "#00ff88" }}>Start</button>
          <button onClick={onPauseAll}      className="px-2.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase" style={{ background: "rgba(255,215,0,0.1)",   border: "1px solid rgba(255,215,0,0.3)",  color: "#ffd700" }}>Pause</button>
          <button onClick={onEmergencyStop} className="px-2.5 py-1.5 rounded text-[10px] font-mono font-bold uppercase" style={{ background: "rgba(255,45,85,0.1)",   border: "1px solid rgba(255,45,85,0.3)",  color: "#ff2d55" }}>E-STOP</button>
        </div>
      </div>

      {/* ─── Desktop layout (lg+) ─────────────────────────────────── */}
      <div className="hidden lg:flex items-center justify-between gap-4 px-6 py-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <LogoMark />
          <div>
            <h1 className="text-lg font-bold tracking-[0.15em] text-white uppercase">Mission Control</h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400/70">Real-Time AI Agent Operations</p>
          </div>
        </div>

        {/* Center stats */}
        <div className="flex items-center gap-6">
          {[
            { label: "Active Agents",  value: `${activeCount}/5`,           color: "#00ff88" },
            { label: "Tasks Queued",   value: totalTasks,                   color: "#00d4ff" },
            { label: "Tasks Today",    value: metrics.totalTasksToday,      color: "#00ffc3" },
            { label: "Alerts",         value: errorCount, color: errorCount > 0 ? "#ff2d55" : "#666" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-xl font-mono font-bold" style={{ color: item.color, textShadow: `0 0 10px ${item.color}60` }}>
                {item.value}
              </div>
              <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{item.label}</div>
            </div>
          ))}
          <LiveBadge paused={systemPaused} />
        </div>

        {/* Right: clock + buttons */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-cyan-300">{timeStr}</div>
            <div className="text-[9px] font-mono text-gray-500">{dateStr}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={onStartAll}      className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ background: "rgba(0,255,136,0.1)",  border: "1px solid rgba(0,255,136,0.3)",  color: "#00ff88",  boxShadow: "0 0 10px rgba(0,255,136,0.1)" }}>Start All</button>
            <button onClick={onPauseAll}      className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ background: "rgba(255,215,0,0.1)",   border: "1px solid rgba(255,215,0,0.3)",  color: "#ffd700" }}>Pause</button>
            <button onClick={onEmergencyStop} className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ background: "rgba(255,45,85,0.1)",   border: "1px solid rgba(255,45,85,0.3)",  color: "#ff2d55",  boxShadow: "0 0 10px rgba(255,45,85,0.1)" }}>E-STOP</button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── Shared sub-components ─────────────────────────────────────── */

function LogoMark() {
  return (
    <div className="relative flex-shrink-0">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))", border: "1px solid rgba(0,212,255,0.3)", boxShadow: "0 0 20px rgba(0,212,255,0.2)" }}>
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 sm:w-6 sm:h-6">
          <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" fill="none" stroke="#00d4ff" strokeWidth="1.5"/>
          <polygon points="12,6 18,9 18,15 12,18 6,15 6,9" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" strokeWidth="1"/>
          <circle cx="12" cy="12" r="2" fill="#00d4ff"/>
        </svg>
      </div>
      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: "0 0 6px #00d4ff" }} />
    </div>
  );
}

function LiveBadge({ paused }: { paused: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={{ background: paused ? "rgba(255,45,85,0.1)" : "rgba(0,255,136,0.08)", border: `1px solid ${paused ? "rgba(255,45,85,0.3)" : "rgba(0,255,136,0.25)"}` }}>
      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: paused ? "#ff2d55" : "#00ff88", boxShadow: `0 0 6px ${paused ? "#ff2d55" : "#00ff88"}` }} />
      <span className="text-[10px] font-mono font-bold" style={{ color: paused ? "#ff2d55" : "#00ff88" }}>{paused ? "PAUSED" : "LIVE"}</span>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-mono font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-mono font-bold" style={{ color, textShadow: `0 0 10px ${color}60` }}>{value}</div>
      <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
