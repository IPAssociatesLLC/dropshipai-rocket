'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OrderRow {
  id: string;
  product: string;
  buyer: string;
  salePrice: string;
  margin: string;
  status: string;
  age: string;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  'cashback-routing': { label: 'Routing', cls: 'status-badge-pending' },
  ordering: { label: 'Ordering', cls: 'status-badge-info' },
  shipped: { label: 'Shipped', cls: 'status-badge-active' },
  delivered: { label: 'Delivered', cls: 'status-badge-active' },
  completed: { label: 'Done', cls: 'status-badge-active' },
  exception: { label: 'Exception', cls: 'status-badge-error' },
};

function relativeAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MiniOrderQueue() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('orders')
          .select('id, product_title, buyer, sell_price, margin, status, created_at, bonanza_order_id')
          .in('status', ['cashback-routing', 'ordering', 'shipped'])
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) { console.error('Order queue error:', error.message); return; }
        setOrders(
          (data || []).map((o) => ({
            id: o.bonanza_order_id || o.id.slice(0, 8).toUpperCase(),
            product: o.product_title,
            buyer: o.buyer,
            salePrice: `$${Number(o.sell_price).toFixed(2)}`,
            margin: o.margin != null ? `${Math.round(Number(o.margin))}%` : '—',
            status: o.status,
            age: relativeAge(o.created_at),
          }))
        );
      } catch (err) {
        console.error('Order queue error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Order Queue</h3>
        <Link href="/orders">
          <button className="btn-ghost text-xs gap-1 text-primary">
            View all
            <ArrowRight size={12} />
          </button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No active orders in queue</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const status = statusMap[order.status] || statusMap.ordering;
            return (
              <div
                key={`mini-ord-${order.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{order.product}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono-data text-[10px] text-muted-foreground">{order.id}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{order.buyer}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono-data text-xs text-foreground">{order.salePrice}</span>
                  <span className="text-[10px] text-positive font-semibold">{order.margin}</span>
                  <span className={status.cls}>{status.label}</span>
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock size={9} />
                    {order.age}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}