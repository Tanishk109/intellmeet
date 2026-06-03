import { cn } from "@/lib/utils";

/** IntellMeet wordmark — a "live signal" dot + geometric monogram. */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-signal-400 to-signal-600 shadow-lg shadow-signal-500/30">
        <svg viewBox="0 0 24 24" className="size-5 text-ink-950" fill="none">
          <path
            d="M4 7.5C4 6 5 5 6.5 5h11C19 5 20 6 20 7.5v7c0 1.5-1 2.5-2.5 2.5H9l-4 3v-3H6.5C5 17 4 16 4 14.5v-7Z"
            fill="currentColor"
          />
          <circle cx="9" cy="11" r="1.3" className="fill-signal-500" />
          <circle cx="12" cy="11" r="1.3" className="fill-signal-500" />
          <circle cx="15" cy="11" r="1.3" className="fill-signal-500" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-ai-400 ring-2 ring-ink-950" />
      </div>
      {withText && (
        <span className="font-display text-lg font-bold tracking-tight text-text-hi">
          Intell<span className="text-signal-400">Meet</span>
        </span>
      )}
    </div>
  );
}
