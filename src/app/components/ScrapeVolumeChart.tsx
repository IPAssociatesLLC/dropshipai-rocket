'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const data = [
  { day: 'Jul 16', scraped: 198, profitable: 8 },
  { day: 'Jul 17', scraped: 245, profitable: 12 },
  { day: 'Jul 18', scraped: 187, profitable: 6 },
  { day: 'Jul 19', scraped: 320, profitable: 18 },
  { day: 'Jul 20', scraped: 278, profitable: 14 },
  { day: 'Jul 21', scraped: 301, profitable: 16 },
  { day: 'Jul 22', scraped: 312, profitable: 14 },
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="card-elevated px-3 py-2 shadow-xl text-xs min-w-[140px]">
      <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={`tip-${entry.name}`} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
          </div>
          <span className="font-mono-data font-semibold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ScrapeVolumeChart() {
  return (
    <div className="card-elevated p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Scrape Pipeline Volume</h3>
          <p className="text-xs text-muted-foreground">Products scraped vs profitable (7-day)</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">Scraped</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="text-muted-foreground">Profitable</span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradScraped" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProfitable" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="scraped"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#gradScraped)"
            />
            <Area
              type="monotone"
              dataKey="profitable"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#gradProfitable)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}