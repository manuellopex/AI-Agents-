"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface Props {
  logs: string[];
  onCommand: (cmd: string) => void;
}

export default function CommandConsole({ logs, onCommand }: Props) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    setHistory((prev) => [input, ...prev.slice(0, 19)]);
    setHistoryIndex(-1);
    onCommand(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      if (history[newIndex]) setInput(history[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? "" : history[newIndex]);
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(135deg, rgba(8,15,30,0.98) 0%, rgba(2,6,14,0.99) 100%)",
        border: "1px solid rgba(0,255,136,0.15)",
        boxShadow: "0 0 20px rgba(0,255,136,0.05)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(0,255,136,0.1)" }}
      >
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500 opacity-70" />
          <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-70" />
          <div className="w-2 h-2 rounded-full bg-green-500 opacity-70" />
        </div>
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest ml-2">Mission Control — Command Console</span>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-[80px] max-h-40 font-mono">
        {[...logs].reverse().map((line, i) => (
          <div
            key={i}
            className="text-[10px] leading-relaxed"
            style={{
              color: line.startsWith("> !!") ? "#ff2d55" :
                     line.startsWith("> PAUSE") || line.startsWith("> START") ? "#ffd700" :
                     line.startsWith(">") && !line.includes("unrecognized") ? "#00ff88" : "#00d4ff",
            }}
          >
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(0,255,136,0.1)" }}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="text-[10px] font-mono text-green-400 flex-shrink-0">root@mission-ctrl:~$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type command... (help for list)"
          className="flex-1 bg-transparent text-[10px] font-mono text-green-300 outline-none placeholder-gray-700 caret-green-400"
        />
      </div>
    </div>
  );
}
