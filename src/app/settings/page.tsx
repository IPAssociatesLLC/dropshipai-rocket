'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import {
  User, Bell, Globe, DollarSign, Shield, Save, CheckCircle2,
  RefreshCw, Eye, EyeOff, AlertCircle
} from 'lucide-react';

type TabId = 'profile' | 'notifications' | 'scraper' | 'cashback' | 'security';

interface ProfileData {
  full_name: string;
  email: string;
  avatar_url: string;
}

interface NotifPrefs {
  price_change_alerts: boolean;
  stock_low_alerts: boolean;
  new_products_ready: boolean;
  order_status_updates: boolean;
  cashback_confirmed: boolean;
  weekly_summary: boolean;
}

interface ScraperDefaults {
  min_margin_threshold: string;
  auto_list_threshold: string;
  price_check_interval: string;
  max_concurrent_scrapers: string;
  default_min_rating: string;
  default_free_shipping: boolean;
  default_gift_receipt: boolean;
  default_require_upc: boolean;
  default_require_sku: boolean;
  default_min_stock: string;
  default_max_shipping_days: string;
}

interface CashbackPrefs {
  cashback_routing_enabled: boolean;
  preferred_cashback_site: string;
  min_cashback_pct: string;
  auto_select_highest: boolean;
  bonanza_auto_sync: boolean;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'scraper', label: 'Scraper Defaults', icon: <Globe size={15} /> },
  { id: 'cashback', label: 'Cashback & Pricing', icon: <DollarSign size={15} /> },
  { id: 'security', label: 'Security', icon: <Shield size={15} /> },
];

