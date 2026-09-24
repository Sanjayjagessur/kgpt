import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  const t = await getTranslations("learn");
  return (
    <nav aria-label={t("breadcrumb")} className="mb-5">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="truncate rounded-sm font-medium hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
