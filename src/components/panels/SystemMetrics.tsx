"use client";

import type { SystemMetrics } from "@/types";
import ProgressBar from "@/components/ui/ProgressBar";

interface Props {
  metrics: SystemMetrics;
}

export default function SystemMetricsPanel({ metrics }: Props) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(8,15,30,0.95) 0%, rgba(5,10,20,0.98) 100%)",
        border: "1px solid rgba(0,255,195,0.15)",
        boxShadow: "0 0 20px rgba(0,255,195,0.05)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid rgba(0,255,195,0.1)" }}
      >
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#00ffc3", boxShadow: "0 0 6px #00ffc3" }} />
        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-widest">System Metrics</h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Primary stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded p-2.5 text-center" style={{ background: "rgba(0,255,195,0.05)", border: "1px solid rgba(0,255,195,0.15)" }}>
            <div className="text-xl font-mono font-bold text-teal-300">{metrics.totalTasksToday}</div>
            <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Tasks Today</div>
          </div>
          <div className="rounded p-2.5 text-center" style={{ background: "rgba(0,255,195,0.05)", border: "1px solid rgba(0,255,195,0.15)" }}>
            <div className="text-xl font-mono font-bold" style={{ color: "#00ffc3" }}>{metrics.productivityScore}%</div>
            <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Productivity</div>
          </div>
        </div>

        {/* Usage bars */}
        <div className="space-y-2.5">
          <ProgressBar value={metrics.cpuUsage} color="#00d4ff" label="CPU Usage" height="h-1.5" />
          <ProgressBar value={metrics.memoryUsage} color="#7c3aed" label="Memory" height="h-1.5" />
        </div>

        {/* Metric rows */}
        <div className="space-y-1.5">
          {[
            { label: "Avg Response", value: `${metrics.avgResponseTime}ms`, color: "#00d4ff" },
            { label: "Active Workflows", value: metrics.activeWorkflows, color: "#ff6b00" },
            { label: "Data Throughput", value: `${(metrics.dataThoughput / 1000).toFixed(1)}k/s`, color: "#00ffc3" },
            { label: "Network Latency", value: `${metrics.networkLatency}ms`, color: "#00ff88" },
          ].map((m) => (
            <div key={m.label} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-[10px] font-mono text-gray-500">{m.label}</span>
              <span className="text-[10px] font-mono font-bold" style={{ color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
