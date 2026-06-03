import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-ink-850/70 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Badge({
  className,
  tone = "signal",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "signal" | "ai" | "muted" | "danger" }) {
  const tones = {
    signal: "bg-signal-500/15 text-signal-400 border-signal-500/30",
    ai: "bg-ai-500/15 text-ai-400 border-ai-500/30",
    muted: "bg-ink-700 text-text-mid border-line",
    danger: "bg-danger-500/15 text-danger-500 border-danger-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
