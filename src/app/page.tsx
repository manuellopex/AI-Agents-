"use client";

import { useSimulation } from "@/hooks/useSimulation";
import Header from "@/components/Header";
import AgentCard from "@/components/agents/AgentCard";
import GlobalActivityFeed from "@/components/panels/GlobalActivityFeed";
import SystemMetricsPanel from "@/components/panels/SystemMetrics";
import AlertsPanel from "@/components/panels/AlertsPanel";
import CommandConsole from "@/components/panels/CommandConsole";

export default function MissionControlPage() {
  const {
    agents,
    globalActivity,
    systemMetrics,
    alerts,
    commandLog,
    systemPaused,
    executeCommand,
    startAll,
    pauseAll,
    emergencyStop,
    dismissAlert,
  } = useSimulation();

  return (
    <div
      className="h-screen flex flex-col overflow-hidden grid-bg"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1a2d 0%, #050a14 60%)" }}
    >
      {/* Background ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,212,255,0.04) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: 0,
          left: "10%",
          width: "30%",
          height: "40%",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: 0,
          right: "10%",
          width: "30%",
          height: "40%",
          background: "radial-gradient(ellipse, rgba(255,107,0,0.03) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <Header
          agents={agents}
          metrics={systemMetrics}
          onStartAll={startAll}
          onPauseAll={pauseAll}
          onEmergencyStop={emergencyStop}
          systemPaused={systemPaused}
        />

        {/* Main layout */}
        <div className="flex-1 overflow-hidden p-4 flex gap-4">

          {/* Left: Agent cards grid */}
          <div className="flex-1 overflow-hidden flex flex-col gap-4 min-w-0">
            {/* 5 agent cards — responsive grid */}
            <div className="grid gap-4 h-full" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
            {/* Activity feed — takes most space */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <GlobalActivityFeed activities={globalActivity} />
            </div>

            {/* System metrics */}
            <SystemMetricsPanel metrics={systemMetrics} />

            {/* Alerts */}
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
          </div>
        </div>

        {/* Command console — bottom bar */}
        <div className="flex-shrink-0 px-4 pb-4">
          <CommandConsole logs={commandLog} onCommand={executeCommand} />
        </div>
      </div>
    </div>
  );
}
