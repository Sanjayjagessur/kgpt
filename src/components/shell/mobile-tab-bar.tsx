"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isActive, MOBILE_NAV } from "./nav-items";

/** Thumb-reachable navigation for phones. Hidden from md up. */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 backdrop-blur-md pb-safe md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-2xs font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    aria-hidden="true"
                  />
                )}
                <item.icon className="size-[1.35rem]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
