'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, ShoppingCart, Package, Percent, RefreshCw, Filter, Calendar,
} from 'lucide-react';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'rakuten', label: 'Rakuten' },
  { value: 'topcashback', label: 'TopCashback' },
  { value: 'befrugal', label: 'BeFrugal' },
  { value: 'swagbucks', label: 'Swagbucks' },
  { value: 'ibotta', label: 'Ibotta' },
  { value: 'other', label: 'Other' },
];

interface SalesSummary {
  grossSales: number;
  productCost: number;
  sellerFees: number;
  netProfit: number;
  cashbackTotal: number;
  orderCount: number;
}

interface ChartPoint {
  label: string;
  grossSales: number;
  netProfit: number;
  cashback: number;
}

interface OrderRow {
  id: string;
  sell_price: number;
  buy_price: number;
  seller_fees: number | null;
  cashback_earned: number | null;
  margin: number | null;
  source: string;
  created_at: string;
  status: string;
}

function getDateRange(period: Period, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  if (customStart && customEnd) {
    return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') };
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function buildChartData(orders: OrderRow[], period: Period, customStart?: string, customEnd?: string): ChartPoint[] {
  const { start, end } = getDateRange(period, customStart, customEnd);
  const buckets: Record<string, { grossSales: number; netProfit: number; cashback: number }> = {};

  const fmt = (d: Date): string => {
    if (period === 'day') return `${d.getHours()}:00`;
    if (period === 'week') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    if (period === 'month') return `${d.getDate()}`;
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  };

  // Pre-fill buckets
  if (period === 'day') {
    for (let h = 0; h < 24; h++) buckets[`${h}:00`] = { grossSales: 0, netProfit: 0, cashback: 0 };
  } else if (period === 'week') {
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => { buckets[d] = { grossSales: 0, netProfit: 0, cashback: 0 }; });
  } else if (period === 'month') {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) buckets[`${d}`] = { grossSales: 0, netProfit: 0, cashback: 0 };
  } else {
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach((m) => {
      buckets[m] = { grossSales: 0, netProfit: 0, cashback: 0 };
    });
  }

  orders.forEach((o) => {
    let d = new Date(o.created_at);
    if (d < start || d > end) return;
    const key = fmt(d);
    if (!buckets[key]) buckets[key] = { grossSales: 0, netProfit: 0, cashback: 0 };
    const gross = Number(o.sell_price) || 0;
    const cost = Number(o.buy_price) || 0;
    const fees = Number(o.seller_fees) || 0;
    const cb = Number(o.cashback_earned) || 0;
    buckets[key].grossSales += gross;
    buckets[key].netProfit += gross - cost - fees + cb;
    buckets[key].cashback += cb;
  });

  return Object.entries(buckets).map(([label, vals]) => ({ label, ...vals }));
}

function fmt$(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}

