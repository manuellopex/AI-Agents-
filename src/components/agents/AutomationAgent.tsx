"use client";

import type { Agent, AutomationAgentData } from "@/types";
import ProgressBar from "@/components/ui/ProgressBar";

interface Props {
  agent: Agent;
}

const taskStatusColors = {
  done: "#00ff88",
  active: "#ff6b00",
  pending: "#444",
  error: "#ff2d55",
};

export default function AutomationAgentPanel({ agent }: Props) {
  const data = agent.data as AutomationAgentData;

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Success rate */}
      <ProgressBar
        value={Math.round(data.successRate)}
        color={agent.color}
        label="Success Rate"
        height="h-2"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "Workflows", value: data.activeWorkflows },
          { label: "Triggers", value: data.triggersFired },
          { label: "Systems", value: data.connectedSystems.length },
        ].map((s) => (
          <div key={s.label} className="rounded p-1.5 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
            <div className="text-sm font-mono font-bold" style={{ color: agent.color }}>{s.value}</div>
            <div className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active pipeline */}
      <div className="rounded p-2" style={{ background: `${agent.color}06`, border: `1px solid ${agent.color}15` }}>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1">Active Pipeline</div>
        <div className="text-[10px] font-mono leading-tight" style={{ color: agent.color }}>{data.activePipeline}</div>
      </div>

      {/* Task chain */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Task Chain</div>
        <div className="space-y-1">
          {data.taskChain.map((task, i) => {
            const tColor = taskStatusColors[task.status];
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: tColor,
                    boxShadow: task.status === "active" ? `0 0 6px ${tColor}` : "none",
                    animation: task.status === "active" ? "pulse 1.5s infinite" : "none",
                  }}
                />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-300">{task.name}</span>
                  <span className="text-[9px] font-mono" style={{ color: tColor }}>{task.status.toUpperCase()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected systems */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Connected Systems</div>
        <div className="flex flex-wrap gap-1">
          {data.connectedSystems.map((sys) => (
            <span
              key={sys}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25`, color: `${agent.color}cc` }}
            >
              {sys}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
