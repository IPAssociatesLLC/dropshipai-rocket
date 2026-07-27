'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, ShoppingBag, DollarSign, PackageCheck, RefreshCw, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface AnalyticsData {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalCashback: number;
  avgMargin: number;
  productsBySource: { name: string; value: number }[];
  ordersByStatus: { name: string; value: number }[];
  recentOrders: { date: string; orders: number; revenue: number }[];
  topProducts: { title: string; source: string; margin: number; orders: number }[];
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

const SOURCE_LABELS: Record<string, string> = {
  aliexpress: 'AliExpress', walmart: 'Walmart', rakuten: 'Rakuten',
  topcashback: 'TopCashback', befrugal: 'BeFrugal', swagbucks: 'Swagbucks', ibotta: 'Ibotta',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const supabase = createClient();
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const [productsRes, ordersRes, cashbackRes] = await Promise.all([
          supabase.from('products').select('source, margin_pct, status'),
          supabase.from('orders').select('status, sell_price, source, created_at, product_title').gte('created_at', since),
          supabase.from('cashback_earnings').select('amount').gte('earned_at', since),
        ]);

        const products = productsRes.data || [];
        const orders = ordersRes.data || [];
        const cashbackRows = cashbackRes.data || [];

        // Products by source
        const sourceMap: Record<string, number> = {};
        products.forEach(p => { sourceMap[p.source] = (sourceMap[p.source] || 0) + 1; });
        const productsBySource = Object.entries(sourceMap).map(([k, v]) => ({ name: SOURCE_LABELS[k] || k, value: v }));

        // Orders by status
        const statusMap: Record<string, number> = {};
        orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
        const ordersByStatus = Object.entries(statusMap).map(([k, v]) => ({ name: k.replace('-', ' '), value: v }));

        // Revenue over time (group by day)
        const dayMap: Record<string, { orders: number; revenue: number }> = {};
        orders.forEach(o => {
          const day = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0 };
          dayMap[day].orders += 1;
          dayMap[day].revenue += o.sell_price || 0;
        });
        const recentOrders = Object.entries(dayMap).slice(-14).map(([date, v]) => ({ date, ...v }));

        // Avg margin
        const margins = products.filter(p => p.margin_pct != null).map(p => p.margin_pct as number);
        const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

        // Total revenue
        const totalRevenue = orders.reduce((s, o) => s + (o.sell_price || 0), 0);
        const totalCashback = cashbackRows.reduce((s, r) => s + (r.amount || 0), 0);

        setData({
          totalProducts: products.length,
          totalOrders: orders.length,
          totalRevenue,
          totalCashback,
          avgMargin: Math.round(avgMargin * 10) / 10,
          productsBySource,
          ordersByStatus,
          recentOrders,
          topProducts: [],
        });
      } catch (err) {
        console.error('Analytics error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [period]);

  const kpis = data ? [
    { label: 'Total Products', value: data.totalProducts, icon: <ShoppingBag size={16} />, color: 'bg-info-subtle text-info', change: null },
    { label: 'Orders This Period', value: data.totalOrders, icon: <PackageCheck size={16} />, color: 'bg-positive-subtle text-positive', change: null },
    { label: 'Revenue', value: `$${data.totalRevenue.toFixed(2)}`, icon: <DollarSign size={16} />, color: 'bg-primary/10 text-primary', change: null },
    { label: 'Avg Margin', value: `${data.avgMargin}%`, icon: <TrendingUp size={16} />, color: 'bg-positive-subtle text-positive', change: null },
  ] : [];

  return (
    <AppLayout title="Analytics" subtitle="Performance metrics and trends">
      <div className="space-y-6">
        {/* Period selector */}
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${period === p ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}>
              {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card-elevated py-24 flex items-center justify-center">
            <RefreshCw size={28} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="card-elevated p-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
                  </div>
                  <p className="font-mono-data text-2xl font-bold text-foreground">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 card-elevated p-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">Orders & Revenue Over Time</h3>
                <p className="text-xs text-muted-foreground mb-4">Daily order volume and revenue</p>
                {data?.recentOrders && data.recentOrders.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.recentOrders}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={2} dot={false} name="Orders" />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue ($)" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No order data for this period</div>
                )}
              </div>

              <div className="card-elevated p-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">Products by Source</h3>
                <p className="text-xs text-muted-foreground mb-4">Distribution across scrape sources</p>
                {data?.productsBySource && data.productsBySource.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.productsBySource} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {data.productsBySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No product data yet</div>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card-elevated p-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">Orders by Status</h3>
                <p className="text-xs text-muted-foreground mb-4">Current order pipeline breakdown</p>
                {data?.ordersByStatus && data.ordersByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.ordersByStatus} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No orders in this period</div>
                )}
              </div>

              <div className="card-elevated p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Cashback Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Cashback Earned</p>
                      <p className="text-xl font-bold font-mono-data text-foreground">${data?.totalCashback.toFixed(2)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-positive-subtle text-positive flex items-center justify-center">
                      <DollarSign size={18} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Margin Across Products</p>
                      <p className="text-xl font-bold font-mono-data text-foreground">{data?.avgMargin}%</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <BarChart3 size={18} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Revenue This Period</p>
                      <p className="text-xl font-bold font-mono-data text-foreground">${data?.totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-info-subtle text-info flex items-center justify-center">
                      <TrendingUp size={18} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
