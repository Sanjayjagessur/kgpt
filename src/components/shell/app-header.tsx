"use client";

import { Search } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useCommandMenu } from "./command-menu";
import { isActive, PRIMARY_NAV } from "./nav-items";
import { ProfileMenu } from "./profile-menu";

export function AppHeader({ name }: { name: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { setOpen } = useCommandMenu();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16 sm:px-6">
        <Link href="/learn" className="flex items-center gap-2 rounded-md" aria-label={siteConfig.name}>
          <LogoMark />
          <span className="hidden font-heading text-lg font-extrabold tracking-[-0.03em] sm:inline">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label={t("main")} className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="relative">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative z-10 flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-semibold transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {t(item.key)}
                  </Link>
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-md bg-accent"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
            aria-keyshortcuts="Control+K Meta+K"
            className="hidden h-9 w-56 justify-start gap-2 px-3 font-normal text-muted-foreground sm:flex"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="flex-1 text-left">{t("search")}</span>
            <kbd className="rounded border bg-muted px-1.5 font-mono text-2xs">Ctrl K</kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setOpen(true)}
            aria-label={t("search")}
          >
            <Search className="size-5" aria-hidden="true" />
          </Button>
          <ProfileMenu name={name} />
        </div>
      </div>
    </header>
  );
}
