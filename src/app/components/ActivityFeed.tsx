'use client';

import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp, PackageCheck, AlertTriangle, DollarSign, AlertCircle, ShoppingCart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ActivityItem {
  id: string;
  type: string;
  iconBg: string;
  message: string;
  detail: string;
  time: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_ICON: Record<string, { icon: React.ReactNode; bg: string }> = {
  price_change: { icon: <AlertTriangle size={13} />, bg: 'bg-warning-subtle text-warning' },
  stock_low: { icon: <AlertCircle size={13} />, bg: 'bg-negative-subtle text-negative' },
  order: { icon: <ShoppingCart size={13} />, bg: 'bg-info-subtle text-info' },
  cashback: { icon: <DollarSign size={13} />, bg: 'bg-positive-subtle text-positive' },
  listing: { icon: <PackageCheck size={13} />, bg: 'bg-positive-subtle text-positive' },
  scrape: { icon: <Zap size={13} />, bg: 'bg-info-subtle text-info' },
  margin: { icon: <TrendingUp size={13} />, bg: 'bg-positive-subtle text-positive' },
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const supabase = createClient();

        const [alertsRes, ordersRes, cashbackRes] = await Promise.all([
          supabase
            .from('price_alerts')
            .select('id, alert_type, message, created_at, products(title)')
            .order('created_at', { ascending: false })
            .limit(4),
          supabase
            .from('orders')
            .select('id, bonanza_order_id, product_title, status, cashback_site, cashback_pct, created_at')
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('cashback_earnings')
            .select('id, site, amount, earned_at')
            .order('earned_at', { ascending: false })
            .limit(2),
        ]);

        const items: ActivityItem[] = [];

        // Alerts
        for (const row of alertsRes.data || []) {
          const product = row.products as Record<string, unknown> | null;
          const title = (product?.title as string) || 'Unknown product';
          const isStock = row.alert_type === 'stock_low';
          items.push({
            id: `alert-${row.id}`,
            type: row.alert_type,
            iconBg: isStock ? 'bg-negative-subtle text-negative' : 'bg-warning-subtle text-warning',
            message: isStock ? 'Stock alert detected' : 'Price change detected',
            detail: `${title} · ${row.message || row.alert_type}`,
            time: relativeTime(row.created_at),
          });
        }

        // Orders
        for (const row of ordersRes.data || []) {
          const orderId = row.bonanza_order_id || row.id.slice(0, 8).toUpperCase();
          const hasCashback = row.cashback_site && row.cashback_pct;
          items.push({
            id: `order-${row.id}`,
            type: 'order',
            iconBg: 'bg-info-subtle text-info',
            message: hasCashback ? `Order routed through ${row.cashback_site}` : `Order ${row.status}`,
            detail: `${orderId} · ${row.product_title}${hasCashback ? ` · ${row.cashback_pct}% cashback` : ''}`,
            time: relativeTime(row.created_at),
          });
        }

        // Cashback
        for (const row of cashbackRes.data || []) {
          items.push({
            id: `cb-${row.id}`,
            type: 'cashback',
            iconBg: 'bg-positive-subtle text-positive',
            message: 'Cashback confirmed',
            detail: `$${Number(row.amount).toFixed(2)} from ${row.site}`,
            time: relativeTime(row.earned_at),
          });
        }

        // Sort by recency (items already ordered by DB, just merge)
        items.sort((a, b) => {
          // Keep original order since each group is already sorted
          return 0;
        });

        setActivities(items.slice(0, 8));
      } catch (err) {
        console.error('Activity feed error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
  }, []);

  const getIcon = (type: string) => TYPE_ICON[type] || TYPE_ICON.scrape;

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Pipeline Activity</h3>
        <span className="text-xs text-muted-foreground">Recent</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-secondary animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-secondary animate-pulse rounded w-3/4" />
                <div className="h-2.5 bg-secondary animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No recent activity</p>
          <p className="text-xs text-muted-foreground mt-1">Activity will appear here as your pipeline runs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => {
            const { icon, bg } = getIcon(item.type);
            return (
              <div key={item.id} className="flex items-start gap-3 group">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-tight">{item.message}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono-data">{item.time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}