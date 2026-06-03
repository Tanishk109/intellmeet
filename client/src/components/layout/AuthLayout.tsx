import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

const stats = [
  { value: "40–60%", label: "less follow-up time" },
  { value: ">85%", label: "AI summary accuracy" },
  { value: "50+", label: "participants / meeting" },
];

/** Split-screen auth shell: brand story on the left, form on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 400px at 30% 20%, #14b8a622, transparent 60%), radial-gradient(500px 400px at 80% 90%, #f59e0b14, transparent 55%)",
          }}
        />
        <Logo className="relative" />
        <div className="relative max-w-md">
          <p className="font-display text-3xl font-semibold leading-tight text-text-hi">
            Turn every meeting into an{" "}
            <span className="text-signal-400">actionable</span>,{" "}
            <span className="text-ai-400">trackable</span> event.
          </p>
          <p className="mt-4 text-text-mid">
            Real-time video, AI summaries, smart action items, and seamless team
            collaboration — all in one platform.
          </p>
          <div className="mt-8 flex gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-2xl font-bold text-text-hi">{s.value}</div>
                <div className="text-xs text-text-lo">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-text-lo">
          IntellMeet — AI-Powered Enterprise Meeting & Collaboration Platform
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
