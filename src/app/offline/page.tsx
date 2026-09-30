import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { ReloadWhenOnline } from "./reload-when-online";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title") };
}

/** Served by the service worker when a page can't load without a connection. */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <CloudOff className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("body")}</p>
      <ReloadWhenOnline label={t("retry")} />
    </main>
  );
}
