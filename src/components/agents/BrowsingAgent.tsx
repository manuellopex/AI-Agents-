"use client";

import type { Agent, BrowsingAgentData } from "@/types";

interface Props {
  agent: Agent;
}

const extractionColors = {
  extracting: "#7c3aed",
  navigating: "#00d4ff",
  idle: "#666",
  analyzing: "#ffd700",
};

export default function BrowsingAgentPanel({ agent }: Props) {
  const data = agent.data as BrowsingAgentData;
  const statusColor = extractionColors[data.extractionStatus];

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Active browser tab */}
      <div className="rounded overflow-hidden" style={{ border: `1px solid ${agent.color}25` }}>
        {/* Browser chrome */}
        <div className="px-2 py-1.5 flex items-center gap-2" style={{ background: `${agent.color}10` }}>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 opacity-60" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 opacity-60" />
            <div className="w-1.5 h-1.5 rounded-full opacity-60" style={{ backgroundColor: agent.color }} />
          </div>
          <div className="flex-1 text-[9px] font-mono text-gray-400 truncate bg-black/30 px-2 py-0.5 rounded-sm">
            {data.activeUrl}
          </div>
        </div>
        {/* Page title */}
        <div className="px-2 py-1.5">
          <div className="text-[10px] font-mono text-gray-300 font-medium truncate">{data.pageTitle}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded animate-pulse"
              style={{ color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}
            >
              {data.extractionStatus.toUpperCase()}
            </span>
            <span className="text-[9px] font-mono text-gray-500">{data.tabsOpen} tabs open</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded p-2 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-sm font-mono font-bold" style={{ color: agent.color }}>{data.pagesVisited}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Pages Visited</div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}20` }}>
          <div className="text-sm font-mono font-bold" style={{ color: agent.color }}>{data.tabsOpen}</div>
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Active Tabs</div>
        </div>
      </div>

      {/* URL queue */}
      <div>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Browse Queue</div>
        <div className="space-y-1">
          {data.visitedUrls.map((item, i) => {
            const stColor = item.status === "active" ? agent.color : item.status === "done" ? "#00ff88" : "#444";
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] font-mono flex-shrink-0" style={{ color: stColor }}>
                  {item.status === "done" ? "✓" : item.status === "active" ? "▶" : "○"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-gray-300 truncate">{item.title}</div>
                  <div className="text-[9px] font-mono text-gray-600 truncate">{item.url}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data extracted */}
      <div className="rounded p-2" style={{ background: `${agent.color}06`, border: `1px solid ${agent.color}15` }}>
        <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1">Data Extracted</div>
        <div className="text-[10px] font-mono text-gray-300">{data.dataExtracted}</div>
      </div>
    </div>
  );
}
