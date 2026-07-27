'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { Package, RefreshCw, ExternalLink, Search, CheckCircle2, AlertCircle, Clock, ShoppingBag, Globe, TrendingUp, Eye } from 'lucide-react';

interface BonanzaListing {
  id: string;
  bonanzaItemId: string | null;
  title: string;
  description: string;
  price: number | null;
  cost: number | null;
  marginPct: number | null;
  source: string;
  sourceUrl: string;
  imageUrl: string;
  category: string;
  sku: string;
  upc: string;
  quantity: number;
  status: string;
  googleShoppingStatus: string;
  googleShoppingId: string | null;
  bonanzaUrl: string | null;
  views: number;
  sales: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Active', bg: 'rgba(5,150,105,0.1)', color: '#059669', icon: <CheckCircle2 size={11} /> },
  inactive: { label: 'Inactive', bg: 'rgba(107,114,128,0.1)', color: '#6b7280', icon: <Clock size={11} /> },
  sold: { label: 'Sold Out', bg: 'rgba(239,68,68,0.1)', color: '#dc2626', icon: <AlertCircle size={11} /> },
  pending: { label: 'Pending', bg: 'rgba(245,158,11,0.1)', color: '#d97706', icon: <Clock size={11} /> },
};

const GOOGLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_submitted: { label: 'Not Submitted', color: '#6b7280' },
  pending: { label: 'Pending Review', color: '#d97706' },
  approved: { label: 'Approved', color: '#059669' },
  disapproved: { label: 'Disapproved', color: '#dc2626' },
  active: { label: 'Active', color: '#059669' },
};

const SOURCE_COLORS: Record<string, string> = {
  aliexpress: '#ef4444',
  walmart: '#3b82f6',
  rakuten: '#f59e0b',
  topcashback: '#10b981',
  befrugal: '#8b5cf6',
  firecrawl: '#f97316',
};

