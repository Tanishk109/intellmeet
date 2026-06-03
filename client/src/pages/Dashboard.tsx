import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Video,
  Sparkles,
  Clock,
  TrendingUp,
  CalendarPlus,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Card, Badge, Spinner } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { meetingApi, miscApi } from "@/api";
import { useAuth } from "@/stores/auth";

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "signal",
}: {
  icon: typeof Video;
  label: string;
  value: string | number;
  tone?: "signal" | "ai";
}) {
  return (
    <Card className="p-5">
      <div
        className={`grid size-9 place-items-center rounded-lg ${
          tone === "ai" ? "bg-ai-500/15 text-ai-400" : "bg-signal-500/15 text-signal-400"
        }`}
      >
        <Icon className="size-[18px]" />
      </div>
      <div className="mt-4 font-display text-3xl font-bold text-text-hi">{value}</div>
      <div className="text-sm text-text-lo">{label}</div>
    </Card>
  );
}

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const { data: analytics } = useQuery({ queryKey: ["analytics"], queryFn: miscApi.analytics });
  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: meetingApi.list,
  });

  const upcoming = meetings?.filter((m) => m.status !== "ended").slice(0, 4) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-hi">
            Good to see you, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-text-mid">
            Here's what's happening across your workspace.
          </p>
        </div>
        <Link to="/app/schedule">
          <Button>
            <CalendarPlus className="size-4" /> Schedule meeting
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Video} label="Total meetings" value={analytics?.totalMeetings ?? "—"} />
        <StatCard
          icon={Sparkles}
          label="Productivity score"
          value={analytics ? `${analytics.productivityScore}%` : "—"}
          tone="ai"
        />
        <StatCard
          icon={Clock}
          label="Avg duration"
          value={analytics ? `${analytics.avgDurationMins}m` : "—"}
        />
        <StatCard
          icon={TrendingUp}
          label="Live now"
          value={analytics?.liveMeetings ?? "—"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Weekly chart */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-text-hi">Meeting frequency</h2>
          <p className="text-xs text-text-lo">This week</p>
          <div className="mt-4 h-56">
            {analytics ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.weekly}>
                  <XAxis
                    dataKey="day"
                    stroke="#5d6b8a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#1b254066" }}
                    contentStyle={{
                      background: "#0e1424",
                      border: "1px solid #1e2840",
                      borderRadius: 10,
                      color: "#eef2ff",
                    }}
                  />
                  <Bar dataKey="meetings" radius={[6, 6, 0, 0]}>
                    {analytics.weekly.map((_, i) => (
                      <Cell key={i} fill="#14b8a6" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center">
                <Spinner className="text-signal-400" />
              </div>
            )}
          </div>
        </Card>

        {/* Upcoming meetings */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-text-hi">Upcoming</h2>
            <Link to="/app/meetings" className="text-xs text-signal-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {isLoading ? (
              <div className="grid h-32 place-items-center">
                <Spinner className="text-signal-400" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-lo">
                No upcoming meetings.
              </p>
            ) : (
              upcoming.map((m) => (
                <Link
                  key={m.id}
                  to={`/app/room/${m.code}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-ink-850/40 p-3 transition-colors hover:border-signal-500/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-hi">{m.title}</div>
                    <div className="text-xs text-text-lo">
                      {m.date} · {m.time}
                    </div>
                  </div>
                  {m.status === "live" ? (
                    <Badge tone="signal" className="animate-pulse-ring">
                      Live
                    </Badge>
                  ) : (
                    <ArrowRight className="size-4 text-text-lo" />
                  )}
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
