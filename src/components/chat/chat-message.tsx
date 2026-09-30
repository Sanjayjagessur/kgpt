"use client";

import { Check, Copy, FileText, NotebookPen, Sparkles, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/common/logo";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UiMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { saveMessageToNotes } from "@/server/actions/chat";

export const FOLLOW_UPS = ["simpler", "detail", "differently", "example"] as const;
export type FollowUp = (typeof FOLLOW_UPS)[number];

type Props = {
  message: UiMessage;
  streaming?: boolean;
  /** Only the latest reply offers "explain differently". */
  onFollowUp?: (kind: FollowUp) => void;
};

export const ChatMessage = memo(function ChatMessage({ message, streaming, onFollowUp }: Props) {
  const t = useTranslations("chat");

  if (message.role === "user") {
    return (
      <li className="flex flex-col items-end gap-2">
        <h3 className="sr-only">{t("you")}</h3>
        {message.attachments.length > 0 && (
          <ul className="flex flex-wrap justify-end gap-2">
            {message.attachments.map((a) => (
              <li key={a.path}>
                <AttachmentPreview name={a.name} type={a.type} url={a.url} />
              </li>
            ))}
          </ul>
        )}
        {message.content && (
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground sm:max-w-[75%]">
            <Markdown className="md-invert text-base">{message.content}</Markdown>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="flex gap-3">
      <span className="mt-1 hidden shrink-0 sm:block" aria-hidden="true">
        <LogoMark />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="sr-only">{t("tutor")}</h3>
        {message.content ? (
          <Markdown className={cn(streaming && "streaming-caret")}>{message.content}</Markdown>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
            {t("thinking")}
          </p>
        )}
        {!streaming && message.content && message.id > 0 && (
          <MessageActions message={message} onFollowUp={onFollowUp} />
        )}
      </div>
    </li>
  );
});

function MessageActions({ message, onFollowUp }: { message: UiMessage; onFollowUp?: (kind: FollowUp) => void }) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveMessageToNotes(message.id);
      if (!res.ok) return void toast.error(t("saveFailed"));
      setSaved(true);
      toast.success(t("savedToNotes"));
    });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" onClick={copy} className="text-muted-foreground">
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? t("copied") : t("copy")}
      </Button>
      <Button variant="ghost" size="sm" onClick={save} disabled={pending || saved} className="text-muted-foreground">
        {saved ? <Check aria-hidden="true" /> : <NotebookPen aria-hidden="true" />}
        {saved ? t("saved") : t("saveToNotes")}
      </Button>
      {onFollowUp && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
            <WandSparkles aria-hidden="true" />
            {t("explainAgain")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {FOLLOW_UPS.map((kind) => (
              <DropdownMenuItem key={kind} onClick={() => onFollowUp(kind)}>
                {t(`followUp.${kind}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function AttachmentPreview({ name, type, url }: { name: string; type: string; url: string | null }) {
  if (type.startsWith("image/") && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed or blob URLs, not optimisable
      <img src={url} alt={name} className="h-28 max-w-48 rounded-xl border object-cover" />
    );
  }
  return (
    <span className="flex h-12 max-w-56 items-center gap-2 rounded-xl border bg-card px-3 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}
