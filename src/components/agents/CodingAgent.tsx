"use client";

import type { Agent, CodingAgentData } from "@/types";

interface Props {
  agent: Agent;
}

const buildStatusConfig = {
  passing: { label: "PASSING", color: "#00ff88" },
  failing: { label: "FAILING", color: "#ff2d55" },
  building: { label: "BUILDING", color: "#ffd700" },
  idle: { label: "IDLE", color: "#666" },
};

export default function CodingAgentPanel({ agent }: Props) {
  const data = agent.data as CodingAgentData;
  const buildCfg = buildStatusConfig[data.buildStatus];

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Build status + active file */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
            style={{ color: buildCfg.color, background: `${buildCfg.color}15`, border: `1px solid ${buildCfg.color}30` }}
          >
            BUILD: {buildCfg.label}
          </span>
        </div>
        <div className="flex gap-1.5">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25`, color: `${agent.color}cc` }}
          >
            {data.language}
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25`, color: `${agent.color}cc` }}
          >
            {data.framework}
          </span>
        </div>
      </div>

      {/* Active file */}
      <div className="flex items-center gap-2 rounded p-1.5" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
        <span className="text-[9px] text-gray-500 font-mono">FILE:</span>
        <span className="text-[10px] font-mono truncate" style={{ color: agent.color }}>{data.activeFile}</span>
      </div>

      {/* Terminal code snippet */}
      <div className="rounded p-2 overflow-hidden" style={{ background: "#000b14", border: `1px solid ${agent.color}20` }}>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500 opacity-70" />
          <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-70" />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color, opacity: 0.7 }} />
          <span className="text-[9px] font-mono text-gray-600 ml-1">terminal</span>
        </div>
        <pre className="text-[9px] font-mono text-gray-300 overflow-hidden whitespace-pre-wrap leading-relaxed" style={{ color: `${agent.color}cc` }}>
          {data.codeSnippet}
        </pre>
        <div className="flex items-center mt-1.5">
          <span className="text-[10px] font-mono" style={{ color: agent.color }}>█</span>
          <span className="text-[9px] font-mono text-gray-600 ml-1 animate-pulse">_</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded p-2 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-sm font-mono font-bold" style={{ color: agent.color }}>{data.linesWritten}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Lines Written</div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: "#ff2d5508", border: "1px solid #ff2d5520" }}>
          <div className="text-sm font-mono font-bold text-red-400">{data.bugsFixed}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Bugs Fixed</div>
        </div>
      </div>

      {/* Recent commits */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Recent Commits</div>
        <div className="space-y-1">
          {data.recentCommits.map((commit, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[9px] font-mono mt-0.5 flex-shrink-0" style={{ color: `${agent.color}80` }}>
                {i === 0 ? "●" : "○"}
              </span>
              <span className="text-[10px] font-mono text-gray-300 leading-tight">{commit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
