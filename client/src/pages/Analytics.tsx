import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Video,
  Clock,
  TrendingUp,
  Radio,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, Spinner } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { miscApi, meetingApi } from "@/api";

const TOOLTIP = {
  background: "#0e1424",
  border: "1px solid #1e2840",
  borderRadius: 10,
  color: "#eef2ff",
};
const PIE_COLORS = ["#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#64748b"];

function Metric({
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
      <div className="mt-3 font-display text-3xl font-bold text-text-hi">{value}</div>
      <div className="text-sm text-text-lo">{label}</div>
    </Card>
  );
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: miscApi.analytics,
  });
  const { data: meetings } = useQuery({ queryKey: ["meetings"], queryFn: meetingApi.list });

  // Meeting-type breakdown for the pie chart (derived client-side).
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    (meetings ?? []).forEach((m) => {
      counts[m.type] = (counts[m.type] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [meetings]);

  const exportCsv = () => {
    if (!analytics) return;
    const rows = [
      ["Metric", "Value"],
      ["Total meetings", analytics.totalMeetings],
      ["Live now", analytics.liveMeetings],
      ["Productivity score", `${analytics.productivityScore}%`],
      ["Avg duration (min)", analytics.avgDurationMins],
      [],
      ["Day", "Meetings"],
      ...analytics.weekly.map((w) => [w.day, w.meetings]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "intellmeet-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !analytics) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <Spinner className="size-6 text-signal-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-signal-500/15 text-signal-400">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-hi">Analytics & insights</h1>
            <p className="text-sm text-text-mid">Meeting frequency, productivity, and engagement.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Video} label="Total meetings" value={analytics.totalMeetings} />
        <Metric icon={TrendingUp} label="Productivity" value={`${analytics.productivityScore}%`} tone="ai" />
        <Metric icon={Clock} label="Avg duration" value={`${analytics.avgDurationMins}m`} />
        <Metric icon={Radio} label="Live now" value={analytics.liveMeetings} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Weekly frequency */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-text-hi">Meeting frequency</h2>
          <p className="text-xs text-text-lo">This week</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" vertical={false} />
                <XAxis dataKey="day" stroke="#5d6b8a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#5d6b8a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#1b254066" }} contentStyle={TOOLTIP} />
                <Bar dataKey="meetings" radius={[6, 6, 0, 0]}>
                  {analytics.weekly.map((_, i) => (
                    <Cell key={i} fill="#14b8a6" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Type breakdown */}
        <Card className="p-5">
          <h2 className="font-display font-semibold text-text-hi">By type</h2>
          <p className="text-xs text-text-lo">All meetings</p>
          <div className="mt-4 h-64">
            {typeBreakdown.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-text-lo">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {typeBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {typeBreakdown.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-text-mid">{t.name}</span>
                <span className="ml-auto text-text-lo">{t.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Productivity trend (uses weekly as a proxy series) */}
      <Card className="p-5">
        <h2 className="font-display font-semibold text-text-hi">Engagement trend</h2>
        <p className="text-xs text-text-lo">Meetings per day this week</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" vertical={false} />
              <XAxis dataKey="day" stroke="#5d6b8a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#5d6b8a" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP} />
              <Line
                type="monotone"
                dataKey="meetings"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ fill: "#f59e0b", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