function mapDbListing(row: Record<string, unknown>): BonanzaListing {
  return {
    id: row.id as string,
    bonanzaItemId: row.bonanza_item_id as string | null,
    title: row.title as string,
    description: (row.description as string) || '',
    price: row.price as number | null,
    cost: row.cost as number | null,
    marginPct: row.margin_pct as number | null,
    source: (row.source as string) || '',
    sourceUrl: (row.source_url as string) || '',
    imageUrl: (row.image_url as string) || '',
    category: (row.category as string) || '',
    sku: (row.sku as string) || '',
    upc: (row.upc as string) || '',
    quantity: (row.quantity as number) || 1,
    status: (row.status as string) || 'active',
    googleShoppingStatus: (row.google_shopping_status as string) || 'not_submitted',
    googleShoppingId: row.google_shopping_id as string | null,
    bonanzaUrl: row.bonanza_url as string | null,
    views: (row.views as number) || 0,
    sales: (row.sales as number) || 0,
    lastSyncedAt: row.last_synced_at as string | null,
    createdAt: row.created_at as string,
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BonanzaListingsPage() {
  const [listings, setListings] = useState<BonanzaListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [googleFilter, setGoogleFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('bonanza_listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) { console.error('Bonanza listings fetch error:', error.message); }
      setListings((data || []).map((r) => mapDbListing(r as Record<string, unknown>)));
    } catch (err) {
      console.error('Bonanza listings error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSyncMessage({ type: 'error', text: 'Not authenticated. Please log in.' });
        return;
      }

      // Fetch Bonanza API credentials — stored as developerId, certificateId, authToken
      const { data: credRow, error: credError } = await supabase
        .from('api_credentials')
        .select('credentials')
        .eq('user_id', user.id)
        .eq('service', 'bonanza')
        .single();

      if (credError || !credRow) {
        setSyncMessage({
          type: 'error',
          text: 'Bonanza credentials not found. Please add your Bonanza Developer ID, Certificate ID, and Auth Token in API Connections.',
        });
        return;
      }

      const creds = (credRow?.credentials as Record<string, string>) || {};
      // Support multiple field name conventions
      const developerId = creds.developerId || creds.developer_id || creds.apiKey || '';
      const certificateId = creds.certificateId || creds.certificate_id || creds.certId || '';
      const authToken = creds.authToken || creds.auth_token || creds.accessToken || '';

      if (!developerId && !certificateId && !authToken) {
        setSyncMessage({
          type: 'error',
          text: 'Bonanza credentials are incomplete. Please add your Developer ID, Certificate ID, and Auth Token in API Connections.',
        });
        return;
      }

      // Attempt to fetch listings from Bonanza API
      const response = await fetch('/api/bonanza/fetch-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_listings',
          userId: user.id,
          developerId,
          certificateId,
          authToken,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Sync failed with status ${response.status}`);
      }

      const result = await response.json();
      await fetchListings();
      setSyncMessage({
        type: 'success',
        text: result.message || `Sync complete. ${result.synced ?? 0} listings updated.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncMessage({ type: 'error', text: msg });
      console.error('Bonanza sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = listings.filter((l) => {
    const statusMatch = statusFilter === 'all' || l.status === statusFilter;
    const googleMatch = googleFilter === 'all' || l.googleShoppingStatus === googleFilter;
    const searchMatch = !searchQuery ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.upc.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && googleMatch && searchMatch;
  });

  const totalRevenue = listings.reduce((s, l) => s + (l.price || 0) * l.sales, 0);
  const avgMargin = listings.length > 0
    ? listings.filter((l) => l.marginPct != null).reduce((s, l) => s + (l.marginPct || 0), 0) / (listings.filter((l) => l.marginPct != null).length || 1)
    : 0;
  const activeCount = listings.filter((l) => l.status === 'active').length;
  const googleApproved = listings.filter((l) => l.googleShoppingStatus === 'approved' || l.googleShoppingStatus === 'active').length;

  return (
    <AppLayout title="Bonanza Listings" subtitle="Products listed on Bonanza marketplace and Google Shopping">
      <div className="space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Listings', value: listings.length, color: 'var(--primary)', icon: <Package size={16} /> },
            { label: 'Active on Bonanza', value: activeCount, color: 'var(--positive)', icon: <ShoppingBag size={16} /> },
            { label: 'Google Shopping', value: googleApproved, color: 'var(--info)', icon: <Globe size={16} /> },
            { label: 'Avg Margin', value: `${avgMargin.toFixed(1)}%`, color: 'var(--positive)', icon: <TrendingUp size={16} /> },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated px-4 py-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--card)', color: stat.color }}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Sync message */}
        {syncMessage && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-lg text-xs"
            style={{
              background: syncMessage.type === 'success' ? 'rgba(16,185,129,0.08)' : syncMessage.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
              border: `1px solid ${syncMessage.type === 'success' ? 'rgba(16,185,129,0.25)' : syncMessage.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'}`,
              color: syncMessage.type === 'success' ? '#10b981' : syncMessage.type === 'error' ? '#ef4444' : '#818cf8',
            }}
          >
            {syncMessage.type === 'success' ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />}
            <span>{syncMessage.text}</span>
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: '#c2410c' }}>
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Bonanza API Setup Required:</strong> To sync live listings from your Bonanza account, add your Bonanza API credentials in <strong>API Connections</strong>. Once connected, use the <strong>Sync Now</strong> button to pull your current listings. Products approved for Google Shopping will show their status here. New products from the scraper can be pushed to Bonanza directly from the Product Review queue.
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listings..."
                className="input-base pl-8 h-8 text-xs w-48"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base h-8 text-xs">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="sold">Sold Out</option>
              <option value="pending">Pending</option>
            </select>
            <select value={googleFilter} onChange={(e) => setGoogleFilter(e.target.value)} className="input-base h-8 text-xs">
              <option value="all">All Google Status</option>
              <option value="approved">Google Approved</option>
              <option value="active">Google Active</option>
              <option value="pending">Google Pending</option>
              <option value="disapproved">Google Disapproved</option>
              <option value="not_submitted">Not Submitted</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-secondary text-xs gap-1.5 disabled:opacity-60"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-elevated h-24 animate-pulse" style={{ background: 'var(--card)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated px-6 py-14 text-center">
            <ShoppingBag size={36} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {listings.length === 0 ? 'No Bonanza listings yet' : 'No listings match your filters'}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {listings.length === 0
                ? 'Connect your Bonanza account in API Connections, then click Sync Now to pull your listings.' :'Try adjusting your search or filter criteria.'}
            </p>
            {listings.length === 0 && (
              <button onClick={handleSync} disabled={syncing} className="btn-primary text-xs mt-4 gap-1.5">
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync from Bonanza'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              <div className="col-span-4">Product</div>
              <div className="col-span-1 text-right">Price</div>
              <div className="col-span-1 text-right">Margin</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-1 text-center">Views</div>
              <div className="col-span-1 text-center">Sales</div>
              <div className="col-span-1 text-center">Bonanza</div>
              <div className="col-span-1 text-center">Google</div>
              <div className="col-span-1 text-center">Synced</div>
            </div>

            {filtered.map((listing) => {
              const statusCfg = STATUS_CONFIG[listing.status] || STATUS_CONFIG.inactive;
              const googleCfg = GOOGLE_STATUS_CONFIG[listing.googleShoppingStatus] || GOOGLE_STATUS_CONFIG.not_submitted;
              const sourceColor = SOURCE_COLORS[listing.source] || '#6b7280';

              return (
                <div key={listing.id} className="card-elevated px-4 py-3">
                  {/* Mobile layout */}
                  <div className="lg:hidden space-y-2">
                    <div className="flex items-start gap-3">
                      {listing.imageUrl ? (
                        <img src={listing.imageUrl} alt={listing.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card)' }}>
                          <Package size={20} style={{ color: 'var(--muted-foreground)' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{listing.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${sourceColor}18`, color: sourceColor }}>{listing.source}</span>
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{listing.price != null ? `$${listing.price.toFixed(2)}` : '—'}</p>
                        {listing.marginPct != null && (
                          <p className="text-xs" style={{ color: listing.marginPct >= 30 ? 'var(--positive)' : 'var(--warning)' }}>{listing.marginPct.toFixed(1)}%</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
                      <span><Eye size={11} className="inline mr-0.5" />{listing.views} views</span>
                      <span><ShoppingBag size={11} className="inline mr-0.5" />{listing.sales} sales</span>
                      <span style={{ color: googleCfg.color }}><Globe size={11} className="inline mr-0.5" />{googleCfg.label}</span>
                      {listing.bonanzaUrl && (
                        <a href={listing.bonanzaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline" style={{ color: 'var(--primary)' }}>
                          <ExternalLink size={11} /> View on Bonanza
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden lg:grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      {listing.imageUrl ? (
                        <img src={listing.imageUrl} alt={listing.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card)' }}>
                          <Package size={16} style={{ color: 'var(--muted-foreground)' }} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{listing.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: `${sourceColor}18`, color: sourceColor }}>{listing.source}</span>
                          {listing.sku && <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>SKU: {listing.sku}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{listing.price != null ? `$${listing.price.toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      {listing.marginPct != null ? (
                        <span className="text-xs font-medium" style={{ color: listing.marginPct >= 30 ? 'var(--positive)' : 'var(--warning)' }}>{listing.marginPct.toFixed(1)}%</span>
                      ) : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>}
                    </div>
                    <div className="col-span-1 text-center"><span className="text-xs" style={{ color: 'var(--foreground)' }}>{listing.quantity}</span></div>
                    <div className="col-span-1 text-center"><span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{listing.views}</span></div>
                    <div className="col-span-1 text-center">
                      <span className="text-xs font-medium" style={{ color: listing.sales > 0 ? 'var(--positive)' : 'var(--muted-foreground)' }}>{listing.sales}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="flex items-center justify-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-[10px] font-medium" style={{ color: googleCfg.color }}>{googleCfg.label}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{formatDate(listing.lastSyncedAt)}</span>
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
