import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Download,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Composer } from "@/features/chat/components/composer";
import { MessageBubble } from "@/features/chat/components/message-bubble";
import {
  DEFAULT_MODEL,
  MODELS,
  isModelId,
  type ModelId,
} from "@/features/chat/models";
import type { ChatMessage } from "@/features/chat/types";
import { useChat } from "@/features/chat/use-chat";

const suggestions = [
  {
    icon: TrendingUp,
    title: "Top movers today",
    hint: "Biggest gainers and losers",
  },
  {
    icon: BarChart3,
    title: "Summarize AAPL activity",
    hint: "Trades, price and volume",
  },
  {
    icon: Activity,
    title: "Show stream health",
    hint: "Kafka and Finnhub status",
  },
  { icon: Zap, title: "Find volume spikes", hint: "Unusual trading activity" },
];

function exportLog(messages: ChatMessage[]) {
  const body = messages
    .map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.text}`)
    .join("\n\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "chat-log.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ChatPage() {
  const { messages, busy, send, stop, clear } = useChat();
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  function handleClear() {
    window.speechSynthesis.cancel();
    clear();
  }

  const currentLabel = MODELS.find((m) => m.id === modelId)?.label;

  return (
    <Card className="flex h-[calc(100dvh-6rem)] flex-col gap-0 overflow-hidden py-0 md:h-[calc(100dvh-8rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight">Market Copilot</h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500" />
              Online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={modelId}
            onValueChange={(v: any) => isModelId(v) && setModelId(v)}
          >
            <SelectTrigger className="w-36 sm:w-44" aria-label="Choose model">
              <SelectValue>{currentLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-xs text-slate-500">
                      {m.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            aria-label="Export log"
            disabled={messages.length === 0}
            onClick={() => exportLog(messages)}
          >
            <Download className="size-4" />
            <span className="hidden lg:inline">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Clear chat"
            disabled={messages.length === 0}
            onClick={handleClear}
          >
            <Trash2 className="size-4" />
            <span className="hidden lg:inline">Clear</span>
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-slate-50/50 px-4 py-6 sm:px-6"
      >
        <div className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center pt-6 text-center animate-in fade-in zoom-in-95 duration-500 sm:pt-12">
              <div className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <Sparkles className="size-7" />
              </div>
              <h3 className="mt-4 text-2xl font-semibold">
                How can I help you today?
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Ask about prices, volumes, or your streaming pipeline.
              </p>

              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                {suggestions.map(({ icon: Icon, title, hint }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => send(title, [], modelId)}
                    className="group flex items-start gap-3 rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-slate-500">
                        {hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-white p-3 sm:p-4">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            busy={busy}
            onSend={(text, files) => send(text, files, modelId)}
            onStop={stop}
          />
        </div>
      </div>
    </Card>
  );
}
