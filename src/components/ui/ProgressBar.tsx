"use client";

interface Props {
  value: number;
  color: string;
  label?: string;
  showValue?: boolean;
  height?: string;
}

export default function ProgressBar({ value, color, label, showValue = true, height = "h-1.5" }: Props) {
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{label}</span>}
          {showValue && (
            <span className="text-[10px] font-mono font-bold" style={{ color }}>
              {value}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-white/5 rounded-full ${height} overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out relative"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}aa, ${color})`,
            boxShadow: `0 0 8px ${color}80`,
          }}
        >
          <div
            className="absolute right-0 top-0 h-full w-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
        </div>
      </div>
    </div>
  );
}
