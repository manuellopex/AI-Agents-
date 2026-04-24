"use client";

import { useState, useEffect } from "react";
import type { Agent, AgentStatus } from "@/types";

// ─── Ship geometry constants ─────────────────────────────────────────────────
export const SHIP = {
  vw: 960,
  vh: 530,

  // Main hull polygon
  hullPoints:
    "900,265 820,148 695,88 130,88 52,182 52,348 130,442 695,442 820,382",

  // Engine pods (back-left)
  engineUpper: { x: 14, y: 105, w: 52, h: 80, rx: 8 },
  engineLower: { x: 14, y: 345, w: 52, h: 80, rx: 8 },
};

// ─── Room definitions ─────────────────────────────────────────────────────────
export interface RoomDef {
  agentId: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  // Absolute SVG coords within room that agents walk between
  waypoints: { x: number; y: number; label: string }[];
  equipment: { x: number; y: number; type: string }[];
}

export const ROOMS: Record<string, RoomDef> = {
  research: {
    agentId: "research",
    label: "Research Lab",
    sublabel: "SECTOR A·01",
    x: 108, y: 96, w: 200, h: 164,
    color: "#00d4ff",
    waypoints: [
      { x: 140, y: 125, label: "Terminal Alpha" },
      { x: 200, y: 125, label: "Data Node" },
      { x: 260, y: 125, label: "Terminal Beta" },
      { x: 140, y: 190, label: "Analysis Pod" },
      { x: 200, y: 220, label: "Archive Bay" },
      { x: 260, y: 200, label: "Source Scanner" },
    ],
    equipment: [
      { x: 135, y: 118, type: "terminal" },
      { x: 195, y: 118, type: "screen" },
      { x: 255, y: 118, type: "terminal" },
      { x: 150, y: 225, type: "shelf" },
      { x: 245, y: 225, type: "shelf" },
    ],
  },
  coding: {
    agentId: "coding",
    label: "Code Bay",
    sublabel: "SECTOR A·02",
    x: 338, y: 96, w: 200, h: 164,
    color: "#00ff88",
    waypoints: [
      { x: 368, y: 125, label: "Workstation 1" },
      { x: 438, y: 125, label: "Compiler Node" },
      { x: 510, y: 125, label: "Workstation 2" },
      { x: 368, y: 200, label: "Debug Terminal" },
      { x: 438, y: 220, label: "Build Station" },
      { x: 510, y: 190, label: "Deploy Console" },
    ],
    equipment: [
      { x: 363, y: 118, type: "terminal" },
      { x: 433, y: 118, type: "screen" },
      { x: 503, y: 118, type: "terminal" },
      { x: 370, y: 225, type: "server" },
      { x: 500, y: 225, type: "server" },
    ],
  },
  browsing: {
    agentId: "browsing",
    label: "Navigation Bridge",
    sublabel: "FORWARD SECTION",
    x: 615, y: 112, w: 188, h: 148,
    color: "#7c3aed",
    waypoints: [
      { x: 643, y: 142, label: "Helm Station" },
      { x: 710, y: 138, label: "Sensor Array" },
      { x: 770, y: 160, label: "Forward Console" },
      { x: 643, y: 210, label: "Nav Computer" },
      { x: 710, y: 230, label: "Chart Table" },
      { x: 770, y: 215, label: "Comms Panel" },
    ],
    equipment: [
      { x: 638, y: 135, type: "terminal" },
      { x: 705, y: 132, type: "screen" },
      { x: 763, y: 153, type: "terminal" },
      { x: 650, y: 248, type: "panel" },
      { x: 760, y: 248, type: "panel" },
    ],
  },
  automation: {
    agentId: "automation",
    label: "Engine Room",
    sublabel: "SECTOR B·01",
    x: 108, y: 270, w: 200, h: 164,
    color: "#ff6b00",
    waypoints: [
      { x: 140, y: 298, label: "Control Panel A" },
      { x: 200, y: 298, label: "Relay Hub" },
      { x: 260, y: 298, label: "Control Panel B" },
      { x: 140, y: 370, label: "Reactor Core" },
      { x: 200, y: 395, label: "Power Node" },
      { x: 260, y: 375, label: "Pipeline Ctrl" },
    ],
    equipment: [
      { x: 135, y: 290, type: "panel" },
      { x: 195, y: 290, type: "reactor" },
      { x: 255, y: 290, type: "panel" },
      { x: 145, y: 410, type: "vent" },
      { x: 250, y: 410, type: "vent" },
    ],
  },
  content: {
    agentId: "content",
    label: "Content Studio",
    sublabel: "SECTOR B·02",
    x: 338, y: 270, w: 200, h: 164,
    color: "#00ffc3",
    waypoints: [
      { x: 368, y: 298, label: "Writing Desk" },
      { x: 438, y: 298, label: "Idea Board" },
      { x: 510, y: 298, label: "Production Bay" },
      { x: 368, y: 375, label: "Archive Shelf" },
      { x: 438, y: 395, label: "Media Station" },
      { x: 510, y: 375, label: "Publish Console" },
    ],
    equipment: [
      { x: 363, y: 290, type: "screen" },
      { x: 433, y: 290, type: "board" },
      { x: 503, y: 290, type: "terminal" },
      { x: 370, y: 410, type: "shelf" },
      { x: 500, y: 410, type: "shelf" },
    ],
  },
};

// ─── Movement speed (ms between waypoint changes) ──────────────────────────
const MOVE_INTERVAL: Record<AgentStatus, number | null> = {
  active:    2200,
  executing: 1500,
  thinking:  3800,
  idle:      8000,
  error:     null, // frozen
  completed: 6000,
};

// ─── Hook: agent position within its room ─────────────────────────────────
export function useAgentPosition(status: AgentStatus, waypoints: { x: number; y: number }[]) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const ms = MOVE_INTERVAL[status];
    if (!ms) return;

    const jitter = Math.random() * 800;
    const timer = setTimeout(() => {
      const next = (() => {
        let n = Math.floor(Math.random() * waypoints.length);
        let attempts = 0;
        while (n === idx && attempts < 5) { n = Math.floor(Math.random() * waypoints.length); attempts++; }
        return n;
      })();
      setIdx(next);
    }, ms + jitter);

    return () => clearTimeout(timer);
  }, [idx, status, waypoints.length]);

  return waypoints[idx];
}
