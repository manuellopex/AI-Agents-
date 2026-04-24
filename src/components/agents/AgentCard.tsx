"use client";

import { useState } from "react";
import type { Agent } from "@/types";
import StatusIndicator from "@/components/ui/StatusIndicator";
import ProgressBar from "@/components/ui/ProgressBar";
import RobotAvatar from "@/components/ui/RobotAvatar";
import ResearchAgentPanel from "./ResearchAgent";
import CodingAgentPanel from "./CodingAgent";
import BrowsingAgentPanel from "./BrowsingAgent";
import AutomationAgentPanel from "./AutomationAgent";
import ContentAgentPanel from "./ContentAgent";

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Props {
  agent: Agent;
}

export default function AgentCard({ agent }: Props) {
  const [activeTab, setActiveTab] = useState<"status" | "logs" | "details">("status");

  const panels = {
    research: ResearchAgentPanel,
    coding: CodingAgentPanel,
    browsing: BrowsingAgentPanel,
    automation: AutomationAgentPanel,
    content: ContentAgentPanel,
  };
  const SpecializedPanel = panels[agent.id];

  return (
    <div
      className="relative rounded-xl overflow-hidden flex flex-col h-full group"
      style={{
        background: "linear-gradient(135deg, rgba(8,15,30,0.95) 0%, rgba(5,10,20,0.98) 100%)",
        border: `1px solid ${agent.color}25`,
        boxShadow: `0 0 30px ${agent.glowColor}15, 0 4px 20px rgba(0,0,0,0.5)`,
        transition: "box-shadow 0.3s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${agent.glowColor}30, 0 8px 30px rgba(0,0,0,0.6)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${agent.glowColor}15, 0 4px 20px rgba(0,0,0,0.5)`;
      }}
    >
      {/* Animated top border */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }}
      />

      {/* Corner accents */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t border-l" style={{ borderColor: agent.color }} />
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r" style={{ borderColor: agent.color }} />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l" style={{ borderColor: agent.color }} />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r" style={{ borderColor: agent.color }} />

      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${agent.color}15` }}>
        <div className="flex items-start gap-3">
          <RobotAvatar agentId={agent.id} color={agent.color} size={52} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold tracking-wide text-white truncate">{agent.name}</h3>
              <StatusIndicator status={agent.status} size="sm" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: `${agent.color}99` }}>
              {agent.purpose}
            </p>

            {/* Progress */}
            <ProgressBar value={agent.progress} color={agent.color} height="h-1" showValue={false} />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] font-mono text-gray-500">PROGRESS</span>
              <span className="text-[9px] font-mono font-bold" style={{ color: agent.color }}>{agent.progress}%</span>
            </div>
          </div>
        </div>

        {/* Current task */}
        <div
          className="mt-2 px-2 py-1.5 rounded text-[10px] font-mono flex items-center gap-2"
          style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: agent.color }} />
          <span className="text-gray-300 truncate">{agent.currentTask}</span>
        </div>
      </div>

      {/* Quick metrics row */}
      <div className="grid grid-cols-4 divide-x divide-white/5" style={{ borderBottom: `1px solid ${agent.color}15` }}>
        {[
          { label: "EFF", value: `${agent.metrics.efficiency}%` },
          { label: "DONE", value: agent.metrics.tasksCompleted },
          { label: "QUEUE", value: agent.metrics.tasksQueued },
          { label: "SPD", value: `${agent.metrics.processingSpeed}` },
        ].map((m) => (
          <div key={m.label} className="py-2 text-center" style={{ borderColor: `${agent.color}15` }}>
            <div className="text-[11px] font-mono font-bold" style={{ color: agent.color }}>{m.value}</div>
            <div className="text-[8px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: `1px solid ${agent.color}15` }}>
        {(["status", "logs", "details"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-1.5 text-[9px] font-mono uppercase tracking-widest transition-all"
            style={{
              color: activeTab === tab ? agent.color : "#666",
              borderBottom: activeTab === tab ? `2px solid ${agent.color}` : "2px solid transparent",
              background: activeTab === tab ? `${agent.color}08` : "transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "status" && <SpecializedPanel agent={agent} />}

        {activeTab === "logs" && (
          <div className="h-full overflow-y-auto p-3 space-y-1.5">
            {agent.activityLog.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span
                  className="text-[9px] font-mono mt-0.5 flex-shrink-0"
                  style={{
                    color: log.type === "success" ? "#00ff88" : log.type === "warning" ? "#ffd700" : log.type === "error" ? "#ff2d55" : "#666"
                  }}
                >
                  {log.type === "success" ? "✓" : log.type === "warning" ? "⚠" : log.type === "error" ? "✗" : "›"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-gray-300 leading-tight">{log.message}</p>
                  <p className="text-[9px] font-mono text-gray-600 mt-0.5">{formatTime(log.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "details" && (
          <div className="h-full p-3 space-y-2">
            <div className="space-y-1.5">
              {[
                { label: "Uptime", value: formatUptime(agent.metrics.uptime) },
                { label: "Efficiency", value: `${agent.metrics.efficiency}%` },
                { label: "Tasks Done", value: agent.metrics.tasksCompleted },
                { label: "Queue", value: `${agent.metrics.tasksQueued} pending` },
                { label: "Speed", value: `${agent.metrics.processingSpeed} ops/s` },
                { label: "Last Update", value: formatTime(agent.metrics.lastUpdate) },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1" style={{ borderBottom: `1px solid ${agent.color}10` }}>
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{item.label}</span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: agent.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