function KPICard({ label, value, icon, color, sub }: KPICardProps) {
  return (
    <div className="card-elevated px-5 py-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs mb-1 truncate" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
        <p className="text-xl font-bold font-mono-data" style={{ color: 'var(--foreground)' }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function SalesDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [period, setPeriod] = useState<Period>('month');
  const [source, setSource] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);

  const [summary, setSummary] = useState<SalesSummary>({
    grossSales: 0, productCost: 0, sellerFees: 0, netProfit: 0, cashbackTotal: 0, orderCount: 0,
  });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { start, end } = getDateRange(
        period,
        useCustomRange ? customStart : undefined,
        useCustomRange ? customEnd : undefined
      );

      let query = supabase
        .from('orders')
        .select('id, sell_price, buy_price, seller_fees, cashback_earned, margin, source, created_at, status')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (source !== 'all') {
        query = query.eq('source', source);
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;

      const orders = (data || []) as OrderRow[];

      let grossSales = 0, productCost = 0, sellerFees = 0, cashbackTotal = 0;
      orders.forEach((o) => {
        grossSales += Number(o.sell_price) || 0;
        productCost += Number(o.buy_price) || 0;
        sellerFees += Number(o.seller_fees) || 0;
        cashbackTotal += Number(o.cashback_earned) || 0;
      });
      const netProfit = grossSales - productCost - sellerFees + cashbackTotal;

      setSummary({ grossSales, productCost, sellerFees, netProfit, cashbackTotal, orderCount: orders.length });
      setChartData(buildChartData(orders, period, useCustomRange ? customStart : undefined, useCustomRange ? customEnd : undefined));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sales data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, period, source, useCustomRange, customStart, customEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  const marginPct = summary.grossSales > 0
    ? ((summary.netProfit / summary.grossSales) * 100).toFixed(1)
    : '0.0';

  return (
    <AppLayout title="Sales Dashboard" subtitle="Revenue, costs, and profitability across all channels">
      <div className="space-y-5">

        {/* Filters */}
        <div className="card-elevated px-5 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                <Filter size={11} className="inline mr-1" />Period
              </label>
              <div className="flex gap-1">
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setUseCustomRange(false); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      period === p && !useCustomRange
                        ? 'text-white' :'hover:opacity-80'
                    }`}
                    style={
                      period === p && !useCustomRange
                        ? { background: 'var(--primary)', color: '#fff' }
                        : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }
                    }
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Source Site</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="input-base text-xs h-9 pr-8"
                style={{ minWidth: '150px' }}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                <Calendar size={11} />Custom Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => { setCustomStart(e.target.value); setUseCustomRange(true); }}
                  className="input-base text-xs h-9"
                />
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => { setCustomEnd(e.target.value); setUseCustomRange(true); }}
                  className="input-base text-xs h-9"
                />
              </div>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="btn-secondary text-xs gap-1.5 h-9 disabled:opacity-60"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPICard
            label="Gross Sales"
            value={loading ? '…' : fmt$(summary.grossSales)}
            icon={<DollarSign size={18} />}
            color="#10b981"
            sub={`${summary.orderCount} orders`}
          />
          <KPICard
            label="Product Cost"
            value={loading ? '…' : fmt$(summary.productCost)}
            icon={<Package size={18} />}
            color="#f97316"
            sub="Cost of goods"
          />
          <KPICard
            label="Seller Fees"
            value={loading ? '…' : fmt$(summary.sellerFees)}
            icon={<ShoppingCart size={18} />}
            color="#8b5cf6"
            sub="Bonanza / platform fees"
          />
          <KPICard
            label="Cashback Earned"
            value={loading ? '…' : fmt$(summary.cashbackTotal)}
            icon={<Percent size={18} />}
            color="#3b82f6"
            sub="All cashback portals"
          />
          <KPICard
            label="Net Profit"
            value={loading ? '…' : fmt$(summary.netProfit)}
            icon={<TrendingUp size={18} />}
            color={summary.netProfit >= 0 ? '#059669' : '#dc2626'}
            sub={`${marginPct}% margin`}
          />
          <KPICard
            label="Profit Margin"
            value={loading ? '…' : `${marginPct}%`}
            icon={<TrendingUp size={18} />}
            color={Number(marginPct) >= 20 ? '#059669' : Number(marginPct) >= 10 ? '#f59e0b' : '#dc2626'}
            sub="Net / Gross"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Chart */}
          <div className="card-elevated px-5 py-4">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Gross Sales vs Net Profit
            </h3>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            ) : chartData.length === 0 || chartData.every(d => d.grossSales === 0) ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No sales data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: number) => fmt$(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="grossSales" name="Gross Sales" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="netProfit" name="Net Profit" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cashback Chart */}
          <div className="card-elevated px-5 py-4">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Cashback Earnings Over Time
            </h3>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              </div>
            ) : chartData.length === 0 || chartData.every(d => d.cashback === 0) ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No cashback data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: number) => fmt$(v)}
                  />
                  <Line type="monotone" dataKey="cashback" name="Cashback" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="card-elevated overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Financial Breakdown — {useCustomRange && customStart && customEnd
                ? `${customStart} to ${customEnd}`
                : PERIOD_LABELS[period]}
              {source !== 'all' && ` · ${SOURCE_OPTIONS.find(s => s.value === source)?.label}`}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                  {['Metric', 'Amount', '% of Gross Sales', 'Notes'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    metric: 'Gross Sales',
                    amount: fmt$(summary.grossSales),
                    pct: '100.0%',
                    note: `${summary.orderCount} completed orders`,
                    color: '#10b981',
                  },
                  {
                    metric: 'Product Cost',
                    amount: `− ${fmt$(summary.productCost)}`,
                    pct: summary.grossSales > 0 ? `${((summary.productCost / summary.grossSales) * 100).toFixed(1)}%` : '—',
                    note: 'Buy price from source site',
                    color: '#f97316',
                  },
                  {
                    metric: 'Seller Fees',
                    amount: `− ${fmt$(summary.sellerFees)}`,
                    pct: summary.grossSales > 0 ? `${((summary.sellerFees / summary.grossSales) * 100).toFixed(1)}%` : '—',
                    note: 'Bonanza / marketplace fees',
                    color: '#8b5cf6',
                  },
                  {
                    metric: 'Cashback Earned',
                    amount: `+ ${fmt$(summary.cashbackTotal)}`,
                    pct: summary.grossSales > 0 ? `${((summary.cashbackTotal / summary.grossSales) * 100).toFixed(1)}%` : '—',
                    note: 'Rakuten, TopCashback, etc.',
                    color: '#3b82f6',
                  },
                  {
                    metric: 'Net Profit',
                    amount: fmt$(summary.netProfit),
                    pct: `${marginPct}%`,
                    note: 'Gross − Cost − Fees + Cashback',
                    color: summary.netProfit >= 0 ? '#059669' : '#dc2626',
                  },
                ].map((row) => (
                  <tr key={row.metric} style={{ borderBottom: '1px solid var(--border)' }} className="hover:opacity-80 transition-opacity">
                    <td className="px-5 py-3 font-medium text-sm" style={{ color: row.color }}>{row.metric}</td>
                    <td className="px-5 py-3 font-mono-data font-semibold text-sm" style={{ color: loading ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                      {loading ? '…' : row.amount}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {loading ? '…' : row.pct}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty state hint */}
        {!loading && summary.orderCount === 0 && (
          <div className="card-elevated px-5 py-8 text-center">
            <DollarSign size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No orders found for this period</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Orders will appear here once sales are recorded. Try a different period or source filter.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
