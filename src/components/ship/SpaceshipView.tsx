"use client";

import { useState } from "react";
import type { Agent } from "@/types";
import { SHIP, ROOMS } from "./shipData";
import AgentCharacter from "./AgentCharacter";

// ─── Equipment icon renderer ──────────────────────────────────────────────────
function Equipment({ x, y, type, color }: { x: number; y: number; type: string; color: string }) {
  const c = color;
  const s = `${c}50`;
  switch (type) {
    case "terminal":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-9" y="-7" width="18" height="14" rx="2" fill={s} stroke={c} strokeWidth="0.6" opacity="0.7"/>
        <rect x="-6" y="-5" width="12" height="7" rx="1" fill={`${c}20`} stroke={c} strokeWidth="0.4" opacity="0.8"/>
        <rect x="-4" y="3" width="8" height="1.5" rx="0.5" fill={c} opacity="0.4"/>
      </g>;
    case "screen":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-12" y="-8" width="24" height="16" rx="2" fill={s} stroke={c} strokeWidth="0.6" opacity="0.7"/>
        <rect x="-9" y="-5" width="18" height="10" rx="1" fill={`${c}25`} opacity="0.8"/>
        <line x1="-7" y1="-3" x2="7" y2="-3" stroke={c} strokeWidth="0.5" opacity="0.6"/>
        <line x1="-7" y1="0" x2="4" y2="0" stroke={c} strokeWidth="0.5" opacity="0.4"/>
      </g>;
    case "server":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-8" y="-10" width="16" height="20" rx="2" fill={s} stroke={c} strokeWidth="0.6" opacity="0.7"/>
        {[0,1,2].map(i=><rect key={i} x="-5" y={-7+i*6} width="10" height="3" rx="0.5" fill={`${c}30`} stroke={c} strokeWidth="0.4" opacity="0.8"/>)}
        <circle cx="4" cy="-5" r="1" fill={c} opacity="0.8"><animate attributeName="opacity" values="0.8;0.2;0.8" dur={`${1+Math.random()}s`} repeatCount="indefinite"/></circle>
      </g>;
    case "panel":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-10" y="-6" width="20" height="12" rx="1" fill={s} stroke={c} strokeWidth="0.6" opacity="0.7"/>
        {[0,1,2].map(i=><circle key={i} cx={-6+i*6} cy="0" r="2" fill={`${c}40`} stroke={c} strokeWidth="0.4" opacity="0.8"/>)}
      </g>;
    case "reactor":
      return <g transform={`translate(${x},${y})`}>
        <circle r="9" fill={s} stroke={c} strokeWidth="0.8" opacity="0.7"/>
        <circle r="5" fill={`${c}30`} stroke={c} strokeWidth="0.5"/>
        <circle r="2" fill={c} opacity="0.6"><animate attributeName="r" values="2;3;2" dur="1.5s" repeatCount="indefinite"/></circle>
      </g>;
    case "vent":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-10" y="-4" width="20" height="8" rx="1" fill={s} stroke={c} strokeWidth="0.5" opacity="0.6"/>
        {[-6,-2,2,6].map(i=><line key={i} x1={i} y1="-3" x2={i} y2="3" stroke={c} strokeWidth="0.5" opacity="0.5"/>)}
      </g>;
    case "shelf":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-12" y="-3" width="24" height="6" rx="1" fill={s} stroke={c} strokeWidth="0.5" opacity="0.6"/>
        {[-8,-2,4].map(i=><rect key={i} x={i} y="-7" width="4" height="4" rx="0.5" fill={`${c}30`} stroke={c} strokeWidth="0.4" opacity="0.7"/>)}
      </g>;
    case "board":
      return <g transform={`translate(${x},${y})`}>
        <rect x="-10" y="-12" width="20" height="24" rx="1" fill={s} stroke={c} strokeWidth="0.6" opacity="0.7"/>
        {[0,1,2,3].map(i=><line key={i} x1="-7" y1={-8+i*6} x2="7" y2={-8+i*6} stroke={c} strokeWidth="0.5" opacity="0.4"/>)}
        <rect x="-3" y="-3" width="6" height="3" rx="0.5" fill={`${c}40`} opacity="0.8"/>
      </g>;
    default:
      return null;
  }
}

