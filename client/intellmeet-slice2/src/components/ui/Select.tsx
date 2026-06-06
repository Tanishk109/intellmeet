import { forwardRef, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-line bg-ink-850/80 px-3.5 pr-9 text-sm text-text-hi",
          "transition-colors focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-500/25",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-lo" />
    </div>
  )
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-ink-850/80 px-3.5 py-2.5 text-sm text-text-hi",
        "placeholder:text-text-lo transition-colors resize-none",
        "focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-500/25",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
