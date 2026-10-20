import { useCallback, useEffect, useRef, useState } from "react";
import { uid } from "@/lib/uid";
import { MODELS, type ModelId } from "./models";
import type { Attachment, ChatMessage } from "./types";

function mockReply(
  text: string,
  files: Attachment[],
  modelId: ModelId,
): string {
  const model = MODELS.find((m) => m.id === modelId)?.label ?? modelId;
  const asked = text ? `\n\nYou asked: "${text}"` : "";
  const received = files.length
    ? `\n\nI received ${files.length} file(s): ${files.map((f) => f.file.name).join(", ")}.`
    : "";
  return `(${model}) The backend isn't connected yet, so this is a placeholder answer.${asked}${received}`;
}

function revokePreviews(messages: ChatMessage[]) {
  messages.forEach((m) =>
    m.files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl)),
  );
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const cancelTimers = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    window.clearInterval(intervalRef.current);
  }, []);

  useEffect(
    () => () => {
      cancelTimers();
      revokePreviews(messagesRef.current);
    },
    [cancelTimers],
  );

  const stop = useCallback(() => {
    cancelTimers();
    setBusy(false);
    setMessages((prev) =>
      prev
        .map((m) => (m.streaming ? { ...m, streaming: false } : m))
        .filter((m) => m.role !== "ai" || m.text !== ""),
    );
  }, [cancelTimers]);

  const send = useCallback(
    (text: string, files: Attachment[], modelId: ModelId) => {
      const aiId = uid();
      const full = mockReply(text, files, modelId);

      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        text,
        files: files.map((a) => ({
          name: a.file.name,
          size: a.file.size,
          previewUrl: a.previewUrl,
        })),
      };
      const aiMessage: ChatMessage = {
        id: aiId,
        role: "ai",
        text: "",
        files: [],
        modelId,
        streaming: true,
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setBusy(true);

      // Fake "thinking" delay, then stream the reply 2 characters at a time
      timeoutRef.current = window.setTimeout(() => {
        let i = 0;
        intervalRef.current = window.setInterval(() => {
          i = Math.min(i + 2, full.length);
          const done = i >= full.length;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, text: full.slice(0, i), streaming: !done }
                : m,
            ),
          );
          if (done) {
            window.clearInterval(intervalRef.current);
            setBusy(false);
          }
        }, 20);
      }, 700);
    },
    [],
  );

  const clear = useCallback(() => {
    cancelTimers();
    setBusy(false);
    revokePreviews(messagesRef.current);
    setMessages([]);
  }, [cancelTimers]);

  return { messages, busy, send, stop, clear };
}
