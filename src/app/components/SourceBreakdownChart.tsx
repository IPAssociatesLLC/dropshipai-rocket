'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { name: 'AliExpress', value: 142, color: 'var(--negative)' },
  { name: 'Walmart Flash', value: 98, color: 'var(--info)' },
  { name: 'Rakuten Deals', value: 47, color: 'var(--accent)' },
  { name: 'TopCashback', value: 25, color: 'var(--primary)' },
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="card-elevated px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground">{payload[0].name}</p>
      <p className="font-mono-data text-muted-foreground">{payload[0].value} products</p>
    </div>
  );
}

export default function SourceBreakdownChart() {
  return (
    <div className="card-elevated p-5 flex flex-col flex-1 h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Source Breakdown</h3>
        <p className="text-xs text-muted-foreground">Products by scrape source (today)</p>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-src-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}