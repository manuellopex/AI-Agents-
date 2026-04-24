"use client";

import type { AgentId } from "@/types";

const avatars: Record<AgentId, (color: string) => React.ReactNode> = {
  research: (color) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Head */}
      <rect x="12" y="10" width="40" height="32" rx="4" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
      {/* Eyes - scanning style */}
      <rect x="16" y="18" width="12" height="6" rx="2" fill={`${color}40`} stroke={color} strokeWidth="1"/>
      <rect x="16" y="18" width="6" height="6" rx="1" fill={color} className="animate-pulse"/>
      <rect x="36" y="18" width="12" height="6" rx="2" fill={`${color}40`} stroke={color} strokeWidth="1"/>
      <rect x="36" y="18" width="6" height="6" rx="1" fill={color} className="animate-pulse"/>
      {/* Mouth - data scan line */}
      <rect x="20" y="30" width="24" height="3" rx="1.5" fill={`${color}30`} stroke={color} strokeWidth="0.5"/>
      <rect x="20" y="31" width="14" height="1" rx="0.5" fill={color}/>
      {/* Antenna */}
      <line x1="32" y1="10" x2="32" y2="4" stroke={color} strokeWidth="1.5"/>
      <circle cx="32" cy="3" r="2" fill={color} className="animate-pulse"/>
      {/* Neck */}
      <rect x="26" y="42" width="12" height="6" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      {/* Shoulders */}
      <rect x="8" y="48" width="48" height="8" rx="3" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
      {/* Corner decorations */}
      <rect x="12" y="10" width="4" height="1" fill={color}/>
      <rect x="12" y="10" width="1" height="4" fill={color}/>
      <rect x="48" y="10" width="4" height="1" fill={color}/>
      <rect x="51" y="10" width="1" height="4" fill={color}/>
    </svg>
  ),
  coding: (color) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Head */}
      <rect x="10" y="10" width="44" height="34" rx="5" fill={`${color}15`} stroke={color} strokeWidth="1.5"/>
      {/* Screen face */}
      <rect x="14" y="14" width="36" height="22" rx="2" fill="#000b18" stroke={`${color}60`} strokeWidth="1"/>
      {/* Terminal lines */}
      <rect x="17" y="17" width="8" height="1.5" rx="0.75" fill={color}/>
      <rect x="17" y="20" width="18" height="1.5" rx="0.75" fill={`${color}80`}/>
      <rect x="17" y="23" width="14" height="1.5" rx="0.75" fill={`${color}60`}/>
      <rect x="17" y="26" width="20" height="1.5" rx="0.75" fill={`${color}40`}/>
      {/* Cursor blink */}
      <rect x="39" y="17" width="2" height="1.5" rx="0.5" fill={color} className="animate-pulse"/>
      {/* Side ports */}
      <rect x="6" y="20" width="4" height="6" rx="1" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <rect x="54" y="20" width="4" height="6" rx="1" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      {/* Neck + body */}
      <rect x="26" y="44" width="12" height="5" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <rect x="8" y="49" width="48" height="8" rx="3" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
      {/* LED indicator */}
      <circle cx="46" cy="30" r="2.5" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <circle cx="46" cy="30" r="1.5" fill={color} className="animate-pulse"/>
    </svg>
  ),
  browsing: (color) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Head hexagonal feel */}
      <path d="M32 8 L52 19 L52 41 L32 52 L12 41 L12 19 Z" fill={`${color}15`} stroke={color} strokeWidth="1.5"/>
      {/* Eyes - spherical/orbital */}
      <circle cx="24" cy="27" r="6" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <circle cx="24" cy="27" r="3" fill={`${color}60`}/>
      <circle cx="24" cy="27" r="1.5" fill={color} className="animate-pulse"/>
      <circle cx="40" cy="27" r="6" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <circle cx="40" cy="27" r="3" fill={`${color}60`}/>
      <circle cx="40" cy="27" r="1.5" fill={color} className="animate-pulse"/>
      {/* Mouth - web path */}
      <path d="M22 38 Q32 34 42 38" stroke={color} strokeWidth="1.5" fill="none"/>
      {/* Orbital rings */}
      <ellipse cx="32" cy="27" rx="20" ry="8" stroke={`${color}30`} strokeWidth="0.75" fill="none" strokeDasharray="3 2"/>
      {/* Neck */}
      <rect x="27" y="52" width="10" height="5" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <rect x="9" y="57" width="46" height="6" rx="3" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
    </svg>
  ),
  automation: (color) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Industrial head */}
      <rect x="10" y="12" width="44" height="30" rx="3" fill={`${color}15`} stroke={color} strokeWidth="1.5"/>
      {/* Visor - single wide eye */}
      <rect x="14" y="17" width="36" height="10" rx="2" fill="#000" stroke={color} strokeWidth="1"/>
      <rect x="14" y="17" width="18" height="10" rx="2" fill={`${color}30`}/>
      {/* Gear decorations */}
      <circle cx="46" cy="32" r="5" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <circle cx="46" cy="32" r="2" fill={color}/>
      {/* Signal bars */}
      <rect x="16" y="30" width="2" height="6" rx="1" fill={`${color}40`}/>
      <rect x="20" y="28" width="2" height="8" rx="1" fill={`${color}60`}/>
      <rect x="24" y="26" width="2" height="10" rx="1" fill={`${color}80`}/>
      <rect x="28" y="24" width="2" height="12" rx="1" fill={color}/>
      {/* Rivets */}
      <circle cx="13" cy="15" r="1.5" fill={color}/>
      <circle cx="51" cy="15" r="1.5" fill={color}/>
      <circle cx="13" cy="39" r="1.5" fill={color}/>
      <circle cx="51" cy="39" r="1.5" fill={color}/>
      {/* Neck + shoulders */}
      <rect x="26" y="42" width="12" height="6" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <rect x="6" y="48" width="52" height="9" rx="3" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
      {/* Shoulder vents */}
      <rect x="10" y="51" width="3" height="3" rx="0.5" fill={`${color}40`}/>
      <rect x="15" y="51" width="3" height="3" rx="0.5" fill={`${color}40`}/>
      <rect x="46" y="51" width="3" height="3" rx="0.5" fill={`${color}40`}/>
      <rect x="51" y="51" width="3" height="3" rx="0.5" fill={`${color}40`}/>
    </svg>
  ),
  content: (color) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Rounded artistic head */}
      <rect x="11" y="9" width="42" height="36" rx="8" fill={`${color}15`} stroke={color} strokeWidth="1.5"/>
      {/* Expressive eyes */}
      <ellipse cx="23" cy="23" rx="5" ry="6" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <ellipse cx="23" cy="23" rx="3" ry="4" fill={`${color}60`}/>
      <circle cx="23" cy="22" r="1.5" fill={color}/>
      <circle cx="24" cy="21" r="0.75" fill="white" opacity="0.8"/>
      <ellipse cx="41" cy="23" rx="5" ry="6" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <ellipse cx="41" cy="23" rx="3" ry="4" fill={`${color}60`}/>
      <circle cx="41" cy="22" r="1.5" fill={color}/>
      <circle cx="42" cy="21" r="0.75" fill="white" opacity="0.8"/>
      {/* Smile */}
      <path d="M20 34 Q32 40 44 34" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Pen/quill on antenna */}
      <line x1="32" y1="9" x2="32" y2="3" stroke={color} strokeWidth="1.5"/>
      <polygon points="30,3 34,3 32,0" fill={color}/>
      {/* Neck + shoulders */}
      <rect x="27" y="45" width="10" height="5" fill={`${color}20`} stroke={color} strokeWidth="1"/>
      <rect x="9" y="50" width="46" height="8" rx="3" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
    </svg>
  ),
};

interface Props {
  agentId: AgentId;
  color: string;
  size?: number;
  animated?: boolean;
}

export default function RobotAvatar({ agentId, color, size = 56, animated = true }: Props) {
  return (
    <div
      className={`relative flex-shrink-0 ${animated ? "animate-float" : ""}`}
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full rounded-xl p-1"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}10, transparent)`,
          boxShadow: `0 0 20px ${color}30, 0 0 40px ${color}15`,
          border: `1px solid ${color}40`,
        }}
      >
        {avatars[agentId](color)}
      </div>
    </div>
  );
}
