import { create } from "zustand";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const colors = {
  success: "text-signal-400",
  error: "text-danger-500",
  info: "text-text-mid",
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="animate-rise flex items-center gap-2.5 rounded-lg border border-line bg-ink-800/95 px-4 py-3 text-sm text-text-hi shadow-xl backdrop-blur"
          >
            <Icon className={`size-4 ${colors[t.tone]}`} />
            {t.message}
          </button>
        );
      })}
    </div>
  );
}
