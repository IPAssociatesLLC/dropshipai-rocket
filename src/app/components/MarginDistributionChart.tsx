'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';

interface BucketData {
  bucket: string;
  count: number;
  fill: string;
}

const BUCKETS: { label: string; min: number; max: number; fill: string }[] = [
  { label: '30–35%', min: 30, max: 35, fill: 'var(--info)' },
  { label: '35–40%', min: 35, max: 40, fill: 'var(--primary)' },
  { label: '40–45%', min: 40, max: 45, fill: 'var(--primary)' },
  { label: '45–50%', min: 45, max: 50, fill: 'var(--primary)' },
  { label: '50–55%', min: 50, max: 55, fill: 'var(--accent)' },
  { label: '55%+', min: 55, max: Infinity, fill: 'var(--accent)' },
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="card-elevated px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label} margin</p>
      <p className="font-mono-data font-semibold text-foreground">{payload[0].value} listings</p>
    </div>
  );
}

export default function MarginDistributionChart() {
  const [data, setData] = useState<BucketData[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMargins() {
      try {
        const supabase = createClient();
        const { data: products, error } = await supabase
          .from('products')
          .select('margin_pct')
          .in('status', ['listed', 'approved'])
          .not('margin_pct', 'is', null)
          .gte('margin_pct', 30);
        if (error) { console.error('Margin chart error:', error.message); return; }
        const rows = products || [];
        setTotalListings(rows.length);
        const buckets = BUCKETS.map((b) => ({
          bucket: b.label,
          count: rows.filter((p) => {
            const m = p.margin_pct as number;
            return m >= b.min && m < b.max;
          }).length,
          fill: b.fill,
        }));
        setData(buckets);
      } catch (err) {
        console.error('Margin chart error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMargins();
  }, []);

  const displayData = loading
    ? BUCKETS.map((b) => ({ bucket: b.label, count: 0, fill: b.fill }))
    : data;

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Margin Distribution</h3>
          <p className="text-xs text-muted-foreground">Active listings by profit margin bucket</p>
        </div>
        <span className="badge-base bg-positive-subtle text-positive border border-positive/20">
          {loading ? '…' : `${totalListings} listings`}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={displayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {displayData.map((entry, index) => (
              <Cell key={`cell-margin-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}