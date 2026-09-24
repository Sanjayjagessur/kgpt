"use client";

import { ChartNoAxesColumnIncreasing, Languages, LogOut, Monitor, Moon, NotebookPen, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { siteConfig } from "@/config/site";
import { setUiLocale } from "@/server/actions/profile";

export function ProfileMenu({ name }: { name: string }) {
  const t = useTranslations("nav");
  const tl = useTranslations("languages");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  const labels = { en: tl("en"), fr: tl("fr"), mfe: tl("mfe") };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("profileMenu")}
        className="flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary font-heading text-sm font-extrabold text-primary-foreground uppercase">
          {name.trim().charAt(0) || "?"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate text-sm font-semibold text-foreground">{name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/progress" />}>
          <ChartNoAxesColumnIncreasing aria-hidden="true" />
          {t("progress")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notes" />}>
          <NotebookPen aria-hidden="true" />
          {t("notes")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings aria-hidden="true" />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "dark" ? <Moon aria-hidden="true" /> : theme === "light" ? <Sun aria-hidden="true" /> : <Monitor aria-hidden="true" />}
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
              <DropdownMenuRadioItem value="light">{t("themeLight")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">{t("themeDark")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">{t("themeSystem")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages aria-hidden="true" />
            {t("language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(v) =>
                startTransition(async () => {
                  await setUiLocale(String(v));
                  router.refresh();
                })
              }
            >
              {siteConfig.uiLocales.map((l) => (
                <DropdownMenuRadioItem key={l} value={l} lang={l}>
                  {labels[l]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
