'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import OrderKPICards from './OrderKPICards';
import OrdersTable from './OrdersTable';
import OrderDetailDrawer from './OrderDetailDrawer';
import { Order, OrderStatus } from './ordersData';

const STATUS_FILTERS: { id: string; label: string; value: OrderStatus | 'all' }[] = [
  { id: 'sf-all', label: 'All Orders', value: 'all' },
  { id: 'sf-routing', label: 'Routing', value: 'cashback-routing' },
  { id: 'sf-ordering', label: 'Ordering', value: 'ordering' },
  { id: 'sf-shipped', label: 'Shipped', value: 'shipped' },
  { id: 'sf-delivered', label: 'Delivered', value: 'delivered' },
  { id: 'sf-completed', label: 'Completed', value: 'completed' },
  { id: 'sf-exception', label: 'Exception', value: 'exception' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'rakuten', label: 'Rakuten' },
  { value: 'topcashback', label: 'TopCashback' },
  { value: 'befrugal', label: 'BeFrugal' },
  { value: 'swagbucks', label: 'Swagbucks' },
  { value: 'ibotta', label: 'Ibotta' },
];

function mapDbOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    bonanzaOrderId: row.bonanza_order_id as string,
    buyer: row.buyer as string,
    product: row.product_title as string,
    source: row.source as string,
    sourceUrl: (row.source_url as string) || '',
    buyPrice: row.buy_price as number,
    sellPrice: row.sell_price as number,
    margin: row.margin as number,
    cashbackSite: (row.cashback_site as string) || '',
    cashbackPct: (row.cashback_pct as number) || 0,
    cashbackEarned: (row.cashback_earned as number) || 0,
    status: row.status as OrderStatus,
    trackingNumber: (row.tracking_number as string) || '',
    carrier: (row.carrier as string) || '',
    createdAt: row.created_at as string,
    shippedAt: (row.shipped_at as string) || '',
    deliveredAt: (row.delivered_at as string) || '',
    notes: (row.notes as string) || '',
  };
}

export default function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function fetchOrders() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('Orders fetch error:', error.message); return; }
      setOrders((data || []).map(mapDbOrder));
    } catch (err) {
      console.error('Orders error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchOrders(); }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOrders();
    setIsRefreshing(false);
  };

  const filteredOrders = orders.filter((o) => {
    const statusMatch = statusFilter === 'all' || o.status === statusFilter;
    const sourceMatch = sourceFilter === 'all' || o.source === sourceFilter;
    const searchMatch =
      !searchQuery ||
      o.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.buyer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.bonanzaOrderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && sourceMatch && searchMatch;
  });

  return (
    <div className="space-y-5">
      <OrderKPICards orders={orders} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders, buyers, tracking..."
              className="input-base pl-8 h-8 text-xs w-56"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-primary/10 text-primary border border-primary/20' :'bg-secondary text-muted-foreground border border-border hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-muted-foreground" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input-base h-8 text-xs w-auto pr-6"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-secondary text-xs gap-1.5 disabled:opacity-60"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh Status
          </button>
          <button className="btn-secondary text-xs gap-1.5">
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading orders...' : (
            <><span className="text-foreground font-medium">{filteredOrders.length}</span> orders</>
          )}
        </p>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear search
          </button>
        )}
      </div>

      {loading ? (
        <div className="card-elevated py-16 flex items-center justify-center">
          <RefreshCw size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card-elevated py-16 flex flex-col items-center justify-center text-center">
          <Search size={32} className="text-muted-foreground mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No orders found</p>
          <p className="text-sm text-muted-foreground max-w-sm">Try adjusting your search or filters.</p>
          <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="btn-secondary mt-4 text-sm">
            Clear filters
          </button>
        </div>
      ) : (
        <OrdersTable orders={filteredOrders} onSelectOrder={setSelectedOrder} />
      )}

      {selectedOrder && (
        <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}