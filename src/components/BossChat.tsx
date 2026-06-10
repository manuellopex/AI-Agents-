"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Agent } from "@/types";

type AgentRole = "research" | "coding" | "browsing" | "automation" | "content" | "boss";

interface Message {
  role: "user" | "assistant";
  content: string;
  agentId: AgentRole;
  timestamp: Date;
}

const AGENT_META: Record<AgentRole, { name: string; color: string; short: string; model: string }> = {
  boss:       { name: "Commander Zeus", color: "#ffd700", short: "BOSS",  model: "Opus 4.7" },
  research:   { name: "ARIA",           color: "#00d4ff", short: "RES",   model: "Haiku 4.5" },
  coding:     { name: "CODA",           color: "#00ff88", short: "CODE",  model: "Haiku 4.5" },
  browsing:   { name: "NEXUS",          color: "#7c3aed", short: "NAV",   model: "Haiku 4.5" },
  automation: { name: "FLUX",           color: "#ff6b00", short: "AUTO",  model: "Haiku 4.5" },
  content:    { name: "MUSE",           color: "#00ffc3", short: "CONT",  model: "Haiku 4.5" },
};

const QUICK_COMMANDS: { label: string; text: string; target: AgentRole }[] = [
  { label: "Status Report",    text: "Give me a full status report of the mission.",                       target: "boss" },
  { label: "Research Briefing",text: "What are you currently analyzing? Give me your findings.",           target: "research" },
  { label: "Code Review",      text: "What's the current build status and any critical issues?",           target: "coding" },
  { label: "Nav Update",       text: "What targets are you currently scanning or navigating?",             target: "browsing" },
  { label: "Pipeline Status",  text: "Which automation workflows are active? Any bottlenecks?",            target: "automation" },
  { label: "Content Draft",    text: "What content are you producing? Give me a sample of current work.", target: "content" },
];

interface Props {
  agents: Agent[];
  onClose: () => void;
}

