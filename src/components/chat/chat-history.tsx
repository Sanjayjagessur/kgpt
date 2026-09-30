"use client";

import { useRouter } from "next/navigation";
import { createContext, Fragment, use, useCallback, useMemo, useState } from "react";
import type { ChatSummary } from "@/lib/chat";

type ChatHistory = {
  chats: ChatSummary[];
  /** Adds a chat or moves it to the top with new details. */
  upsert: (chat: Partial<ChatSummary> & { id: string }) => void;
  remove: (id: string) => void;
  /** Opens a fresh, empty chat (also resets /chat when already there). */
  startNew: () => void;
  resetKey: number;
};

const Ctx = createContext<ChatHistory | null>(null);

export function ChatHistoryProvider({ initial, children }: { initial: ChatSummary[]; children: React.ReactNode }) {
  const router = useRouter();
  const [chats, setChats] = useState(initial);
  const [resetKey, setResetKey] = useState(0);

  const upsert = useCallback((chat: Partial<ChatSummary> & { id: string }) => {
    setChats((list) => {
      const current = list.find((c) => c.id === chat.id);
      const next: ChatSummary = {
        title: "",
        subject_id: null,
        updated_at: new Date().toISOString(),
        ...current,
        ...chat,
      };
      return [next, ...list.filter((c) => c.id !== chat.id)];
    });
  }, []);

  const remove = useCallback((id: string) => setChats((list) => list.filter((c) => c.id !== id)), []);

  const startNew = useCallback(() => {
    setResetKey((k) => k + 1);
    router.push("/chat");
  }, [router]);

  const value = useMemo(
    () => ({ chats, upsert, remove, startNew, resetKey }),
    [chats, upsert, remove, startNew, resetKey],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

/** Wraps the chat page so "New chat" always starts from a clean slate. */
export function ChatPageSlot({ children }: { children: React.ReactNode }) {
  return <Fragment key={useChatHistory().resetKey}>{children}</Fragment>;
}

export function useChatHistory() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useChatHistory must be used inside ChatHistoryProvider");
  return ctx;
}
