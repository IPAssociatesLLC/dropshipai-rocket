'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, ExternalLink, X, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Alert {
  id: string;
  type: string;
  severity: 'warning' | 'alert';
  title: string;
  detail: string;
  listing: string;
  action: string;
  productId: string | null;
}

function mapDbAlert(row: Record<string, unknown>): Alert {
  const isStock = (row.alert_type as string) === 'stock_low';
  const oldVal = row.old_value as number | null;
  const newVal = row.new_value as number | null;
  const product = row.products as Record<string, unknown> | null;
  const title = (product?.title as string) || (row.message as string) || 'Unknown product';
  const listing = (product?.bonanza_listing_id as string) || '—';

  let detail = (row.message as string) || '';
  if (!detail) {
    if (isStock) {
      detail = 'Low stock or out of stock at source';
    } else if (oldVal != null && newVal != null) {
      const pct = oldVal > 0 ? Math.round(((newVal - oldVal) / oldVal) * 100) : 0;
      detail = `Source price ${pct > 0 ? '+' : ''}${pct}% ($${oldVal.toFixed(2)} → $${newVal.toFixed(2)})`;
    }
  }

  return {
    id: row.id as string,
    type: isStock ? 'stock' : 'price',
    severity: isStock ? 'alert' : 'warning',
    title,
    detail,
    listing,
    action: isStock ? 'Check Source' : 'Update Price',
    productId: (row.product_id as string) || null,
  };
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('price_alerts')
        .select('*, products(title, bonanza_listing_id)')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) { console.error('Alerts fetch error:', error.message); return; }
      setAlerts((data || []).map((row) => mapDbAlert(row as Record<string, unknown>)));
    } catch (err) {
      console.error('Alerts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const dismiss = async (id: string) => {
    const supabase = createClient();
    await supabase.from('price_alerts').update({ is_read: true }).eq('id', id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAction = async (alert: Alert) => {
    const supabase = createClient();
    await supabase.from('price_alerts').update({ is_read: true }).eq('id', alert.id);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
  };

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Active Alerts</h3>
          {!loading && (
            <span className="badge-base bg-negative-subtle text-negative border border-negative/20">
              {alerts.length}
            </span>
          )}
        </div>
        <button onClick={fetchAlerts} className="btn-ghost text-xs gap-1">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Recheck all
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-positive font-medium">All clear — no active alerts</p>
          <p className="text-xs text-muted-foreground mt-1">Listings are healthy and in sync</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                alert.severity === 'alert' ?'bg-negative-subtle border-negative/20' :'bg-warning-subtle border-warning/20'
              }`}
            >
              <span className={alert.severity === 'alert' ? 'text-negative mt-0.5' : 'text-warning mt-0.5'}>
                {alert.severity === 'alert' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-foreground truncate">{alert.title}</p>
                  {alert.listing !== '—' && (
                    <span className="font-mono-data text-[10px] text-muted-foreground">{alert.listing}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{alert.detail}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => handleAction(alert)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      alert.severity === 'alert' ?'text-negative hover:bg-negative/10' :'text-warning hover:bg-warning/10'
                    } transition-colors`}
                  >
                    {alert.action}
                  </button>
                  <button className="btn-ghost p-0 text-[11px] gap-0.5 text-muted-foreground">
                    <ExternalLink size={10} />
                    Source
                  </button>
                </div>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="btn-ghost p-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss alert"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}