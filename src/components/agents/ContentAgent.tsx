"use client";

import type { Agent, ContentAgentData } from "@/types";
import ProgressBar from "@/components/ui/ProgressBar";

interface Props {
  agent: Agent;
}

const pipelineStatusColors = {
  draft: "#888",
  review: "#ffd700",
  ready: "#00ff88",
  published: "#00d4ff",
};

export default function ContentAgentPanel({ agent }: Props) {
  const data = agent.data as ContentAgentData;

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Publish readiness */}
      <ProgressBar
        value={data.publishReadiness}
        color={agent.color}
        label="Publish Readiness"
        height="h-2"
      />

      {/* Campaign + stats */}
      <div className="rounded p-2" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-0.5">Active Campaign</div>
        <div className="text-[11px] font-mono font-bold" style={{ color: agent.color }}>{data.activeCampaign}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded p-1.5 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-sm font-mono font-bold" style={{ color: agent.color }}>{data.draftsCreated}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Drafts</div>
        </div>
        <div className="rounded p-1.5 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-sm font-mono font-bold" style={{ color: agent.color }}>{data.wordCount.toLocaleString()}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Words</div>
        </div>
      </div>

      {/* Tone */}
      <div className="text-[9px] font-mono text-center py-1 rounded" style={{ color: `${agent.color}99`, background: `${agent.color}08` }}>
        {data.tone}
      </div>

      {/* Content pipeline */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Content Pipeline</div>
        <div className="space-y-1">
          {data.contentPipeline.map((item, i) => {
            const pColor = pipelineStatusColors[item.status];
            return (
              <div key={i} className="flex items-center gap-2 py-0.5" style={{ borderBottom: `1px solid ${agent.color}08` }}>
                <span className="text-[9px] font-mono flex-shrink-0" style={{ color: pColor }}>
                  {item.status === "ready" ? "✓" : item.status === "published" ? "▲" : "○"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono text-gray-300 truncate block">{item.title}</span>
                  <span className="text-[9px] font-mono text-gray-600">{item.type}</span>
                </div>
                <span className="text-[9px] font-mono flex-shrink-0" style={{ color: pColor }}>{item.status.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent ideas */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Idea Feed</div>
        <div className="space-y-1">
          {data.recentIdeas.map((idea, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[9px] flex-shrink-0 mt-0.5" style={{ color: agent.color }}>✦</span>
              <span className="text-[10px] font-mono text-gray-300 leading-tight">{idea}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
