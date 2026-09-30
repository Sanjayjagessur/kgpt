"use client";

import { CirclePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addUnitFlashcards } from "@/server/actions/revision";

export function AddDeckButton({ unitId, count }: { unitId: string; count: number }) {
  const t = useTranslations("revision");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await addUnitFlashcards(unitId);
          if (!res.ok) {
            toast.error(t("addFailed"));
            return;
          }
          router.refresh();
        })
      }
    >
      <CirclePlus aria-hidden="true" />
      {pending ? t("adding") : t("addDeck", { count })}
    </Button>
  );
}
