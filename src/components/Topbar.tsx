'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell, RefreshCw, Bot, Menu, LogOut, AlertTriangle, AlertCircle, X, CheckCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onMobileMenuOpen?: () => void;
  onAIAgentOpen?: () => void;
}

interface AlertItem {
  id: string;
  type: 'price' | 'stock';
  severity: 'warning' | 'alert';
  title: string;
  detail: string;
}

function mapAlert(row: Record<string, unknown>): AlertItem {
  const isStock = (row.alert_type as string) === 'stock_low';
  const oldVal = row.old_value as number | null;
  const newVal = row.new_value as number | null;
  const product = row.products as Record<string, unknown> | null;
  const title = (product?.title as string) || (row.message as string) || 'Unknown product';
  let detail = (row.message as string) || '';
  if (!detail) {
    if (isStock) {
      detail = 'Low stock or out of stock at source';
    } else if (oldVal != null && newVal != null) {
      const pct = oldVal > 0 ? Math.round(((newVal - oldVal) / oldVal) * 100) : 0;
      detail = `Price ${pct > 0 ? '+' : ''}${pct}% ($${oldVal.toFixed(2)} → $${newVal.toFixed(2)})`;
    }
  }
  return { id: row.id as string, type: isStock ? 'stock' : 'price', severity: isStock ? 'alert' : 'warning', title, detail };
}

export default function Topbar({ title, subtitle, onMobileMenuOpen, onAIAgentOpen }: TopbarProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const { signOut, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Los_Angeles',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('price_alerts')
        .select('*, products(title)')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(8);
      setAlerts((data || []).map((r) => mapAlert(r as Record<string, unknown>)));
    } catch {
      // silently fail
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!alertsOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [alertsOpen]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch {}
  };

  const dismissAlert = async (id: string) => {
    const supabase = createClient();
    await supabase.from('price_alerts').update({ is_read: true }).eq('id', id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const dismissAll = async () => {
    const supabase = createClient();
    const ids = alerts.map((a) => a.id);
    if (ids.length > 0) {
      await supabase.from('price_alerts').update({ is_read: true }).in('id', ids);
    }
    setAlerts([]);
    setAlertsOpen(false);
  };

  const alertCount = alerts.length;

  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b min-h-[60px] flex-shrink-0"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <button
          className="btn-ghost p-2 lg:hidden"
          onClick={onMobileMenuOpen}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-base font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>{title}</h1>
          {subtitle && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <div className="pulse-dot" style={{ backgroundColor: 'var(--positive)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--positive)' }}>Live</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>· {currentTime} PST</span>
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            placeholder="Search products, orders..."
            className="input-base pl-8 w-48 lg:w-64 h-8 text-xs"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono-data" style={{ color: 'var(--muted-foreground)' }}>⌘K</kbd>
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="btn-ghost p-2"
          aria-label="Refresh data"
          disabled={isRefreshing}
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} style={{ color: isRefreshing ? 'var(--primary)' : undefined }} />
        </button>

        {/* AI Agent */}
        <button
          onClick={onAIAgentOpen}
          className="btn-ghost p-2 relative"
          aria-label="Open AI Agent"
        >
          <Bot size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
        </button>

        {/* Notifications Bell with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="btn-ghost p-2 relative"
            aria-label="Notifications"
            onClick={() => {
              setAlertsOpen((prev) => !prev);
              if (!alertsOpen) fetchAlerts();
            }}
          >
            <Bell size={16} />
            {alertCount > 0 && (
              <span
                className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: 'var(--negative)' }}
              >
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Bell size={14} style={{ color: 'var(--foreground)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Alerts</span>
                  {alertCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--negative)' }}
                    >
                      {alertCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {alertCount > 0 && (
                    <button
                      onClick={dismissAll}
                      className="btn-ghost text-[11px] gap-1 px-2 py-1"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <CheckCheck size={12} />
                      Clear all
                    </button>
                  )}
                  <button
                    onClick={() => setAlertsOpen(false)}
                    className="btn-ghost p-1"
                    aria-label="Close alerts"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="max-h-72 overflow-y-auto">
                {alertsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--secondary)' }} />
                    ))}
                  </div>
                ) : alertCount === 0 ? (
                  <div className="py-8 text-center px-4">
                    <p className="text-sm font-medium" style={{ color: 'var(--positive)' }}>All clear — no active alerts</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Listings are healthy and in sync</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg"
                        style={{
                          backgroundColor: alert.severity === 'alert' ?'rgba(239,68,68,0.07)' :'rgba(245,158,11,0.07)',
                          border: `1px solid ${alert.severity === 'alert' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`,
                        }}
                      >
                        <span className="mt-0.5 flex-shrink-0" style={{ color: alert.severity === 'alert' ? 'var(--negative)' : 'var(--warning)' }}>
                          {alert.severity === 'alert' ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>{alert.title}</p>
                          <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--muted-foreground)' }}>{alert.detail}</p>
                        </div>
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="btn-ghost p-0.5 flex-shrink-0"
                          aria-label="Dismiss"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        {user && (
          <button
            onClick={handleSignOut}
            className="btn-ghost p-2"
            aria-label="Sign out"
            title={`Sign out (${user.email})`}
          >
            <LogOut size={16} />
          </button>
        )}

        {/* New Estimate style CTA */}
        <button className="btn-primary hidden sm:inline-flex text-xs px-3 py-1.5">
          + New Scrape
        </button>
      </div>
    </header>
  );
}