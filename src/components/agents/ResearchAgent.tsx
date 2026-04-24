"use client";

import type { Agent, ResearchAgentData } from "@/types";
import ProgressBar from "@/components/ui/ProgressBar";

interface Props {
  agent: Agent;
}

export default function ResearchAgentPanel({ agent }: Props) {
  const data = agent.data as ResearchAgentData;

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Confidence score */}
      <div>
        <ProgressBar
          value={data.confidenceScore}
          color={agent.color}
          label="Confidence Score"
          height="h-2"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded p-2 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-base font-mono font-bold" style={{ color: agent.color }}>{data.sourcesScanned.toLocaleString()}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Sources</div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-base font-mono font-bold" style={{ color: agent.color }}>{data.documentsAnalyzed}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Documents</div>
        </div>
      </div>

      {/* Active query */}
      <div className="rounded p-2" style={{ background: `${agent.color}06`, border: `1px solid ${agent.color}15` }}>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1">Active Query</div>
        <div className="text-[10px] font-mono" style={{ color: agent.color }}>
          &quot;{data.currentQuery}&quot;
        </div>
      </div>

      {/* Active sources */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Live Sources</div>
        <div className="flex flex-wrap gap-1">
          {data.activeSources.map((src) => (
            <span
              key={src}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25`, color: `${agent.color}cc` }}
            >
              {src}
            </span>
          ))}
        </div>
      </div>

      {/* Recent findings */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Recent Findings</div>
        <div className="space-y-1">
          {data.recentFindings.map((finding, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[9px] mt-0.5 flex-shrink-0" style={{ color: agent.color }}>◆</span>
              <span className="text-[10px] font-mono text-gray-300 leading-tight">{finding}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Keywords</div>
        <div className="flex flex-wrap gap-1">
          {data.keywords.map((kw) => (
            <span
              key={kw}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: `${agent.color}15`, color: agent.color }}
            >
              #{kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
