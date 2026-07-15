import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mode = useTheme((s) => s.mode);
  const toggle = useTheme((s) => s.toggle);
  const bright = mode === "bright";
  const Icon = bright ? Sun : Moon;
  const label = bright ? "Bright" : "Dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${bright ? "dark" : "bright"} theme`}
      title={`Current theme: ${label}`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-ink-850/70 text-sm font-medium text-text-mid transition-colors hover:border-ink-600 hover:bg-ink-700/60 hover:text-text-hi",
        compact ? "size-9" : "h-9 px-3"
      )}
    >
      <Icon className="size-4" />
      {!compact && <span>{label}</span>}
    </button>
  );
}
