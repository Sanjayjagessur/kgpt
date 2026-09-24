import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Mark: an island ringed by its lagoon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <ellipse cx="16" cy="17" rx="10.5" ry="7.5" className="fill-primary-foreground" opacity=".22" />
      <path
        d="M11 16.5c1.8-3.4 6.3-4.4 9-2 2.2 2 1.5 5.3-1.4 6.2-2.9.9-7 .5-7.7-1.5-.3-.9-.2-1.8.1-2.7z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-heading text-lg font-extrabold tracking-[-0.03em]">{siteConfig.name}</span>
    </span>
  );
}
