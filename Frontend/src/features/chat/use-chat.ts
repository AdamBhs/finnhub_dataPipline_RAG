import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "@/lib/http";
import { uid } from "@/lib/uid";
import type { ModelId } from "./models";
import type { Attachment, ChatMessage } from "./types";

type AgentResponse = {
  answer: string;
};

const CHAT_STORAGE_KEY = "finnhub-chat-history";

function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const messages: unknown = JSON.parse(stored);

    if (!Array.isArray(messages)) {
      return [];
    }

    return messages.filter(
      (message): message is ChatMessage =>
        typeof message === "object" &&
        message !== null &&
        "id" in message &&
        "role" in message &&
        "text" in message &&
        (message.role === "user" || message.role === "ai") &&
        typeof message.id === "string" &&
        typeof message.text === "string",
    );
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    const completedMessages = messages
      .filter((message) => !message.streaming)
      .map((message) => ({
        ...message,
        files: message.files.map((file) => ({ ...file, previewUrl: null })),
      }));

    if (completedMessages.length === 0) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return;
    }

    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(completedMessages));
  } catch {
    // Chat still works when browser storage is unavailable.
  }
}

function revokePreviews(messages: ChatMessage[]) {
  messages.forEach((message) =>
    message.files.forEach(
      (file) => file.previewUrl && URL.revokeObjectURL(file.previewUrl),
    ),
  );
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseError = error.response?.data?.error;

    if (typeof responseError === "string") {
      return responseError;
    }

    if (error.code === "ECONNABORTED") {
      return "The request took too long. Please try again.";
    }
  }

  return "Unable to reach the market assistant. Please try again.";
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [busy, setBusy] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
    saveMessages(messages);
  }, [messages]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      revokePreviews(messagesRef.current);
    },
    [],
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
    setMessages((previous) =>
      previous.filter((message) => message.role !== "ai" || message.text !== ""),
    );
  }, []);

  const send = useCallback(
    async (text: string, files: Attachment[], modelId: ModelId) => {
      if (!text) {
        return;
      }

      const aiId = uid();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        text,
        files: files.map((attachment) => ({
          name: attachment.file.name,
          size: attachment.file.size,
          previewUrl: attachment.previewUrl,
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

      setMessages((previous) => [...previous, userMessage, aiMessage]);
      setBusy(true);

      try {
        const response = await http.post<AgentResponse>(
          "/api/agent/chat",
          { prompt: text },
          { signal: controller.signal },
        );

        setMessages((previous) =>
          previous.map((message) =>
            message.id === aiId
              ? { ...message, text: response.data.answer, streaming: false }
              : message,
          ),
        );
      } catch (error) {
        if (axios.isCancel(error)) {
          return;
        }

        setMessages((previous) =>
          previous.map((message) =>
            message.id === aiId
              ? { ...message, text: errorMessage(error), streaming: false }
              : message,
          ),
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setBusy(false);
        }
      }
    },
    [],
  );

  const clear = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
    revokePreviews(messagesRef.current);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([]);
  }, []);

  return { messages, busy, send, stop, clear };
}
