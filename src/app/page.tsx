"use client";

import { useState } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import Header from "@/components/Header";
import AgentCard from "@/components/agents/AgentCard";
import GlobalActivityFeed from "@/components/panels/GlobalActivityFeed";
import SystemMetricsPanel from "@/components/panels/SystemMetrics";
import AlertsPanel from "@/components/panels/AlertsPanel";
import CommandConsole from "@/components/panels/CommandConsole";
import SpaceshipView from "@/components/ship/SpaceshipView";

type View = "dashboard" | "ship";

export default function MissionControlPage() {
  const [view, setView] = useState<View>("dashboard");

  const {
    agents, globalActivity, systemMetrics, alerts,
    commandLog, systemPaused,
    executeCommand, startAll, pauseAll, emergencyStop, dismissAlert,
  } = useSimulation();

  return (
    <div
      className="min-h-screen xl:h-screen xl:overflow-hidden flex flex-col grid-bg"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1a2d 0%, #050a14 60%)" }}
    >
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,212,255,0.04) 0%, transparent 70%)", zIndex: 0 }} />
      <div className="fixed pointer-events-none" style={{ bottom: 0, left: "10%", width: "30%", height: "40%", background: "radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)", zIndex: 0 }} />
      <div className="fixed pointer-events-none" style={{ bottom: 0, right: "10%", width: "30%", height: "40%", background: "radial-gradient(ellipse, rgba(255,107,0,0.03) 0%, transparent 70%)", zIndex: 0 }} />

      <div className="relative z-10 flex flex-col min-h-screen xl:h-screen">
        {/* ── Header ── */}
        <Header
          agents={agents} metrics={systemMetrics}
          onStartAll={startAll} onPauseAll={pauseAll}
          onEmergencyStop={emergencyStop} systemPaused={systemPaused}
        />

        {/* ── View toggle ── */}
        <div className="flex-shrink-0 flex items-center gap-1 px-4 pt-3 pb-0">
          {(["dashboard", "ship"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1 rounded-t text-[10px] font-mono font-bold uppercase tracking-widest transition-all"
              style={{
                color: view === v ? "#00d4ff" : "#444",
                background: view === v ? "rgba(0,212,255,0.08)" : "transparent",
                borderTop: `1px solid ${view === v ? "rgba(0,212,255,0.3)" : "transparent"}`,
                borderLeft: `1px solid ${view === v ? "rgba(0,212,255,0.3)" : "transparent"}`,
                borderRight: `1px solid ${view === v ? "rgba(0,212,255,0.3)" : "transparent"}`,
                borderBottom: "none",
              }}
            >
              {v === "dashboard" ? "⬛ Dashboard" : "🚀 Ship View"}
            </button>
          ))}
        </div>

        {/* ── Dashboard view ── */}
        {view === "dashboard" && (
          <>
            <div className="flex-1 overflow-y-auto xl:overflow-hidden p-3 sm:p-4 flex flex-col xl:flex-row gap-3 xl:gap-4"
              style={{ borderTop: "1px solid rgba(0,212,255,0.1)" }}
            >
              {/* Agent cards */}
              <div className="flex-1 min-w-0">
                <div className="grid gap-3 xl:gap-4 h-auto xl:h-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="xl:w-80 xl:flex-shrink-0 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1 xl:flex xl:flex-col">
                <div className="xl:flex-1 xl:min-h-0 sm:col-span-2 lg:col-span-2">
                  <GlobalActivityFeed activities={globalActivity} />
                </div>
                <div className="lg:col-span-1">
                  <SystemMetricsPanel metrics={systemMetrics} />
                </div>
                <div className="lg:col-span-1">
                  <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
                </div>
              </div>
            </div>

            {/* Command console */}
            <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4">
              <CommandConsole logs={commandLog} onCommand={executeCommand} />
            </div>
          </>
        )}

        {/* ── Ship view ── */}
        {view === "ship" && (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ borderTop: "1px solid rgba(0,212,255,0.1)" }}>
            <div className="flex-1 overflow-hidden">
              <SpaceshipView agents={agents} />
            </div>
            {/* Mini command console stays visible */}
            <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4">
              <CommandConsole logs={commandLog} onCommand={executeCommand} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