const CASHBACK_SITES = ['Auto (Highest %)', 'Rakuten', 'TopCashback', 'BeFrugal', 'Swagbucks', 'Ibotta'];

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
        style={{ backgroundColor: checked ? 'var(--primary)' : 'var(--border)' }}
        aria-pressed={checked}
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 items-start" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="sm:col-span-1">
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>({ full_name: '', email: '', avatar_url: '' });
  const [notifs, setNotifs] = useState<NotifPrefs>({
    price_change_alerts: true,
    stock_low_alerts: true,
    new_products_ready: true,
    order_status_updates: true,
    cashback_confirmed: true,
    weekly_summary: false,
  });
  const [scraperDefaults, setScraperDefaults] = useState<ScraperDefaults>({
    min_margin_threshold: '30',
    auto_list_threshold: '50',
    price_check_interval: '60',
    max_concurrent_scrapers: '5',
    default_min_rating: '4.0',
    default_free_shipping: false,
    default_gift_receipt: false,
    default_require_upc: false,
    default_require_sku: false,
    default_min_stock: '1',
    default_max_shipping_days: '14',
  });
  const [cashbackPrefs, setCashbackPrefs] = useState<CashbackPrefs>({
    cashback_routing_enabled: true,
    preferred_cashback_site: 'Auto (Highest %)',
    min_cashback_pct: '3',
    auto_select_highest: true,
    bonanza_auto_sync: true,
  });

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Load profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('full_name, email, avatar_url')
        .eq('id', user.id)
        .single();
      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          email: profileData.email || user.email || '',
          avatar_url: profileData.avatar_url || '',
        });
      }

      // Load platform settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('key, value');
      if (settings) {
        const map: Record<string, string> = {};
        settings.forEach((s) => { map[s.key] = s.value || ''; });

        setScraperDefaults((prev) => ({
          ...prev,
          min_margin_threshold: map['min_margin_threshold'] || prev.min_margin_threshold,
          auto_list_threshold: map['auto_list_threshold'] || prev.auto_list_threshold,
          price_check_interval: map['price_check_interval'] || prev.price_check_interval,
          max_concurrent_scrapers: map['max_concurrent_scrapers'] || prev.max_concurrent_scrapers,
          default_min_rating: map['default_min_rating'] || prev.default_min_rating,
          default_free_shipping: map['default_free_shipping'] === 'true',
          default_gift_receipt: map['default_gift_receipt'] === 'true',
          default_require_upc: map['default_require_upc'] === 'true',
          default_require_sku: map['default_require_sku'] === 'true',
          default_min_stock: map['default_min_stock'] || prev.default_min_stock,
          default_max_shipping_days: map['default_max_shipping_days'] || prev.default_max_shipping_days,
        }));

        setCashbackPrefs((prev) => ({
          ...prev,
          cashback_routing_enabled: map['cashback_routing_enabled'] !== 'false',
          preferred_cashback_site: map['preferred_cashback_site'] || prev.preferred_cashback_site,
          min_cashback_pct: map['min_cashback_pct'] || prev.min_cashback_pct,
          auto_select_highest: map['auto_select_highest'] !== 'false',
          bonanza_auto_sync: map['bonanza_auto_sync'] !== 'false',
        }));

        setNotifs((prev) => ({
          price_change_alerts: map['notif_price_change'] !== 'false',
          stock_low_alerts: map['notif_stock_low'] !== 'false',
          new_products_ready: map['notif_new_products'] !== 'false',
          order_status_updates: map['notif_order_status'] !== 'false',
          cashback_confirmed: map['notif_cashback'] !== 'false',
          weekly_summary: map['notif_weekly_summary'] === 'true',
        }));
      }
    } catch (err) {
      console.error('Settings load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const upsertSetting = async (supabase: ReturnType<typeof createClient>, key: string, value: string, description?: string) => {
    await supabase.from('platform_settings').upsert({ key, value, description }, { onConflict: 'key' });
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const supabase = createClient();

      if (activeTab === 'profile') {
        await supabase.from('user_profiles').update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }).eq('id', userId);
      }

      if (activeTab === 'notifications') {
        const notifMap: Record<string, string> = {
          notif_price_change: String(notifs.price_change_alerts),
          notif_stock_low: String(notifs.stock_low_alerts),
          notif_new_products: String(notifs.new_products_ready),
          notif_order_status: String(notifs.order_status_updates),
          notif_cashback: String(notifs.cashback_confirmed),
          notif_weekly_summary: String(notifs.weekly_summary),
        };
        for (const [key, value] of Object.entries(notifMap)) {
          await upsertSetting(supabase, key, value);
        }
      }

      if (activeTab === 'scraper') {
        const scraperMap: Record<string, string> = {
          min_margin_threshold: scraperDefaults.min_margin_threshold,
          auto_list_threshold: scraperDefaults.auto_list_threshold,
          price_check_interval: scraperDefaults.price_check_interval,
          max_concurrent_scrapers: scraperDefaults.max_concurrent_scrapers,
          default_min_rating: scraperDefaults.default_min_rating,
          default_free_shipping: String(scraperDefaults.default_free_shipping),
          default_gift_receipt: String(scraperDefaults.default_gift_receipt),
          default_require_upc: String(scraperDefaults.default_require_upc),
          default_require_sku: String(scraperDefaults.default_require_sku),
          default_min_stock: scraperDefaults.default_min_stock,
          default_max_shipping_days: scraperDefaults.default_max_shipping_days,
        };
        for (const [key, value] of Object.entries(scraperMap)) {
          await upsertSetting(supabase, key, value);
        }
      }

      if (activeTab === 'cashback') {
        const cbMap: Record<string, string> = {
          cashback_routing_enabled: String(cashbackPrefs.cashback_routing_enabled),
          preferred_cashback_site: cashbackPrefs.preferred_cashback_site,
          min_cashback_pct: cashbackPrefs.min_cashback_pct,
          auto_select_highest: String(cashbackPrefs.auto_select_highest),
          bonanza_auto_sync: String(cashbackPrefs.bonanza_auto_sync),
        };
        for (const [key, value] of Object.entries(cbMap)) {
          await upsertSetting(supabase, key, value);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError('');
    setPwSuccess('');
    if (!newPassword || newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPwError(error.message); return; }
      setPwSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError('Failed to update password.');
    }
  };

  if (loading) {
    return (
      <AppLayout title="Settings" subtitle="Manage your account and platform preferences">
        <div className="flex items-center justify-center py-24">
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" subtitle="Manage your account and platform preferences">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab sidebar */}
        <div className="lg:w-48 flex-shrink-0">
          <nav className="card-elevated p-2 space-y-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
                style={{
                  background: activeTab === tab.id ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
                  border: activeTab === tab.id ? '1px solid rgba(249,115,22,0.2)' : '1px solid transparent',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="card-elevated p-6">
            {/* Profile */}
            {activeTab === 'profile' && (
              <div>
                <SectionHeader title="Profile Settings" description="Update your name and account information." />
                <div className="space-y-0">
                  <FieldRow label="Full Name" description="Your display name across the platform">
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="input-base text-sm h-9 w-full"
                      placeholder="Your full name"
                    />
                  </FieldRow>
                  <FieldRow label="Email Address" description="Used for login and notifications">
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="input-base text-sm h-9 w-full opacity-60 cursor-not-allowed"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Email cannot be changed here. Contact support to update.</p>
                  </FieldRow>
                  <FieldRow label="Avatar URL" description="Link to your profile picture">
                    <input
                      type="text"
                      value={profile.avatar_url}
                      onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                      className="input-base text-sm h-9 w-full"
                      placeholder="https://..."
                    />
                  </FieldRow>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div>
                <SectionHeader title="Notification Preferences" description="Choose which alerts and updates you receive." />
                <div>
                  <Toggle checked={notifs.price_change_alerts} onChange={(v) => setNotifs({ ...notifs, price_change_alerts: v })} label="Price Change Alerts" description="Notify when a source product price changes significantly" />
                  <Toggle checked={notifs.stock_low_alerts} onChange={(v) => setNotifs({ ...notifs, stock_low_alerts: v })} label="Low Stock Alerts" description="Notify when a listed product's source stock drops below threshold" />
                  <Toggle checked={notifs.new_products_ready} onChange={(v) => setNotifs({ ...notifs, new_products_ready: v })} label="New Products Ready for Review" description="Notify when a scrape cycle finds new profitable products" />
                  <Toggle checked={notifs.order_status_updates} onChange={(v) => setNotifs({ ...notifs, order_status_updates: v })} label="Order Status Updates" description="Notify on order status changes (shipped, delivered, exception)" />
                  <Toggle checked={notifs.cashback_confirmed} onChange={(v) => setNotifs({ ...notifs, cashback_confirmed: v })} label="Cashback Confirmed" description="Notify when cashback earnings are confirmed by a portal" />
                  <Toggle checked={notifs.weekly_summary} onChange={(v) => setNotifs({ ...notifs, weekly_summary: v })} label="Weekly Summary Email" description="Receive a weekly digest of revenue, margins, and cashback earned" />
                </div>
              </div>
            )}

            {/* Scraper Defaults */}
            {activeTab === 'scraper' && (
              <div>
                <SectionHeader title="Scraper Default Settings" description="These values pre-fill new scraper configurations. You can override per-scraper." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {[
                    { key: 'min_margin_threshold', label: 'Min Margin Threshold (%)', description: 'Products below this margin are filtered out', placeholder: '30' },
                    { key: 'auto_list_threshold', label: 'Auto-List Threshold (%)', description: 'Products above this margin are auto-approved', placeholder: '50' },
                    { key: 'price_check_interval', label: 'Price Check Interval (min)', description: 'How often to re-check source prices', placeholder: '60' },
                    { key: 'max_concurrent_scrapers', label: 'Max Concurrent Scrapers', description: 'Parallel scraper instances allowed', placeholder: '5' },
                    { key: 'default_min_rating', label: 'Default Min Rating (0–5)', description: 'Minimum seller/product rating', placeholder: '4.0' },
                    { key: 'default_min_stock', label: 'Default Min Stock Qty', description: 'Minimum units in stock required', placeholder: '1' },
                    { key: 'default_max_shipping_days', label: 'Default Max Shipping Days', description: 'Maximum acceptable shipping time', placeholder: '14' },
                  ].map(({ key, label, description, placeholder }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
                      <input
                        type="number"
                        value={scraperDefaults[key as keyof ScraperDefaults] as string}
                        onChange={(e) => setScraperDefaults({ ...scraperDefaults, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="input-base text-sm h-9"
                      />
                      <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>Default Toggles</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'default_free_shipping', label: 'Free Shipping Only by Default' },
                      { key: 'default_gift_receipt', label: 'Gift Receipt Required by Default' },
                      { key: 'default_require_upc', label: 'Require UPC by Default' },
                      { key: 'default_require_sku', label: 'Require SKU by Default' },
                    ].map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer"
                        style={{
                          background: scraperDefaults[key as keyof ScraperDefaults] ? 'rgba(249,115,22,0.08)' : 'var(--secondary)',
                          border: `1px solid ${scraperDefaults[key as keyof ScraperDefaults] ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!scraperDefaults[key as keyof ScraperDefaults]}
                          onChange={(e) => setScraperDefaults({ ...scraperDefaults, [key]: e.target.checked })}
                          className="accent-orange-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs font-medium" style={{ color: scraperDefaults[key as keyof ScraperDefaults] ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cashback & Pricing */}
            {activeTab === 'cashback' && (
              <div>
                <SectionHeader title="Cashback & Pricing Settings" description="Control how the auto-order system routes through cashback portals and syncs with Bonanza." />
                <div>
                  <Toggle checked={cashbackPrefs.cashback_routing_enabled} onChange={(v) => setCashbackPrefs({ ...cashbackPrefs, cashback_routing_enabled: v })} label="Cashback Routing Enabled" description="Route all orders through a cashback portal before placing" />
                  <Toggle checked={cashbackPrefs.auto_select_highest} onChange={(v) => setCashbackPrefs({ ...cashbackPrefs, auto_select_highest: v })} label="Auto-Select Highest Cashback" description="Always use the portal with the highest cashback % for each order" />
                  <Toggle checked={cashbackPrefs.bonanza_auto_sync} onChange={(v) => setCashbackPrefs({ ...cashbackPrefs, bonanza_auto_sync: v })} label="Bonanza Auto-Sync" description="Automatically push price and stock changes to Bonanza listings" />
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Preferred Cashback Site</label>
                    <select
                      value={cashbackPrefs.preferred_cashback_site}
                      onChange={(e) => setCashbackPrefs({ ...cashbackPrefs, preferred_cashback_site: e.target.value })}
                      className="input-base text-sm h-9"
                    >
                      {CASHBACK_SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {cashbackPrefs.auto_select_highest && (
                      <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Note: auto-select highest is on — this site is used as a fallback</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Minimum Cashback % to Route</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={cashbackPrefs.min_cashback_pct}
                      onChange={(e) => setCashbackPrefs({ ...cashbackPrefs, min_cashback_pct: e.target.value })}
                      className="input-base text-sm h-9"
                      placeholder="3"
                    />
                    <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Skip cashback routing if best available rate is below this</p>
                  </div>
                </div>
              </div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <div>
                <SectionHeader title="Security" description="Update your password and manage account security." />
                <div className="max-w-md space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>New Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-base text-sm h-9 w-full pr-9"
                        placeholder="Min 8 characters"
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
                        {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Confirm New Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-base text-sm h-9 w-full"
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>
                  {pwError && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
                      <AlertCircle size={13} /> {pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', color: '#059669' }}>
                      <CheckCircle2 size={13} /> {pwSuccess}
                    </div>
                  )}
                  <button onClick={handlePasswordChange} className="btn-primary text-sm gap-2">
                    <Shield size={14} /> Update Password
                  </button>
                </div>
              </div>
            )}

            {/* Save button (not for security tab) */}
            {activeTab !== 'security' && (
              <div className="flex justify-end mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary text-sm gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                  ) : saved ? (
                    <><CheckCircle2 size={14} /> Saved!</>
                  ) : (
                    <><Save size={14} /> Save Changes</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
