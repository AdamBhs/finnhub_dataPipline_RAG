import { useState } from "react";
import {
  Check,
  Copy,
  FileText,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/features/chat/format";
import { MODELS } from "@/features/chat/models";
import type { ChatMessage } from "@/features/chat/types";
import { cn } from "@/lib/utils";

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const isUser = message.role === "user";
  const modelLabel = MODELS.find((m) => m.id === message.modelId)?.label;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard needs https or localhost
    }
  }

  function toggleSpeak() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = navigator.language;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {message.files.length > 0 && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
            {message.files.map((f, i) =>
              f.previewUrl ? (
                <img
                  key={i}
                  src={f.previewUrl}
                  alt={f.name}
                  className="size-24 rounded-xl border object-cover"
                />
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border bg-white p-2 text-xs"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="size-4" />
                  </span>
                  <div>
                    <p className="max-w-32 truncate font-medium">{f.name}</p>
                    <p className="text-slate-500">{formatSize(f.size)}</p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        {message.text && (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground sm:max-w-xl">
            {message.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white">
        <Sparkles className="size-4" />
      </div>

      <div className="min-w-0 max-w-[85%] sm:max-w-xl">
        <div className="rounded-2xl rounded-tl-md border bg-white px-4 py-2.5 text-sm">
          {message.text === "" ? (
            <div className="flex h-5 items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {message.text}
              {message.streaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-500 align-middle" />
              )}
            </p>
          )}
        </div>

        {!message.streaming && message.text !== "" && (
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Copy message"
              onClick={copy}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            {canSpeak && (
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-7", speaking && "text-blue-600")}
                aria-label={speaking ? "Stop reading" : "Read aloud"}
                onClick={toggleSpeak}
              >
                {speaking ? (
                  <VolumeX className="size-3.5" />
                ) : (
                  <Volume2 className="size-3.5" />
                )}
              </Button>
            )}
            {modelLabel && <span className="ml-1">{modelLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
