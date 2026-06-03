import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  CalendarPlus,
  Sparkles,
  KanbanSquare,
  BarChart3,
  Bell,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/stores/auth";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", end: true, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/meetings", icon: Video, label: "Meetings" },
  { to: "/app/schedule", icon: CalendarPlus, label: "Schedule" },
  { to: "/app/intelligence", icon: Sparkles, label: "AI Intelligence" },
  { to: "/app/board", icon: KanbanSquare, label: "Project Board" },
  { to: "/app/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/app/notifications", icon: Bell, label: "Notifications" },
];

export function AppShell() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const push = useToast((s) => s.push);
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    push("Signed out", "info");
    navigate("/login");
  };

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-ink-900/60 p-4 md:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-signal-500/15 text-signal-400"
                    : "text-text-mid hover:bg-ink-700/50 hover:text-text-hi"
                )
              }
            >
              <Icon className="size-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-lg border border-line bg-ink-850/60 p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-signal-500 to-signal-700 text-sm font-bold text-ink-950">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-hi">{user?.name}</div>
            <div className="truncate text-xs text-text-lo">{user?.role}</div>
          </div>
          <button
            onClick={onLogout}
            className="text-text-lo transition-colors hover:text-danger-500"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Logo withText={false} />
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