export default function BossChat({ agents, onClose }: Props) {
  const [activeAgent, setActiveAgent] = useState<AgentRole>("boss");
  const [histories, setHistories] = useState<Record<AgentRole, Message[]>>({
    boss: [], research: [], coding: [], browsing: [], automation: [], content: [],
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = histories[activeAgent];
  const meta = AGENT_META[activeAgent];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeAgent]);

  const sendMessage = useCallback(async (text: string, targetAgent: AgentRole = activeAgent) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      role: "user",
      content: text.trim(),
      agentId: targetAgent,
      timestamp: new Date(),
    };

    setHistories((prev) => ({
      ...prev,
      [targetAgent]: [...prev[targetAgent], userMsg],
    }));

    if (targetAgent !== activeAgent) setActiveAgent(targetAgent);

    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    const apiMessages = [
      ...histories[targetAgent].map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text.trim() },
    ];

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: targetAgent, messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setStreamingText(full);
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: full,
        agentId: targetAgent,
        timestamp: new Date(),
      };

      setHistories((prev) => ({
        ...prev,
        [targetAgent]: [...prev[targetAgent], assistantMsg],
      }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        const errorMsg: Message = {
          role: "assistant",
          content: "⚠ Communication link disrupted. Check your ANTHROPIC_API_KEY environment variable and restart the server.",
          agentId: targetAgent,
          timestamp: new Date(),
        };
        setHistories((prev) => ({
          ...prev,
          [targetAgent]: [...prev[targetAgent], errorMsg],
        }));
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  }, [activeAgent, histories, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    if (e.key === "Escape") onClose();
  };

  const stop = () => { abortRef.current?.abort(); };

  const clearChat = () => {
    setHistories((prev) => ({ ...prev, [activeAgent]: [] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:w-[720px] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          height: "90vh",
          maxHeight: "720px",
          background: "linear-gradient(135deg, rgba(8,15,30,0.98) 0%, rgba(5,10,20,0.99) 100%)",
          border: `1px solid ${meta.color}30`,
          boxShadow: `0 0 60px ${meta.color}15, 0 20px 60px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
          style={{ borderBottom: `1px solid ${meta.color}20`, background: `${meta.color}06` }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-mono font-bold text-[11px]"
            style={{
              background: `${meta.color}15`,
              border: `1px solid ${meta.color}40`,
              color: meta.color,
              boxShadow: `0 0 12px ${meta.color}30`,
            }}
          >
            {meta.short}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold" style={{ color: meta.color }}>{meta.name}</h2>
              <span
                className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: `${meta.color}15`, color: `${meta.color}99`, border: `1px solid ${meta.color}25` }}
              >
                {meta.model}
              </span>
              {isStreaming && (
                <span className="text-[9px] font-mono text-yellow-400 animate-pulse">TRANSMITTING...</span>
              )}
            </div>
            <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
              {activeAgent === "boss"
                ? "Mission Commander · Full Access"
                : `Specialist Agent · ${agents.find((a) => a.id === activeAgent)?.status ?? "active"}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={clearChat}
              className="text-[9px] font-mono text-gray-600 hover:text-gray-300 px-2 py-1 rounded transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              CLR
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-white transition-colors text-lg leading-none"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Agent selector tabs */}
        <div className="flex-shrink-0 flex overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {(Object.entries(AGENT_META) as [AgentRole, (typeof AGENT_META)[AgentRole]][]).map(([id, m]) => (
            <button
              key={id}
              onClick={() => setActiveAgent(id)}
              className="flex-shrink-0 px-3 py-2 text-[9px] font-mono uppercase tracking-wider transition-all flex items-center gap-1.5"
              style={{
                color: activeAgent === id ? m.color : "#555",
                background: activeAgent === id ? `${m.color}10` : "transparent",
                borderBottom: activeAgent === id ? `2px solid ${m.color}` : "2px solid transparent",
                borderTop: "none",
                minWidth: 60,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color, opacity: activeAgent === id ? 1 : 0.3 }} />
              {id === "boss" ? "BOSS" : m.name}
              {histories[id].length > 0 && (
                <span className="text-[7px] rounded-full px-1 leading-tight" style={{ background: `${m.color}20`, color: m.color }}>
                  {Math.ceil(histories[id].length / 2)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick commands */}
        <div className="flex-shrink-0 px-3 py-2 flex gap-1.5 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {QUICK_COMMANDS.filter((q) => q.target === activeAgent).map((q) => (
            <button
              key={q.label}
              onClick={() => sendMessage(q.text, q.target)}
              disabled={isStreaming}
              className="flex-shrink-0 text-[8px] font-mono px-2 py-1 rounded transition-all disabled:opacity-40"
              style={{ color: meta.color, background: `${meta.color}10`, border: `1px solid ${meta.color}25` }}
            >
              {q.label}
            </button>
          ))}
          {QUICK_COMMANDS.filter((q) => q.target !== activeAgent).slice(0, 3).map((q) => {
            const qm = AGENT_META[q.target];
            return (
              <button
                key={q.label}
                onClick={() => sendMessage(q.text, q.target)}
                disabled={isStreaming}
                className="flex-shrink-0 text-[8px] font-mono px-2 py-1 rounded transition-all disabled:opacity-40"
                style={{ color: qm.color, background: `${qm.color}08`, border: `1px solid ${qm.color}15` }}
              >
                → {qm.name}: {q.label}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isStreaming && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-mono font-bold text-xl"
                style={{ background: `${meta.color}10`, border: `1px solid ${meta.color}30`, color: meta.color, boxShadow: `0 0 30px ${meta.color}20` }}
              >
                {meta.short}
              </div>
              <div>
                <p className="text-sm font-mono font-bold" style={{ color: meta.color }}>{meta.name}</p>
                <p className="text-[10px] font-mono text-gray-500 mt-1">
                  {activeAgent === "boss" ? "Mission Commander standing by. Report, Director." : "Specialist Agent on standby. State your request."}
                </p>
              </div>
              <p className="text-[9px] font-mono text-gray-700 max-w-xs">
                Use the quick commands above or type your message below
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const msgMeta = AGENT_META[msg.agentId];
            return (
              <div key={i} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-mono font-bold mt-0.5"
                  style={
                    isUser
                      ? { background: "rgba(255,255,255,0.08)", color: "#aaa", border: "1px solid rgba(255,255,255,0.1)" }
                      : { background: `${msgMeta.color}15`, color: msgMeta.color, border: `1px solid ${msgMeta.color}30` }
                  }
                >
                  {isUser ? "YOU" : msgMeta.short}
                </div>
                <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className="px-3 py-2 rounded-xl text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
                    style={
                      isUser
                        ? { background: "rgba(255,255,255,0.07)", color: "#ddd", border: "1px solid rgba(255,255,255,0.08)", borderBottomRightRadius: 4 }
                        : { background: `${msgMeta.color}09`, color: "#e0e0e0", border: `1px solid ${msgMeta.color}20`, borderBottomLeftRadius: 4 }
                    }
                  >
                    {msg.content}
                  </div>
                  <span className="text-[8px] font-mono text-gray-700 px-1">
                    {msg.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Streaming bubble */}
          {isStreaming && (
            <div className="flex gap-2.5">
              <div
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-mono font-bold mt-0.5"
                style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}
              >
                {meta.short}
              </div>
              <div className="max-w-[75%]">
                <div
                  className="px-3 py-2 rounded-xl text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
                  style={{ background: `${meta.color}09`, color: "#e0e0e0", border: `1px solid ${meta.color}20`, borderBottomLeftRadius: 4 }}
                >
                  {streamingText || (
                    <span className="inline-flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="inline-block w-1 h-1 rounded-full animate-bounce" style={{ background: meta.color, animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  )}
                  {streamingText && <span className="inline-block w-0.5 h-3 ml-0.5 animate-pulse align-middle" style={{ background: meta.color }} />}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: `1px solid ${meta.color}15` }}>
          <div
            className="flex gap-2 items-end rounded-xl overflow-hidden"
            style={{ background: `${meta.color}06`, border: `1px solid ${meta.color}20` }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${meta.name}... (Enter to send, Shift+Enter for newline)`}
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[11px] font-mono text-gray-200 placeholder-gray-600 outline-none disabled:opacity-50"
              style={{ maxHeight: 120, minHeight: 40 }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            {isStreaming ? (
              <button
                onClick={stop}
                className="flex-shrink-0 mx-2 mb-2 w-7 h-7 flex items-center justify-center rounded-lg text-red-400 transition-colors hover:text-red-300"
                style={{ background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.25)" }}
              >
                ■
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="flex-shrink-0 mx-2 mb-2 w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40`, color: meta.color }}
              >
                ▶
              </button>
            )}
          </div>
          <p className="text-[8px] font-mono text-gray-700 mt-1.5 text-center">
            Talking to: <span style={{ color: meta.color }}>{meta.name}</span> · {meta.model} · Switch agents using tabs above
          </p>
        </div>
      </div>
    </div>
  );
}
