import { cn } from "@/lib/utils";

/**
 * The reef line: the soft wave where lagoon meets open sea. Used once per
 * screen as the signature accent under the main heading.
 */
export function ReefLine({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-3 w-40 text-primary", className)}
    >
      <path
        d="M2 7c12-6 24-6 36 0s24 6 36 0 24-6 36 0 24 6 36 0 24-6 36 0 24 6 36 0 20-5 20-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
