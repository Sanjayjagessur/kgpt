"use client";

import { Ellipsis, MessageSquarePlus, Pencil, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ChatSummary } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { deleteChat, renameChat, searchChats } from "@/server/actions/chat";
import { useChatHistory } from "./chat-history";

/** Chat history: new chat, search, and rename/delete for each chat. */
export function ChatSidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const t = useTranslations("chat");
  const { chats, startNew } = useChatHistory();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatSummary[] | null>(null);
  const [searching, startSearch] = useTransition();
  const searchId = useId();

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const timer = window.setTimeout(() => startSearch(async () => setResults(await searchChats(q))), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const list = q.length >= 2 ? (results ?? []) : chats;
  // Keep titles fresh in search results after a rename elsewhere.
  const shown = list.map((c) => chats.find((h) => h.id === c.id) ?? c);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <Button
        onClick={() => {
          startNew();
          onNavigate?.();
        }}
        className="w-full justify-start"
      >
        <MessageSquarePlus aria-hidden="true" />
        {t("newChat")}
      </Button>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {t("searchChats")}
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchChats")}
          className="h-10 pr-9 pl-9"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-2 -translate-y-1/2"
            onClick={() => setQuery("")}
            aria-label={t("clearSearch")}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      <nav aria-label={t("history")} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" aria-busy={searching}>
        <h2 className="mb-1 px-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("history")}</h2>
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground" role="status">
            {q.length >= 2 ? (searching ? t("searching") : t("noResults", { query: q })) : t("noChats")}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((chat) => (
              <ChatItem key={chat.id} chat={chat} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

function ChatItem({ chat, onNavigate }: { chat: ChatSummary; onNavigate?: () => void }) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const pathname = usePathname();
  const router = useRouter();
  const { upsert, remove } = useChatHistory();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [title, setTitle] = useState(chat.title);
  const [pending, startTransition] = useTransition();
  const href = `/chat/${chat.id}`;
  const active = pathname === href;
  const label = chat.title || t("untitled");

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const next = title.trim();
    if (!next) return;
    startTransition(async () => {
      const res = await renameChat(chat.id, next);
      if (!res.ok) return void toast.error(t("renameFailed"));
      upsert({ id: chat.id, title: next, updated_at: chat.updated_at });
      setDialog(null);
    });
  };

  const confirmDelete = () =>
    startTransition(async () => {
      const res = await deleteChat(chat.id);
      if (!res.ok) return void toast.error(t("deleteFailed"));
      remove(chat.id);
      setDialog(null);
      toast.success(t("deleted"));
      if (active) router.push("/chat");
    });

  return (
    <li className="group relative">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 flex-col justify-center rounded-md py-1.5 pr-10 pl-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "bg-accent font-semibold text-accent-foreground" : "hover:bg-muted",
        )}
      >
        <span className="line-clamp-1">{label}</span>
        <span className="text-2xs text-muted-foreground">{format.relativeTime(new Date(chat.updated_at), now)}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={t("chatOptions", { title: label })}
            />
          }
        >
          <Ellipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setTitle(chat.title);
              setDialog("rename");
            }}
          >
            <Pencil aria-hidden="true" />
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            <Trash2 aria-hidden="true" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={submitRename} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{t("renameTitle")}</DialogTitle>
            </DialogHeader>
            <label className="grid gap-1.5 text-sm font-semibold">
              {t("chatName")}
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus />
            </label>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>{tc("cancel")}</DialogClose>
              <Button type="submit" disabled={pending || !title.trim()}>
                {pending ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteBody", { title: label })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
