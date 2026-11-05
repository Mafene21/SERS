"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Incident } from "@/lib/types";
import { DEMO_FIXTURE_REFERENCE } from "@/lib/demo-data";

export function TrendsChart({ incidents }: { incidents: Incident[] }) {
  const latest = incidents.length
    ? Math.max(...incidents.map((i) => new Date(i.reportedAt).getTime()))
    : new Date(DEMO_FIXTURE_REFERENCE).getTime();
  const today = new Date(latest);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Kampala",
  });
  const data = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - (6 - index));
    const key = formatter.format(day);
    const records = incidents.filter(
      (i) => formatter.format(new Date(i.reportedAt)) === key,
    );
    return {
      day: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        timeZone: "Africa/Kampala",
      }).format(day),
      "Road accidents": records.filter((i) => i.category === "Road Accident")
        .length,
      "Fire outbreaks": records.filter((i) => i.category === "Fire Outbreak")
        .length,
    };
  });
  return (
    <div
      className="trend-chart"
      role="img"
      aria-label={`Seven-day incident trend: ${data.map((d) => `${d.day}, ${d["Road accidents"]} road accidents, ${d["Fire outbreaks"]} fire outbreaks`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 8, bottom: 0, left: -28 }}
        >
          <defs>
            <linearGradient id="roadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d93a40" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#d93a40" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fireGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e9a340" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#e9a340" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#89909d", fontSize: 11 }}
            dy={9}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#89909d", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text)",
            }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="Road accidents"
            stroke="#d93a40"
            strokeWidth={2.3}
            fill="url(#roadGradient)"
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="Fire outbreaks"
            stroke="#e9a340"
            strokeWidth={2.2}
            fill="url(#fireGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDistribution({ incidents }: { incidents: Incident[] }) {
  const road = incidents.filter((i) => i.category === "Road Accident").length;
  const fire = incidents.length - road;
  const percent = incidents.length
    ? Math.round((road / incidents.length) * 100)
    : 0;
  return (
    <div className="distribution">
      <div
        className="distribution-ring"
        style={{
          background: incidents.length
            ? `conic-gradient(#d93a40 0% ${percent}%, #edb057 ${percent}% 100%)`
            : "var(--border)",
        }}
      >
        <div>
          <strong>{incidents.length}</strong>
          <span>total incidents</span>
        </div>
      </div>
      <div className="distribution-legend">
        <div>
          <span className="legend-dot red" />
          <span>
            Road accidents<strong>{road}</strong>
          </span>
        </div>
        <div>
          <span className="legend-dot amber" />
          <span>
            Fire outbreaks<strong>{fire}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
