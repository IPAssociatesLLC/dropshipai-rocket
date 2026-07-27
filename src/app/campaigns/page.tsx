'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { Zap, Play, Pause, Trash2, Plus, RefreshCw, Search, Clock, CheckCircle2, AlertCircle, BarChart3, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Campaign {
  id: string;
  name: string;
  source: string;
  keywords: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  freeShipping: boolean;
  giftReceipt: boolean;
  minMargin: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  lastRunAt: string | null;
  nextRunAt: string | null;
  productsFound: number;
  productsProfitable: number;
  runCount: number;
  scheduleInterval: string;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  aliexpress: 'AliExpress',
  walmart: 'Walmart Flash',
  rakuten: 'Rakuten',
  topcashback: 'TopCashback',
  befrugal: 'BeFrugal',
  swagbucks: 'Swagbucks',
  ibotta: 'Ibotta',
};

const SOURCE_COLORS: Record<string, string> = {
  aliexpress: '#f97316',
  walmart: '#3b82f6',
  rakuten: '#ef4444',
  topcashback: '#10b981',
  befrugal: '#8b5cf6',
  swagbucks: '#f59e0b',
  ibotta: '#06b6d4',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  active: { bg: 'bg-positive-subtle', text: 'text-positive', icon: <CheckCircle2 size={12} /> },
  paused: { bg: 'bg-warning-subtle', text: 'text-warning', icon: <Pause size={12} /> },
  completed: { bg: 'bg-info-subtle', text: 'text-info', icon: <CheckCircle2 size={12} /> },
  error: { bg: 'bg-negative-subtle', text: 'text-negative', icon: <AlertCircle size={12} /> },
};

function mapDbCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    name: row.name as string,
    source: row.source as string,
    keywords: (row.keywords as string) || '',
    minPrice: row.min_price as number | null,
    maxPrice: row.max_price as number | null,
    minRating: (row.min_rating as number) || 4.0,
    freeShipping: (row.free_shipping as boolean) || false,
    giftReceipt: (row.gift_receipt as boolean) || false,
    minMargin: (row.min_margin as number) || 30,
    status: row.status as Campaign['status'],
    lastRunAt: row.last_run_at as string | null,
    nextRunAt: row.next_run_at as string | null,
    productsFound: (row.products_found as number) || 0,
    productsProfitable: (row.products_profitable as number) || 0,
    runCount: (row.run_count as number) || 0,
    scheduleInterval: (row.schedule_interval as string) || 'daily',
    createdAt: row.created_at as string,
  };
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '', source: 'aliexpress', keywords: '', minPrice: '', maxPrice: '',
    minRating: '4.0', freeShipping: false, giftReceipt: false, minMargin: '30',
    scheduleInterval: 'daily',
  });
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('scrape_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('Campaigns fetch error:', error.message); return; }
      setCampaigns((data || []).map(mapDbCampaign));
    } catch (err) {
      console.error('Campaigns error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const toggleStatus = async (campaign: Campaign) => {
    const supabase = createClient();
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    await supabase.from('scrape_campaigns').update({ status: newStatus }).eq('id', campaign.id);
    setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
  };

  const deleteCampaign = async (id: string) => {
    const supabase = createClient();
    await supabase.from('scrape_campaigns').delete().eq('id', id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const createCampaign = async () => {
    if (!newCampaign.name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('scrape_campaigns').insert({
        user_id: user.id,
        name: newCampaign.name,
        source: newCampaign.source,
        keywords: newCampaign.keywords,
        min_price: newCampaign.minPrice ? parseFloat(newCampaign.minPrice) : null,
        max_price: newCampaign.maxPrice ? parseFloat(newCampaign.maxPrice) : null,
        min_rating: parseFloat(newCampaign.minRating),
        free_shipping: newCampaign.freeShipping,
        gift_receipt: newCampaign.giftReceipt,
        min_margin: parseFloat(newCampaign.minMargin),
        schedule_interval: newCampaign.scheduleInterval,
        status: 'active',
      }).select().single();
      if (!error && data) {
        setCampaigns(prev => [mapDbCampaign(data as Record<string, unknown>), ...prev]);
        setShowNewForm(false);
        setNewCampaign({ name: '', source: 'aliexpress', keywords: '', minPrice: '', maxPrice: '', minRating: '4.0', freeShipping: false, giftReceipt: false, minMargin: '30', scheduleInterval: 'daily' });
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = campaigns.filter(c => {
    const statusMatch = statusFilter === 'all' || c.status === statusFilter;
    const searchMatch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.keywords.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  const totalProducts = campaigns.reduce((s, c) => s + c.productsFound, 0);
  const totalProfitable = campaigns.reduce((s, c) => s + c.productsProfitable, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  return (
    <AppLayout title="Scrape Campaigns" subtitle="Automated scraping schedules by source">
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Campaigns', value: campaigns.length, icon: <Zap size={16} />, color: 'bg-primary/10 text-primary' },
            { label: 'Active', value: activeCampaigns, icon: <Play size={16} />, color: 'bg-positive-subtle text-positive' },
            { label: 'Products Found', value: totalProducts, icon: <BarChart3 size={16} />, color: 'bg-info-subtle text-info' },
            { label: 'Profitable', value: totalProfitable, icon: <CheckCircle2 size={16} />, color: 'bg-positive-subtle text-positive' },
          ].map((kpi) => (
            <div key={kpi.label} className="card-elevated p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              </div>
              <p className="font-mono-data text-2xl font-bold text-foreground">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search campaigns..." className="input-base pl-8 h-8 text-xs w-48" />
            </div>
            <div className="flex items-center gap-1">
              {['all', 'active', 'paused', 'error'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setShowNewForm(true)} className="btn-primary text-xs gap-1.5">
            <Plus size={14} />New Campaign
          </button>
        </div>

        {/* New Campaign Form */}
        {showNewForm && (
          <div className="card-elevated p-5 border-2 border-primary/20">
            <h3 className="text-sm font-semibold text-foreground mb-4">New Scrape Campaign</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Campaign Name *</label>
                <input type="text" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AliExpress Electronics" className="input-base h-8 text-xs w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Source</label>
                <select value={newCampaign.source} onChange={e => setNewCampaign(p => ({ ...p, source: e.target.value }))} className="input-base h-8 text-xs w-full">
                  {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Keywords</label>
                <input type="text" value={newCampaign.keywords} onChange={e => setNewCampaign(p => ({ ...p, keywords: e.target.value }))} placeholder="wireless earbuds, phone stand..." className="input-base h-8 text-xs w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min Price ($)</label>
                <input type="number" value={newCampaign.minPrice} onChange={e => setNewCampaign(p => ({ ...p, minPrice: e.target.value }))} placeholder="0" className="input-base h-8 text-xs w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max Price ($)</label>
                <input type="number" value={newCampaign.maxPrice} onChange={e => setNewCampaign(p => ({ ...p, maxPrice: e.target.value }))} placeholder="100" className="input-base h-8 text-xs w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min Margin (%)</label>
                <input type="number" value={newCampaign.minMargin} onChange={e => setNewCampaign(p => ({ ...p, minMargin: e.target.value }))} placeholder="30" className="input-base h-8 text-xs w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Schedule</label>
                <select value={newCampaign.scheduleInterval} onChange={e => setNewCampaign(p => ({ ...p, scheduleInterval: e.target.value }))} className="input-base h-8 text-xs w-full">
                  <option value="hourly">Every Hour</option>
                  <option value="every_6_hours">Every 6 Hours</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={newCampaign.freeShipping} onChange={e => setNewCampaign(p => ({ ...p, freeShipping: e.target.checked }))} className="rounded" />
                  Free Shipping Only
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={newCampaign.giftReceipt} onChange={e => setNewCampaign(p => ({ ...p, giftReceipt: e.target.checked }))} className="rounded" />
                  Gift Receipt
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={createCampaign} disabled={saving || !newCampaign.name.trim()} className="btn-primary text-xs disabled:opacity-60">
                {saving ? <><RefreshCw size={13} className="animate-spin" />Saving...</> : <><Plus size={13} />Create Campaign</>}
              </button>
              <button onClick={() => setShowNewForm(false)} className="btn-secondary text-xs">Cancel</button>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        {loading ? (
          <div className="card-elevated py-16 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated py-16 flex flex-col items-center justify-center text-center">
            <Zap size={32} className="text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-foreground mb-1">No campaigns yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">Create your first scrape campaign to start finding profitable products automatically.</p>
            <button onClick={() => setShowNewForm(true)} className="btn-primary mt-4 text-sm"><Plus size={14} />New Campaign</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((campaign) => {
              const ss = STATUS_STYLES[campaign.status] || STATUS_STYLES.paused;
              const color = SOURCE_COLORS[campaign.source] || '#6b7280';
              const profitRate = campaign.productsFound > 0 ? Math.round((campaign.productsProfitable / campaign.productsFound) * 100) : 0;
              return (
                <div key={campaign.id} className="card-elevated p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${ss.bg} ${ss.text}`}>
                            {ss.icon}{campaign.status}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                            {SOURCE_LABELS[campaign.source] || campaign.source}
                          </span>
                        </div>
                        {campaign.keywords && (
                          <p className="text-xs text-muted-foreground truncate mb-2">Keywords: {campaign.keywords}</p>
                        )}
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BarChart3 size={11} />
                            <span><span className="text-foreground font-medium">{campaign.productsFound}</span> found · <span className="text-positive font-medium">{campaign.productsProfitable}</span> profitable ({profitRate}%)</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={11} />
                            <span>Last run: {formatRelativeTime(campaign.lastRunAt)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar size={11} />
                            <span>{campaign.scheduleInterval?.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Min margin: <span className="text-foreground font-medium">{campaign.minMargin}%</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggleStatus(campaign)}
                        className={`btn-secondary text-xs gap-1.5 ${campaign.status === 'active' ? 'text-warning' : 'text-positive'}`}>
                        {campaign.status === 'active' ? <><Pause size={12} />Pause</> : <><Play size={12} />Resume</>}
                      </button>
                      <button onClick={() => deleteCampaign(campaign.id)} className="btn-secondary text-xs text-negative gap-1.5">
                        <Trash2 size={12} />Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
