'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  ShoppingBag,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  Settings,
  Zap,
  Bot,
  Bell,
  LogOut,
  TrendingUp,
  Users,
  Shield,
  Globe,
  Plug,
  DollarSign,
  Store,
  BarChart2,
  ShoppingCart,
  Compass,
  ScrollText,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  group: string;
}

const navItemsBase: Omit<NavItem, 'badge'>[] = [
  { id: 'nav-dashboard', label: 'Dashboard', href: '/', icon: <LayoutDashboard size={18} />, group: 'main' },
  { id: 'nav-products', label: 'Product Review', href: '/product-review-listings', icon: <ShoppingBag size={18} />, group: 'main' },
  { id: 'nav-discovery', label: 'Product Discovery', href: '/product-discovery', icon: <Compass size={18} />, group: 'main' },
  { id: 'nav-orders', label: 'Orders', href: '/orders', icon: <PackageCheck size={18} />, group: 'main' },
  { id: 'nav-bonanza', label: 'Bonanza Listings', href: '/bonanza-listings', icon: <Store size={18} />, group: 'main' },
  { id: 'nav-google-shopping', label: 'Google Shopping Feed', href: '/google-shopping-feed', icon: <ShoppingCart size={18} />, group: 'main' },
  { id: 'nav-sales', label: 'Sales Dashboard', href: '/sales-dashboard', icon: <BarChart2 size={18} />, group: 'main' },
  { id: 'nav-scrapers', label: 'Scrapers', href: '/scrapers', icon: <Globe size={18} />, group: 'automation' },
  { id: 'nav-campaigns', label: 'Scrape Campaigns', href: '/campaigns', icon: <Zap size={18} />, group: 'automation' },
  { id: 'nav-pricing', label: 'Pricing Rules', href: '/pricing-rules', icon: <DollarSign size={18} />, group: 'automation' },
  { id: 'nav-ai', label: 'AI Agent', href: '/ai-agent', icon: <Bot size={18} />, group: 'automation' },
  { id: 'nav-analytics', label: 'Analytics', href: '/analytics', icon: <TrendingUp size={18} />, group: 'automation' },
  { id: 'nav-activity-logs', label: 'Activity Logs', href: '/activity-logs', icon: <ScrollText size={18} />, group: 'admin' },
  { id: 'nav-api', label: 'API Connections', href: '/api-connections', icon: <Plug size={18} />, group: 'admin' },
  { id: 'nav-admin-users', label: 'Users', href: '/admin/users', icon: <Users size={18} />, group: 'admin' },
  { id: 'nav-admin-platform', label: 'Platform', href: '/admin/platform', icon: <Shield size={18} />, group: 'admin' },
  { id: 'nav-settings', label: 'Settings', href: '/settings', icon: <Settings size={18} />, group: 'system' },
];

const groupLabels: Record<string, string> = {
  main: 'Pipeline',
  automation: 'Automation',
  admin: 'Admin',
  system: 'System',
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState(0);
  const [productReviewCount, setProductReviewCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const { user, signOut } = useAuth();

  const fetchAlertCount = useCallback(async () => {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('price_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      setAlertCount(count ?? 0);
    } catch {
      setAlertCount(0);
    }
  }, []);

  const fetchNavCounts = useCallback(async () => {
    try {
      const supabase = createClient();
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
      ]);
      setProductReviewCount(productsRes.count ?? 0);
      setOrdersCount(ordersRes.count ?? 0);
    } catch {
      setProductReviewCount(0);
      setOrdersCount(0);
    }
  }, []);

  useEffect(() => {
    fetchAlertCount();
    fetchNavCounts();
  }, [fetchAlertCount, fetchNavCounts]);

  const navItems: NavItem[] = navItemsBase.map((item) => {
    if (item.id === 'nav-products') return { ...item, badge: productReviewCount };
    if (item.id === 'nav-orders') return { ...item, badge: ordersCount };
    return item;
  });

  const groups = ['main', 'automation', 'admin', 'system'];

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose();
  };

  const handleViewAlerts = () => {
    if (onMobileClose) onMobileClose();
    if (pathname === '/') {
      // Already on dashboard — scroll to the alerts panel
      const el = document.getElementById('alerts-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      router.push('/#alerts-panel');
    }
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className="flex flex-col h-screen border-r transition-all duration-300 ease-in-out flex-shrink-0"
      style={{
        width: collapsed ? '64px' : '240px',
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between px-3 py-4 min-h-[60px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <AppLogo size={28} />
            <span className="font-semibold text-base text-white whitespace-nowrap">DropAutoAI</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <AppLogo size={28} />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md transition-colors ml-1"
            style={{ color: 'var(--sidebar-text)' }}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Alerts bar */}
      {!collapsed && (
        <button
          onClick={handleViewAlerts}
          className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 w-[calc(100%-24px)] text-left transition-opacity hover:opacity-80 active:opacity-60"
          style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}
        >
          <Bell size={13} style={{ color: '#f97316' }} className="flex-shrink-0" />
          <span className="text-xs font-medium" style={{ color: '#fb923c' }}>
            {alertCount > 0 ? `${alertCount} active alert${alertCount !== 1 ? 's' : ''}` : 'No active alerts'}
          </span>
          {alertCount > 0 && (
            <span className="ml-auto text-xs font-mono-data" style={{ color: 'rgba(249,115,22,0.6)' }}>View</span>
          )}
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {groups.map((group) => {
          const items = navItems.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <div key={`group-${group}`}>
              {!collapsed && (
                <p
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(136,146,164,0.6)' }}
                >
                  {groupLabels[group]}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = pathname === item.href;
                  if (collapsed) {
                    return (
                      <div key={item.id} className="relative group">
                        <Link href={item.href} onClick={handleNavClick}>
                          <div className={`nav-item-collapsed ${isActive ? 'active' : ''}`}>
                            {item.icon}
                            {item.badge && item.badge > 0 && (
                              <span
                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                                style={{ backgroundColor: 'var(--primary)' }}
                              >
                                {item.badge > 9 ? '9+' : item.badge}
                              </span>
                            )}
                          </div>
                        </Link>
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block">
                          <div
                            className="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap shadow-lg"
                            style={{ background: '#243050', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}
                          >
                            {item.label}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Link key={item.id} href={item.href} onClick={handleNavClick}>
                      <div className={`nav-item ${isActive ? 'active' : ''}`}>
                        <span className="flex-shrink-0">{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span
                            className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(249,115,22,0.15)',
                              color: isActive ? '#ffffff' : '#f97316',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {collapsed ? (
          <div className="space-y-0.5">
            <button onClick={onToggle} className="nav-item-collapsed w-full" aria-label="Expand sidebar">
              <ChevronRight size={18} />
            </button>
            <div className="nav-item-collapsed w-full">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'var(--primary)' }}
              >
                {initials}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'var(--primary)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs truncate" style={{ color: 'var(--sidebar-text)' }}>{displayEmail}</p>
              </div>
              <button
                onClick={signOut}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--sidebar-text)' }}
                aria-label="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}