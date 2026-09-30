"use client";

import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleBookmark } from "@/server/actions/notes";

/** Bookmarks a lesson or unit so it appears under Notes > Bookmarks. */
export function BookmarkButton({
  kind,
  refId,
  initial,
}: {
  kind: "lesson" | "unit";
  refId: string;
  initial: boolean;
}) {
  const t = useTranslations("notes");
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={bookmarked}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleBookmark({ kind, refId });
          if (!res.ok) {
            toast.error(t("bookmarkFailed"));
            return;
          }
          setBookmarked(res.bookmarked);
          toast.success(res.bookmarked ? t("bookmarkAdded") : t("bookmarkRemoved"));
        })
      }
    >
      <Bookmark className={cn(bookmarked && "fill-current text-primary")} aria-hidden="true" />
      {bookmarked ? t("bookmarked") : t("bookmark")}
    </Button>
  );
}
