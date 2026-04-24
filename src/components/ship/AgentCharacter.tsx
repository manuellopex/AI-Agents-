"use client";

import { useState } from "react";
import type { Agent } from "@/types";
import { useAgentPosition, ROOMS } from "./shipData";

const STATUS_ICON: Record<string, string> = {
  active:    "▶",
  executing: "⚡",
  thinking:  "◈",
  idle:      "◎",
  error:     "✕",
  completed: "✓",
};

const MOVE_DURATION: Record<string, number> = {
  active:    1.2,
  executing: 0.9,
  thinking:  2.0,
  idle:      3.0,
  error:     0,
  completed: 2.5,
};

interface Props {
  agent: Agent;
  onHover: (agent: Agent | null, x: number, y: number) => void;
}

export default function AgentCharacter({ agent, onHover }: Props) {
  const room = ROOMS[agent.id];
  const pos  = useAgentPosition(agent.status, room.waypoints);
  const dur  = MOVE_DURATION[agent.status] ?? 1.5;
  const c    = agent.color;

  // Character is centered on pos
  const cx = pos.x;
  const cy = pos.y;

  const isError = agent.status === "error";
  const isThinking = agent.status === "thinking";

  return (
    <g
      style={{ transition: `transform ${dur}s cubic-bezier(0.4,0,0.2,1)`, cursor: "pointer" }}
      transform={`translate(${cx}, ${cy})`}
      onMouseEnter={(e) => onHover(agent, e.clientX, e.clientY)}
      onMouseLeave={() => onHover(null, 0, 0)}
    >
      {/* Glow halo */}
      <circle r="14" fill={c} opacity="0.08" />
      <circle r="11" fill={c} opacity="0.06" />

      {/* Body */}
      <rect x="-7" y="-8" width="14" height="12" rx="3"
        fill={`${c}20`} stroke={c} strokeWidth="1.2"
        style={{ filter: `drop-shadow(0 0 4px ${c}80)` }}
      />

      {/* Head */}
      <rect x="-5" y="-18" width="10" height="9" rx="2"
        fill={`${c}15`} stroke={c} strokeWidth="1"
      />

      {/* Eyes */}
      <rect x="-4" y="-16" width="3" height="2" rx="0.5" fill={c} opacity="0.9" />
      <rect x="1"  y="-16" width="3" height="2" rx="0.5" fill={c} opacity="0.9" />

      {/* Antenna */}
      <line x1="0" y1="-18" x2="0" y2="-23" stroke={c} strokeWidth="0.8" />
      <circle cx="0" cy="-24" r="1.5" fill={c}>
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>

      {/* Legs */}
      <line x1="-4" y1="4" x2="-4" y2="10" stroke={c} strokeWidth="1.2" opacity="0.7" />
      <line x1="4"  y1="4" x2="4"  y2="10" stroke={c} strokeWidth="1.2" opacity="0.7" />
      <line x1="-4" y1="10" x2="-7" y2="10" stroke={c} strokeWidth="1" opacity="0.5" />
      <line x1="4"  y1="10" x2="7"  y2="10" stroke={c} strokeWidth="1" opacity="0.5" />

      {/* Status indicator ring */}
      <circle r="16" fill="none" stroke={c} strokeWidth={isError ? "1.5" : "0.8"} opacity={isError ? "0.9" : "0.25"}
        strokeDasharray={isThinking ? "3 3" : "none"}
      >
        {!isError && (
          <animateTransform attributeName="transform" type="rotate"
            values="0;360" dur={isThinking ? "4s" : "2s"} repeatCount="indefinite" />
        )}
        {isError && (
          <animate attributeName="opacity" values="0.9;0.2;0.9" dur="0.5s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Status icon above head */}
      <text x="0" y="-30" textAnchor="middle" fontSize="8" fill={c}
        style={{ fontFamily: "monospace", userSelect: "none" }}
        opacity="0.9"
      >
        {STATUS_ICON[agent.status]}
      </text>

      {/* Name tag */}
      <text x="0" y="20" textAnchor="middle" fontSize="6" fill={c}
        style={{ fontFamily: "monospace", userSelect: "none" }}
        opacity="0.6"
      >
        {agent.id.toUpperCase().slice(0, 4)}
      </text>

      {/* Executing: data particles streaming */}
      {agent.status === "executing" && (
        <>
          {[0, 1, 2].map((i) => (
            <circle key={i} r="1.5" fill={c} opacity="0">
              <animateMotion dur={`${0.8 + i * 0.3}s`} repeatCount="indefinite"
                path={`M${-8 + i * 8},0 L${-8 + i * 8},-20`}
              />
              <animate attributeName="opacity" values="0;0.8;0" dur={`${0.8 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </>
      )}

      {/* Error: shake overlay */}
      {isError && (
        <rect x="-8" y="-19" width="16" height="30" rx="3" fill="none"
          stroke="#ff2d55" strokeWidth="1" opacity="0.4"
        >
          <animate attributeName="opacity" values="0.4;0;0.4" dur="0.4s" repeatCount="indefinite" />
        </rect>
      )}
    </g>
  );
}
