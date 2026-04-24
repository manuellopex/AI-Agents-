"use client";

import { useState, useEffect, useCallback } from "react";
import type { Agent, GlobalActivity, SystemMetrics, Alert, AgentStatus } from "@/types";
import { initialAgents, generateGlobalActivity, initialSystemMetrics, initialAlerts, logPools } from "@/data/mockData";

const AGENT_STATUSES: AgentStatus[] = ["active", "thinking", "executing", "idle"];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const agentNames: Record<string, string> = {
  research: "Research",
  coding: "Coding",
  browsing: "Browsing",
  automation: "Automation",
  content: "Content",
};

export function useSimulation() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [globalActivity, setGlobalActivity] = useState<GlobalActivity[]>(generateGlobalActivity());
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>(initialSystemMetrics);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [systemPaused, setSystemPaused] = useState(false);
  const [commandLog, setCommandLog] = useState<string[]>([
    "> system boot complete — all 5 agents online",
    "> mission control dashboard v2.4.1 initialized",
    "> real-time telemetry active",
  ]);

  // Update agents every 2 seconds
  useEffect(() => {
    if (systemPaused) return;

    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          const pool = logPools[agent.id];
          const newLog = {
            id: generateId(),
            timestamp: new Date(),
            message: randomChoice(pool),
            type: randomChoice(["info", "info", "success", "warning"] as const),
          };

          // Occasionally change status
          const shouldChangeStatus = Math.random() < 0.1;
          const newStatus = shouldChangeStatus ? randomChoice(AGENT_STATUSES) : agent.status;

          // Move progress
          const progressDelta = randomBetween(-3, 8);
          const newProgress = Math.min(100, Math.max(5, agent.progress + progressDelta));

          return {
            ...agent,
            status: newStatus,
            progress: newProgress,
            metrics: {
              ...agent.metrics,
              efficiency: Math.min(99, Math.max(70, agent.metrics.efficiency + randomBetween(-2, 2))),
              processingSpeed: Math.max(50, agent.metrics.processingSpeed + randomBetween(-15, 15)),
              tasksCompleted: agent.progress >= 98 ? agent.metrics.tasksCompleted + 1 : agent.metrics.tasksCompleted,
              uptime: agent.metrics.uptime + 2,
              lastUpdate: new Date(),
            },
            activityLog: [newLog, ...agent.activityLog.slice(0, 7)],
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [systemPaused]);

  // Update global activity every 5 seconds
  useEffect(() => {
    if (systemPaused) return;

    const activityMessages: Record<string, string[]> = {
      research: [
        "Discovered 8 new relevant sources",
        "Analysis complete — confidence score updated",
        "Knowledge graph expanded with 23 nodes",
        "New insight cluster identified",
      ],
      coding: [
        "Pushed commit — bug fix resolved",
        "Build succeeded — deploying to staging",
        "Code review complete — approved",
        "Test suite passed — 156/156",
      ],
      browsing: [
        "Extracted page metadata from 12 URLs",
        "Completed crawl of target domain",
        "Data extraction pipeline finished",
        "New search result cluster processed",
      ],
      automation: [
        "Workflow completed — 5/5 steps",
        "Webhook triggered — downstream notified",
        "Scheduled job executed successfully",
        "API sync complete — all endpoints healthy",
      ],
      content: [
        "New draft created — 1,200 words",
        "Campaign copy approved by system",
        "SEO score optimized to 94/100",
        "Content calendar updated",
      ],
    };

    const interval = setInterval(() => {
      const agentIds = ["research", "coding", "browsing", "automation", "content"] as const;
      const agentId = randomChoice([...agentIds]);
      const messages = activityMessages[agentId];
      const type = randomChoice(["info", "success", "success", "warning"] as const);

      const newActivity: GlobalActivity = {
        id: generateId(),
        agentId,
        agentName: agentNames[agentId],
        message: randomChoice(messages),
        timestamp: new Date(),
        type,
      };

      setGlobalActivity((prev) => [newActivity, ...prev.slice(0, 19)]);
    }, 5000);

    return () => clearInterval(interval);
  }, [systemPaused]);

  // Update system metrics every 3 seconds
  useEffect(() => {
    if (systemPaused) return;

    const interval = setInterval(() => {
      setSystemMetrics((prev) => ({
        totalTasksToday: prev.totalTasksToday + randomBetween(0, 1),
        cpuUsage: Math.min(95, Math.max(40, prev.cpuUsage + randomBetween(-3, 3))),
        memoryUsage: Math.min(90, Math.max(30, prev.memoryUsage + randomBetween(-2, 2))),
        avgResponseTime: Math.max(80, prev.avgResponseTime + randomBetween(-5, 5)),
        productivityScore: Math.min(99, Math.max(75, prev.productivityScore + randomBetween(-1, 1))),
        activeWorkflows: Math.max(3, Math.min(8, prev.activeWorkflows + (Math.random() < 0.1 ? randomBetween(-1, 1) : 0))),
        dataThoughput: Math.max(1000, prev.dataThoughput + randomBetween(-100, 150)),
        networkLatency: Math.max(5, Math.min(50, prev.networkLatency + randomBetween(-2, 3))),
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [systemPaused]);

  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    let response = "";

    if (trimmed.startsWith("assign")) {
      response = `> task assigned — routing to optimal agent...`;
    } else if (trimmed.startsWith("stop")) {
      const agentMatch = ["research", "coding", "browsing", "automation", "content"].find((a) => trimmed.includes(a));
      if (agentMatch) {
        setAgents((prev) => prev.map((a) => a.id === agentMatch ? { ...a, status: "idle" } : a));
        response = `> agent [${agentMatch}] status → IDLE`;
      } else {
        response = `> specify agent: stop <agent-name>`;
      }
    } else if (trimmed.startsWith("restart")) {
      const agentMatch = ["research", "coding", "browsing", "automation", "content"].find((a) => trimmed.includes(a));
      if (agentMatch) {
        setAgents((prev) => prev.map((a) => a.id === agentMatch ? { ...a, status: "active", progress: 0 } : a));
        response = `> agent [${agentMatch}] restarted — status → ACTIVE`;
      } else {
        response = `> specify agent: restart <agent-name>`;
      }
    } else if (trimmed === "pause all" || trimmed === "pause") {
      setSystemPaused(true);
      setAgents((prev) => prev.map((a) => ({ ...a, status: "idle" })));
      response = `> all agents paused — system in standby`;
    } else if (trimmed === "resume all" || trimmed === "resume") {
      setSystemPaused(false);
      setAgents((prev) => prev.map((a) => ({ ...a, status: "active" })));
      response = `> all agents resumed — mission control active`;
    } else if (trimmed === "status") {
      response = `> system online | agents: 5 active | tasks: ${systemMetrics.totalTasksToday} completed today`;
    } else if (trimmed === "help") {
      response = `> commands: assign <task>, stop <agent>, restart <agent>, pause all, resume all, status, clear`;
    } else if (trimmed === "clear") {
      setCommandLog(["> console cleared"]);
      return;
    } else {
      response = `> unrecognized command: "${cmd}" — type 'help' for commands`;
    }

    setCommandLog((prev) => [`> ${cmd}`, response, ...prev.slice(0, 18)]);
  }, [systemMetrics.totalTasksToday]);

  const startAll = useCallback(() => {
    setSystemPaused(false);
    setAgents((prev) => prev.map((a) => ({ ...a, status: "active" })));
    setCommandLog((prev) => [`> START ALL — all agents activated`, ...prev.slice(0, 18)]);
  }, []);

  const pauseAll = useCallback(() => {
    setSystemPaused(true);
    setAgents((prev) => prev.map((a) => ({ ...a, status: "idle" })));
    setCommandLog((prev) => [`> PAUSE ALL — agents suspended`, ...prev.slice(0, 18)]);
  }, []);

  const emergencyStop = useCallback(() => {
    setSystemPaused(true);
    setAgents((prev) => prev.map((a) => ({ ...a, status: "error", progress: 0 })));
    setCommandLog((prev) => [`> !! EMERGENCY STOP — all agents halted !!`, ...prev.slice(0, 18)]);
    const newAlert: Alert = {
      id: generateId(),
      agentId: "system",
      message: "EMERGENCY STOP executed — manual restart required",
      severity: "critical",
      timestamp: new Date(),
      read: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  }, []);

  return {
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
  };
}
