import { cn } from "@/lib/utils";

/** Thin progress bar. Uses the subject colour when inside a subject-styled wrapper. */
export function ProgressBar({
  value,
  label,
  className,
  tone = "primary",
}: {
  value: number;
  label: string;
  className?: string;
  tone?: "primary" | "subject";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-foreground/10", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out-soft",
          tone === "subject" ? "bg-subject" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
