import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUp, FileText, Mic, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/features/chat/format";
import type { Attachment } from "@/features/chat/types";
import { useAttachments } from "@/features/chat/use-attachments";
import { useSpeechRecognition } from "@/features/chat/use-speech-recognition";
import { cn } from "@/lib/utils";

type Props = {
  busy: boolean;
  onSend: (text: string, files: Attachment[]) => void;
  onStop: () => void;
};

export function Composer({ busy, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { items, error: fileError, add, remove, takeAll } = useAttachments();

  const voice = useSpeechRecognition((spoken) =>
    setText((prev) => (prev ? prev.trimEnd() + " " : "") + spoken.trim()),
  );

  // Auto-grow the textarea up to 200px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const canSend = !busy && (text.trim() !== "" || items.length > 0);

  function submit() {
    if (!canSend) return;
    if (voice.listening) voice.stop();
    onSend(text.trim(), takeAll());
    setText("");
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      add(files);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    add(Array.from(e.dataTransfer.files));
  }

  function onDragLeave(e: DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setDragging(false);
  }

  const problem = fileError ?? voice.error;

  return (
    <form onSubmit={onFormSubmit}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "relative rounded-2xl border bg-white shadow-sm transition-colors focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10",
          dragging && "border-dashed border-blue-500 bg-blue-50",
        )}
      >
        {dragging && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-blue-50/90 text-sm font-medium text-blue-700">
            Drop files to attach
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {items.map((a) => (
              <div
                key={a.id}
                className="relative flex items-center gap-2 rounded-lg border bg-slate-50 p-1.5 pr-8 text-xs animate-in fade-in zoom-in-95 duration-200"
              >
                {a.previewUrl ? (
                  <img
                    src={a.previewUrl}
                    alt=""
                    className="size-9 rounded-md object-cover"
                  />
                ) : (
                  <span className="grid size-9 place-items-center rounded-md bg-blue-50 text-blue-600">
                    <FileText className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="max-w-32 truncate font-medium">{a.file.name}</p>
                  <p className="text-slate-500">{formatSize(a.file.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${a.file.name}`}
                  onClick={() => remove(a.id)}
                  className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {voice.listening && (
          <div className="flex items-center gap-2 px-4 pt-3 text-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            <span className="truncate text-slate-500">
              {voice.interim || "Listening…"}
            </span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Ask about symbols, prices, or streams…"
          className="block max-h-[200px] min-h-11 w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="image/*,.pdf,.txt,.md,.csv,.json,.xlsx"
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = ""; // allow picking the same file again
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Attach files"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                voice.listening ? "Stop voice input" : "Start voice input"
              }
              aria-pressed={voice.listening}
              title={
                voice.supported
                  ? "Voice input"
                  : "Voice input isn't supported in this browser (try Chrome or Edge)"
              }
              disabled={!voice.supported}
              onClick={voice.toggle}
              className={cn(
                voice.listening &&
                  "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-600",
              )}
            >
              <Mic className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">
              Enter to send · Shift+Enter for new line
            </span>
            {busy ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Stop generating"
                onClick={onStop}
              >
                <Square className="size-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={!canSend}
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {problem && <p className="mt-2 text-xs text-red-600">{problem}</p>}
      <p className="mt-2 text-center text-xs text-slate-400">
        AI can make mistakes. Check important information.
      </p>
    </form>
  );
}
