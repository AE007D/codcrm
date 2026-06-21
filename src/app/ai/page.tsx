"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Bot, Send, Sparkles, TrendingUp, DollarSign, Target, RotateCcw } from "lucide-react";
import { useLang } from "@/lib/i18n";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  { icon: TrendingUp, text: "Analyse mes campagnes publicitaires et dis-moi lesquelles sont rentables" },
  { icon: DollarSign, text: "Combien dois-je dépenser en pub pour atteindre 50 000 MAD de bénéfice ce mois?" },
  { icon: Target, text: "Quel est mon ROAS moyen et comment l'améliorer?" },
  { icon: Sparkles, text: "Quels produits ont le meilleur potentiel de profit et pourquoi?" },
];

export default function AIPage() {
  const { lang } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("codcrm_ai_chat");
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch { /* ignore */ }
  }, []);

  // Save to localStorage on every message change
  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem("codcrm_ai_chat", JSON.stringify(messages.slice(-50))); } catch { /* ignore */ }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          lang,
        }),
      });

      if (!res.ok) throw new Error("Erreur serveur");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Pas de flux");

      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.text,
                };
                return updated;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `⚠️ Erreur: ${err instanceof Error ? err.message : "Impossible de contacter l'IA"}`,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Conseiller IA</h1>
              <p className="text-xs text-slate-500">Analyse vos données business en temps réel</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RotateCcw size={14} />
              Nouvelle conversation
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Votre assistant business IA</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Analysez vos investissements publicitaires, calculez votre rentabilité et obtenez des recommandations personnalisées basées sur vos données réelles.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => sendMessage(text)}
                    className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition-colors">
                      <Icon size={15} className="text-violet-600" />
                    </div>
                    <span className="text-sm text-slate-700 leading-snug">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} className="text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-tr-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {msg.content}
                    {msg.role === "assistant" && loading && i === messages.length - 1 && msg.content === "" && (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white border-t border-slate-200 px-4 py-4 shrink-0">
          <div className="max-w-2xl mx-auto flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question business..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Entrée pour envoyer • Shift+Entrée pour nouvelle ligne
          </p>
        </div>
      </div>
    </div>
  );
}