// ─── Room panel ───────────────────────────────────────────────────────────────
function RoomPanel({ room, active }: { room: typeof ROOMS[string]; active: boolean }) {
  const c = room.color;
  return (
    <g>
      {/* Room fill */}
      <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="4"
        fill={`${c}06`}
        stroke={c} strokeWidth={active ? "1.2" : "0.7"}
        opacity={active ? 1 : 0.7}
        style={{ filter: active ? `drop-shadow(0 0 6px ${c}40)` : "none" }}
      />

      {/* Grid lines inside room */}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={`h${i}`}
          x1={room.x + 8} y1={room.y + (room.h / 5) * (i + 1)}
          x2={room.x + room.w - 8} y2={room.y + (room.h / 5) * (i + 1)}
          stroke={c} strokeWidth="0.3" opacity="0.15"
        />
      ))}
      {Array.from({ length: 3 }).map((_, i) => (
        <line key={`v${i}`}
          x1={room.x + (room.w / 4) * (i + 1)} y1={room.y + 8}
          x2={room.x + (room.w / 4) * (i + 1)} y2={room.y + room.h - 8}
          stroke={c} strokeWidth="0.3" opacity="0.15"
        />
      ))}

      {/* Corner accents */}
      {[
        [room.x + 4, room.y + 4, room.x + 12, room.y + 4, room.x + 4, room.y + 12],
        [room.x + room.w - 4, room.y + 4, room.x + room.w - 12, room.y + 4, room.x + room.w - 4, room.y + 12],
        [room.x + 4, room.y + room.h - 4, room.x + 12, room.y + room.h - 4, room.x + 4, room.y + room.h - 12],
        [room.x + room.w - 4, room.y + room.h - 4, room.x + room.w - 12, room.y + room.h - 4, room.x + room.w - 4, room.y + room.h - 12],
      ].map((pts, i) => (
        <polyline key={i} points={`${pts[0]},${pts[1]} ${pts[2]},${pts[3]}`} stroke={c} strokeWidth="1.2" fill="none" opacity="0.6"/>
      ))}

      {/* Equipment */}
      {room.equipment.map((eq, i) => (
        <Equipment key={i} x={eq.x} y={eq.y} type={eq.type} color={c} />
      ))}

      {/* Room label */}
      <text x={room.x + room.w / 2} y={room.y + 18} textAnchor="middle"
        fontSize="9" fontWeight="700" fill={c} opacity="0.85"
        style={{ fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
      >
        {room.label}
      </text>
      <text x={room.x + room.w / 2} y={room.y + 29} textAnchor="middle"
        fontSize="6" fill={c} opacity="0.4"
        style={{ fontFamily: "monospace", letterSpacing: "0.15em" }}
      >
        {room.sublabel}
      </text>
    </g>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function AgentTooltip({ agent, x, y }: { agent: Agent; x: number; y: number }) {
  return (
    <div className="fixed z-50 pointer-events-none"
      style={{ left: x + 16, top: y - 10, transform: "translateY(-50%)" }}
    >
      <div className="rounded-lg px-3 py-2 text-left"
        style={{
          background: "rgba(5,10,20,0.96)",
          border: `1px solid ${agent.color}50`,
          boxShadow: `0 0 20px ${agent.color}20`,
          minWidth: 180,
        }}
      >
        <div className="text-[10px] font-mono font-bold uppercase tracking-widest mb-1" style={{ color: agent.color }}>
          {agent.name}
        </div>
        <div className="text-[9px] font-mono text-gray-400 mb-1 leading-tight">{agent.currentTask}</div>
        <div className="flex justify-between items-center mt-1.5 pt-1" style={{ borderTop: `1px solid ${agent.color}20` }}>
          <span className="text-[9px] font-mono text-gray-500 uppercase">EFF</span>
          <span className="text-[9px] font-mono font-bold" style={{ color: agent.color }}>{agent.metrics.efficiency}%</span>
          <span className="text-[9px] font-mono text-gray-500 uppercase">SPD</span>
          <span className="text-[9px] font-mono font-bold" style={{ color: agent.color }}>{agent.metrics.processingSpeed}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ship view ───────────────────────────────────────────────────────────
interface Props {
  agents: Agent[];
}

export default function SpaceshipView({ agents }: Props) {
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleHover = (agent: Agent | null, x: number, y: number) => {
    setHoveredAgent(agent);
    setTooltipPos({ x, y });
  };

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  // Stars
  const stars = Array.from({ length: 120 }, (_, i) => ({
    x: (i * 137.5) % SHIP.vw,
    y: (i * 97.3) % SHIP.vh,
    r: i % 5 === 0 ? 1.2 : 0.6,
    op: 0.2 + (i % 10) * 0.05,
  }));

  // Data flow particles along corridors
  const corridors = [
    { x1: 308, y1: 178, x2: 338, y2: 178 }, // research → coding
    { x1: 538, y1: 178, x2: 615, y2: 186 }, // coding → browsing
    { x1: 308, y1: 352, x2: 338, y2: 352 }, // automation → content
    { x1: 208, y1: 260, x2: 208, y2: 270 }, // research → automation (vertical)
    { x1: 438, y1: 260, x2: 438, y2: 270 }, // coding → content (vertical)
    { x1: 538, y1: 352, x2: 615, y2: 296 }, // content → browsing
  ];

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: "#020812" }}>
      {/* ── Header bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: "0 0 6px #00d4ff" }} />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">Vessel Overview</span>
          <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest">· AI-7 Mission Vessel</span>
        </div>
        <div className="flex items-center gap-4">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: a.color, boxShadow: `0 0 4px ${a.color}` }} />
              <span className="text-[9px] font-mono text-gray-400">{a.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG Ship ── */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-2">
        <svg
          viewBox={`0 0 ${SHIP.vw} ${SHIP.vh}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-h-full"
          style={{ maxWidth: "100%", overflow: "visible" }}
        >
          {/* Deep space background */}
          <rect width={SHIP.vw} height={SHIP.vh} fill="#020812" />

          {/* Stars */}
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.op} />
          ))}

          {/* Nebula glow (ambient) */}
          <radialGradient id="nebula1" cx="70%" cy="30%" r="40%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula2" cx="20%" cy="70%" r="35%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
          <rect width={SHIP.vw} height={SHIP.vh} fill="url(#nebula1)" />
          <rect width={SHIP.vw} height={SHIP.vh} fill="url(#nebula2)" />

          {/* ── Engine pods (back) ── */}
          {[SHIP.engineUpper, SHIP.engineLower].map((e, i) => (
            <g key={i}>
              <rect {...e} fill="rgba(255,107,0,0.08)" stroke="rgba(255,107,0,0.4)" strokeWidth="1" />
              <rect x={e.x + 4} y={e.y + 6} width={e.w - 8} height={e.h - 12} rx="4"
                fill="rgba(255,107,0,0.12)" stroke="rgba(255,107,0,0.25)" strokeWidth="0.8" />
              {/* Engine glow */}
              <rect x={e.x - 6} y={e.y + e.h * 0.2} width={8} height={e.h * 0.6} rx="2"
                fill="rgba(255,140,0,0.15)" stroke="rgba(255,140,0,0.5)" strokeWidth="0.8">
                <animate attributeName="opacity" values="0.8;0.4;0.8" dur={`${1.2 + i * 0.4}s`} repeatCount="indefinite" />
              </rect>
              <text x={e.x + e.w / 2} y={e.y + e.h / 2 + 3} textAnchor="middle"
                fontSize="6" fill="rgba(255,107,0,0.6)" style={{ fontFamily: "monospace" }}>
                ENG-{i + 1}
              </text>
            </g>
          ))}

          {/* ── Main hull ── */}
          <polygon points={SHIP.hullPoints}
            fill="rgba(5,12,28,0.95)"
            stroke="rgba(0,212,255,0.25)" strokeWidth="1.5"
            style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.08))" }}
          />

          {/* Hull inner grid */}
          <clipPath id="hullClip">
            <polygon points={SHIP.hullPoints} />
          </clipPath>
          <g clipPath="url(#hullClip)" opacity="0.06">
            {Array.from({ length: 20 }).map((_, i) => (
              <line key={`gh${i}`} x1={50} y1={50 + i * 22} x2={910} y2={50 + i * 22}
                stroke="#00d4ff" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 40 }).map((_, i) => (
              <line key={`gv${i}`} x1={50 + i * 22} y1={50} x2={50 + i * 22} y2={480}
                stroke="#00d4ff" strokeWidth="0.5" />
            ))}
          </g>

          {/* ── Corridors ── */}
          {corridors.map((c, i) => (
            <g key={i}>
              <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="#00d4ff" strokeWidth="3" opacity="0.06" />
              <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="#00d4ff" strokeWidth="1" opacity="0.15" strokeDasharray="4 3" />
              {/* Data packet flowing through */}
              <circle r="1.8" fill="#00d4ff" opacity="0">
                <animateMotion dur={`${1.5 + i * 0.5}s`} repeatCount="indefinite"
                  path={`M${c.x1},${c.y1} L${c.x2},${c.y2}`}
                />
                <animate attributeName="opacity" values="0;0.7;0" dur={`${1.5 + i * 0.5}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}

          {/* ── Central connector area ── */}
          <rect x={308} y={96} width={30} height={338} rx="4"
            fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.08)" strokeWidth="0.5" />
          <rect x={108} y={260} width={400} height={14} rx="4"
            fill="rgba(0,212,255,0.03)" stroke="rgba(0,212,255,0.08)" strokeWidth="0.5" />

          {/* Ship label: bow area */}
          <text x={845} y={262} textAnchor="middle" fontSize="8" fill="rgba(0,212,255,0.35)"
            style={{ fontFamily: "monospace", letterSpacing: "0.1em" }} transform="rotate(-90, 845, 262)">
            BOW
          </text>
          <text x={68} y={262} textAnchor="middle" fontSize="8" fill="rgba(255,107,0,0.35)"
            style={{ fontFamily: "monospace", letterSpacing: "0.1em" }} transform="rotate(90, 68, 262)">
            STERN
          </text>

          {/* ── Rooms ── */}
          {Object.values(ROOMS).map((room) => {
            const agent = agentMap[room.agentId];
            return <RoomPanel key={room.agentId} room={room} active={agent?.status !== "idle" && agent?.status !== "error"} />;
          })}

          {/* ── Agent characters ── */}
          {agents.map((agent) => (
            <AgentCharacter key={agent.id} agent={agent} onHover={handleHover} />
          ))}

          {/* ── Hull outer accent ── */}
          <polygon points={SHIP.hullPoints}
            fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="6" />

          {/* Nose tip glow */}
          <circle cx={900} cy={265} r={15} fill="rgba(0,212,255,0.06)">
            <animate attributeName="r" values="12;20;12" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* ── Agent tooltip ── */}
      {hoveredAgent && (
        <AgentTooltip agent={hoveredAgent} x={tooltipPos.x} y={tooltipPos.y} />
      )}
    </div>
  );
}
