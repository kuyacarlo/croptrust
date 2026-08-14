"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Leaf,
  Satellite,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What does NDVI tell me about crop health?",
  "How does the escrow payment split work?",
  "What weather affects harvest yields?",
  "Explain the satellite verification process",
];

export default function FloatingAIButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;
      const userMsg: Message = { role: "user", content: content.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Network error. Please check your connection." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-900 text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-800 hover:shadow-emerald-900/40 active:scale-95"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-stone-100 bg-emerald-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900 text-white">
              <Leaf size={14} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">AgriAI Assistant</p>
              <p className="text-[10px] text-stone-500">Powered by NVIDIA Llama 3.3</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                  <Satellite size={28} className="text-emerald-700" />
                </div>
                <p className="text-center text-sm font-medium text-stone-600">
                  Ask me about NDVI, crop health, or forward contracts
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Bot size={12} />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-md bg-emerald-900 text-white"
                          : "rounded-bl-md bg-stone-100 text-stone-700"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600">
                        <User size={12} />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Bot size={12} />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0.1s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0.2s]" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-stone-100 p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about NDVI, crops, or escrow..."
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm text-stone-700 placeholder-stone-400 outline-none transition focus:border-emerald-400"
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900 text-white transition hover:bg-emerald-800 disabled:opacity-40"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            {messages.length > 0 && (
              <p className="mt-2 text-center text-[10px] text-stone-400">
                AI responses may contain generalized information.&nbsp;
                <button
                  onClick={() => setMessages([])}
                  className="underline transition hover:text-stone-600"
                >
                  Clear chat
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}