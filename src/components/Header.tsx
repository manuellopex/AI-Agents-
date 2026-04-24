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
  const errorCount = agents.filter((a) => a.status === "error").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.metrics.tasksQueued, 0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
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
      {/* Animated top line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #00d4ff, #7c3aed, #00d4ff, transparent)" }} />

      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Branding */}
          <div className="flex items-center gap-4">
            {/* Logo mark */}
            <div className="relative">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))",
                  border: "1px solid rgba(0,212,255,0.3)",
                  boxShadow: "0 0 20px rgba(0,212,255,0.2)",
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                  <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" fill="none" stroke="#00d4ff" strokeWidth="1.5"/>
                  <polygon points="12,6 18,9 18,15 12,18 6,15 6,9" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" strokeWidth="1"/>
                  <circle cx="12" cy="12" r="2" fill="#00d4ff"/>
                </svg>
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: "0 0 6px #00d4ff" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-[0.15em] text-white uppercase" style={{ letterSpacing: "0.2em" }}>
                Mission Control
              </h1>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400/70">
                Real-Time AI Agent Operations
              </p>
            </div>
          </div>

          {/* Center: Status indicators */}
          <div className="hidden lg:flex items-center gap-6">
            {[
              { label: "Active Agents", value: activeCount, color: "#00ff88", max: 5 },
              { label: "Tasks Queued", value: totalTasks, color: "#00d4ff", max: null },
              { label: "Tasks Today", value: metrics.totalTasksToday, color: "#00ffc3", max: null },
              { label: "Alerts", value: errorCount, color: errorCount > 0 ? "#ff2d55" : "#666", max: null },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-xl font-mono font-bold" style={{ color: item.color, textShadow: `0 0 10px ${item.color}60` }}>
                  {item.max ? `${item.value}/${item.max}` : item.value}
                </div>
                <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{item.label}</div>
              </div>
            ))}

            {/* System status */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded"
              style={{
                background: systemPaused ? "rgba(255,45,85,0.1)" : "rgba(0,255,136,0.08)",
                border: `1px solid ${systemPaused ? "rgba(255,45,85,0.3)" : "rgba(0,255,136,0.25)"}`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor: systemPaused ? "#ff2d55" : "#00ff88",
                  boxShadow: `0 0 6px ${systemPaused ? "#ff2d55" : "#00ff88"}`,
                }}
              />
              <span className="text-[10px] font-mono font-bold" style={{ color: systemPaused ? "#ff2d55" : "#00ff88" }}>
                {systemPaused ? "PAUSED" : "LIVE"}
              </span>
            </div>
          </div>

          {/* Right: Controls + clock */}
          <div className="flex items-center gap-3">
            {/* Clock */}
            <div className="hidden md:block text-right">
              <div className="text-sm font-mono font-bold text-cyan-300">{timeStr}</div>
              <div className="text-[9px] font-mono text-gray-500">{dateStr}</div>
            </div>

            {/* Control buttons */}
            <div className="flex gap-2">
              <button
                onClick={onStartAll}
                className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105"
                style={{
                  background: "rgba(0,255,136,0.1)",
                  border: "1px solid rgba(0,255,136,0.3)",
                  color: "#00ff88",
                  boxShadow: "0 0 10px rgba(0,255,136,0.1)",
                }}
              >
                Start All
              </button>
              <button
                onClick={onPauseAll}
                className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105"
                style={{
                  background: "rgba(255,215,0,0.1)",
                  border: "1px solid rgba(255,215,0,0.3)",
                  color: "#ffd700",
                }}
              >
                Pause
              </button>
              <button
                onClick={onEmergencyStop}
                className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105"
                style={{
                  background: "rgba(255,45,85,0.1)",
                  border: "1px solid rgba(255,45,85,0.3)",
                  color: "#ff2d55",
                  boxShadow: "0 0 10px rgba(255,45,85,0.1)",
                }}
              >
                E-STOP
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
