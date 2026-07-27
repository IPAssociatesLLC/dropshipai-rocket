'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { Shield, Settings, Save, RefreshCw, CheckCircle2, ToggleLeft, ToggleRight, DollarSign, Clock, Zap, Package } from 'lucide-react';

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  description: string;
}

const SETTING_META: Record<string, { label: string; type: 'number' | 'boolean' | 'text'; icon: React.ReactNode; group: string }> = {
  min_margin_threshold: { label: 'Min Margin Threshold (%)', type: 'number', icon: <DollarSign size={14} />, group: 'Scraping' },
  auto_list_threshold: { label: 'Auto-List Threshold (%)', type: 'number', icon: <Zap size={14} />, group: 'Scraping' },
  price_check_interval: { label: 'Price Check Interval (mins)', type: 'number', icon: <Clock size={14} />, group: 'Monitoring' },
  max_concurrent_scrapers: { label: 'Max Concurrent Scrapers', type: 'number', icon: <Package size={14} />, group: 'Scraping' },
  cashback_routing_enabled: { label: 'Cashback Routing Enabled', type: 'boolean', icon: <DollarSign size={14} />, group: 'Automation' },
  bonanza_auto_sync: { label: 'Bonanza Auto-Sync', type: 'boolean', icon: <RefreshCw size={14} />, group: 'Automation' },
};

const GROUPS = ['Scraping', 'Monitoring', 'Automation'];

export default function AdminPlatformPage() {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('key');
      if (error) { console.error('Settings fetch error:', error.message); return; }
      const rows = data || [];
      setSettings(rows as PlatformSetting[]);
      const vals: Record<string, string> = {};
      rows.forEach((r: PlatformSetting) => { vals[r.key] = r.value || ''; });
      setLocalValues(vals);
    } catch (err) {
      console.error('Settings error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSetting = async (key: string) => {
    setSaving(key);
    try {
      const supabase = createClient();
      await supabase.from('platform_settings').update({ value: localValues[key], updated_at: new Date().toISOString() }).eq('key', key);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } finally {
      setSaving(null);
    }
  };

  const toggleBoolean = async (key: string) => {
    const current = localValues[key] === 'true';
    const newVal = String(!current);
    setLocalValues(prev => ({ ...prev, [key]: newVal }));
    setSaving(key);
    const supabase = createClient();
    await supabase.from('platform_settings').update({ value: newVal, updated_at: new Date().toISOString() }).eq('key', key);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  };

  const settingsByGroup = GROUPS.map(group => ({
    group,
    items: settings.filter(s => SETTING_META[s.key]?.group === group),
  })).filter(g => g.items.length > 0);

  return (
    <AppLayout title="Platform" subtitle="Global platform configuration and automation settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="card-elevated p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Platform Settings</h2>
            <p className="text-sm text-muted-foreground">Configure global automation rules, thresholds, and system behavior</p>
          </div>
          <button onClick={fetchSettings} className="ml-auto btn-secondary text-xs gap-1.5">
            <RefreshCw size={13} />Refresh
          </button>
        </div>

        {loading ? (
          <div className="card-elevated py-16 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {settingsByGroup.map(({ group, items }) => (
              <div key={group} className="card-elevated overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)' }}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{group}</h3>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {items.map((setting) => {
                    const meta = SETTING_META[setting.key];
                    if (!meta) return null;
                    const isBoolean = meta.type === 'boolean';
                    const isSaving = saving === setting.key;
                    const isSaved = saved === setting.key;
                    return (
                      <div key={setting.key} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
                            {meta.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">{setting.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isBoolean ? (
                            <button
                              onClick={() => toggleBoolean(setting.key)}
                              disabled={isSaving}
                              className="flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {localValues[setting.key] === 'true' ? (
                                <><ToggleRight size={28} className="text-positive" /><span className="text-positive">Enabled</span></>
                              ) : (
                                <><ToggleLeft size={28} className="text-muted-foreground" /><span className="text-muted-foreground">Disabled</span></>
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={localValues[setting.key] || ''}
                                onChange={e => setLocalValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                                className="input-base h-8 text-xs w-24 text-center font-mono-data"
                              />
                              <button
                                onClick={() => saveSetting(setting.key)}
                                disabled={isSaving}
                                className="btn-secondary text-xs gap-1.5 disabled:opacity-60"
                              >
                                {isSaving ? <RefreshCw size={12} className="animate-spin" /> :
                                  isSaved ? <CheckCircle2 size={12} className="text-positive" /> :
                                  <Save size={12} />}
                                {isSaved ? 'Saved' : 'Save'}
                              </button>
                            </div>
                          )}
                          {isSaved && isBoolean && (
                            <CheckCircle2 size={14} className="text-positive" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Unknown settings */}
            {settings.filter(s => !SETTING_META[s.key]).length > 0 && (
              <div className="card-elevated overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--secondary)' }}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Other Settings</h3>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {settings.filter(s => !SETTING_META[s.key]).map(setting => (
                    <div key={setting.key} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
                          <Settings size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground font-mono-data">{setting.key}</p>
                          <p className="text-xs text-muted-foreground">{setting.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={localValues[setting.key] || ''}
                          onChange={e => setLocalValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          className="input-base h-8 text-xs w-32 font-mono-data"
                        />
                        <button onClick={() => saveSetting(setting.key)} disabled={saving === setting.key} className="btn-secondary text-xs gap-1.5 disabled:opacity-60">
                          {saving === setting.key ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
