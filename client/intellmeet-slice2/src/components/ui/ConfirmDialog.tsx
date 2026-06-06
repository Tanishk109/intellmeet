import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Lightweight modal confirmation — no external dependency. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <Card
        className="w-full max-w-sm animate-rise p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-text-hi">{title}</h2>
        {description && <p className="mt-2 text-sm text-text-mid">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
