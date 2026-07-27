'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingBag, AlertTriangle, PackageCheck,
  DollarSign, Zap, AlertCircle, BarChart3,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface KPIData {
  scraped: number;
  profitable: number;
  avgMargin: number;
  cashback: number;
  listings: number;
  priceAlerts: number;
  stockAlerts: number;
  ordersToday: number;
}

const stateStyles: Record<string, { card: string; icon: string; value: string; change: string }> = {
  positive: { card: 'card-elevated card-hover', icon: 'bg-positive-subtle text-positive', value: 'text-foreground', change: 'text-positive' },
  alert: { card: 'card-elevated card-hover border-negative/30 bg-negative-subtle/20', icon: 'bg-negative-subtle text-negative', value: 'text-negative', change: 'text-negative/70' },
  info: { card: 'card-elevated card-hover border-info/20', icon: 'bg-info-subtle text-info', value: 'text-foreground', change: 'text-info' },
  neutral: { card: 'card-elevated card-hover', icon: 'bg-secondary text-muted-foreground', value: 'text-foreground', change: 'text-muted-foreground' },
};

export default function KPIBentoGrid() {
  const [data, setData] = useState<KPIData>({
    scraped: 0, profitable: 0, avgMargin: 0, cashback: 0,
    listings: 0, priceAlerts: 0, stockAlerts: 0, ordersToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const supabase = createClient();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [productsRes, alertsRes, ordersRes, cashbackRes] = await Promise.all([
          supabase.from('products').select('status, margin_pct, bonanza_listing_id'),
          supabase.from('price_alerts').select('alert_type, is_read').eq('is_read', false),
          supabase.from('orders').select('created_at').gte('created_at', today.toISOString()),
          supabase.from('cashback_earnings').select('amount').gte('earned_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ]);

        const products = productsRes.data || [];
        const alerts = alertsRes.data || [];
        const orders = ordersRes.data || [];
        const cashbackRows = cashbackRes.data || [];

        const pending = products.filter(p => p.status === 'pending_review').length;
        const listed = products.filter(p => p.status === 'listed' || p.bonanza_listing_id).length;
        const margins = products.filter(p => p.margin_pct != null).map(p => p.margin_pct as number);
        const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
        const priceAlerts = alerts.filter(a => a.alert_type === 'price_change').length;
        const stockAlerts = alerts.filter(a => a.alert_type === 'stock_low').length;
        const cashbackTotal = cashbackRows.reduce((sum, r) => sum + (r.amount || 0), 0);

        setData({
          scraped: products.length,
          profitable: pending,
          avgMargin: Math.round(avgMargin * 10) / 10,
          cashback: Math.round(cashbackTotal * 100) / 100,
          listings: listed,
          priceAlerts,
          stockAlerts,
          ordersToday: orders.length,
        });
      } catch (err) {
        console.error('KPI fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchKPIs();
  }, []);

  const kpis = [
    { id: 'kpi-scraped', label: 'Products Scraped', value: loading ? '—' : String(data.scraped), change: 'Total in database', icon: <Zap size={16} />, state: 'positive' },
    { id: 'kpi-profitable', label: 'Profitable Queue (≥30%)', value: loading ? '—' : String(data.profitable), change: 'Awaiting review', icon: <ShoppingBag size={16} />, state: 'info', badge: data.profitable > 0 ? `${data.profitable} new` : undefined },
    { id: 'kpi-margin', label: 'Avg Margin (Active)', value: loading ? '—' : `${data.avgMargin}%`, change: 'Across all products', icon: <BarChart3 size={16} />, state: 'positive' },
    { id: 'kpi-cashback', label: 'Cashback Earned (30d)', value: loading ? '—' : `$${data.cashback.toFixed(2)}`, change: 'From cashback sites', icon: <DollarSign size={16} />, state: 'positive' },
    { id: 'kpi-listings', label: 'Active Bonanza Listings', value: loading ? '—' : String(data.listings), change: 'Live on Bonanza', icon: <PackageCheck size={16} />, state: 'neutral' },
    { id: 'kpi-price-alerts', label: 'Price Change Alerts', value: loading ? '—' : String(data.priceAlerts), change: 'Source prices changed', icon: <AlertTriangle size={16} />, state: data.priceAlerts > 0 ? 'alert' : 'neutral' },
    { id: 'kpi-stock-alerts', label: 'Stock Alerts', value: loading ? '—' : String(data.stockAlerts), change: 'Out of stock at source', icon: <AlertCircle size={16} />, state: data.stockAlerts > 0 ? 'alert' : 'neutral' },
    { id: 'kpi-orders', label: 'Orders Today', value: loading ? '—' : String(data.ordersToday), change: 'New orders today', icon: <TrendingUp size={16} />, state: 'positive' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const styles = stateStyles[kpi.state] || stateStyles.neutral;
        return (
          <div key={kpi.id} className={`${styles.card} p-5`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase leading-tight pr-2">{kpi.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.icon}`}>{kpi.icon}</div>
            </div>
            <p className={`font-mono-data font-bold text-2xl mb-1 ${styles.value}`}>{kpi.value}</p>
            <div className="flex items-center justify-between">
              <p className={`text-xs ${styles.change}`}>{kpi.change}</p>
              {kpi.badge && (
                <span className="badge-base bg-info-subtle text-info border border-info/20">{kpi.badge}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}