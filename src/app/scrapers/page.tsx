'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import {
  Globe, ShoppingCart, Tag, Star, Truck, Gift, Package, Barcode, Search,
  ChevronDown, ChevronUp, Play, RotateCcw, AlertCircle, CheckCircle2, Clock, Flame, Info
} from 'lucide-react';

interface ScraperForm {
  enabled: boolean;
  keywords: string;
  urls: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  freeShipping: boolean;
  maxShippingDays: string;
  giftReceipt: boolean;
  includeVariants: boolean;
  minStock: string;
  brand: string;
  requireUPC: boolean;
  requireSKU: boolean;
  // AliExpress-specific
  priceMultiplier: string;
  lowPriceMarkupEnabled: boolean;
  lowPriceMarkupAmount: string;
  lowPriceMarkupThreshold: string;
}

const defaultForm = (): ScraperForm => ({
  enabled: true,
  keywords: '',
  urls: '',
  minPrice: '',
  maxPrice: '',
  minRating: '4.0',
  freeShipping: false,
  maxShippingDays: '',
  giftReceipt: false,
  includeVariants: true,
  minStock: '1',
  brand: '',
  requireUPC: false,
  requireSKU: false,
  priceMultiplier: '3.0',
  lowPriceMarkupEnabled: true,
  lowPriceMarkupAmount: '10.00',
  lowPriceMarkupThreshold: '5.00',
});

interface ScraperConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  status: 'active' | 'idle' | 'error';
  lastRun: string;
  productsFound: number;
  form: ScraperForm;
  scraperEngine?: string; // which API powers this scraper
}

const SCRAPER_META: Omit<ScraperConfig, 'status' | 'lastRun' | 'productsFound' | 'form'>[] = [
  {
    id: 'aliexpress',
    name: 'AliExpress',
    icon: <Globe size={18} />,
    color: '#ef4444',
    description: 'Scrape AliExpress SuperDeals and product listings by keyword or direct URL. Powered by Scrapfly with anti-bot bypass.',
    scraperEngine: 'scrapfly',
  },
  {
    id: 'walmart',
    name: 'Walmart Flash Deals',
    icon: <ShoppingCart size={18} />,
    color: '#3b82f6',
    description: 'Monitor Walmart flash deals and rollback pages. Now powered by Scrapfly with residential proxies for better anti-bot bypass.',
    scraperEngine: 'scrapfly',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl Scraper',
    icon: <Flame size={18} />,
    color: '#f97316',
    description: 'AI-powered scraper for any product page URL. Converts pages to clean structured data. Good for sites that block traditional scrapers.',
    scraperEngine: 'firecrawl',
  },
  {
    id: 'rakuten',
    name: 'Rakuten Deals',
    icon: <Tag size={18} />,
    color: '#f59e0b',
    description: 'Scrape Rakuten cashback deal pages. Tracks cashback percentage alongside product price for margin calculation.',
  },
  {
    id: 'topcashback',
    name: 'TopCashback',
    icon: <Tag size={18} />,
    color: '#10b981',
    description: 'Scrape TopCashback deal pages for short-duration high-cashback offers. Tracks cashback % and deal expiry.',
  },
  {
    id: 'befrugal',
    name: 'BeFrugal',
    icon: <Tag size={18} />,
    color: '#8b5cf6',
    description: 'Monitor BeFrugal cashback portal for high-percentage deals. Auto-routes orders through highest cashback offer found.',
  },
  {
    id: 'swagbucks',
    name: 'Swagbucks',
    icon: <Tag size={18} />,
    color: '#dc2626',
    description: 'Scrape Swagbucks shopping portal for cashback deals. Supports SB point conversion to cashback equivalent.',
  },
];

const buildDefaultScrapers = (): ScraperConfig[] =>
  SCRAPER_META.map((meta) => ({
    ...meta,
    status: 'idle' as const,
    lastRun: 'Never',
    productsFound: 0,
    form: defaultForm(),
  }));

interface DbStats {
  activeScrapers: number;
  productsFoundToday: number;
  passedMargin: number;
  sentToReview: number;
}

function StatusBadge({ status }: { status: ScraperConfig['status'] }) {
  if (status === 'active') return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#059669' }}>
      <CheckCircle2 size={12} /> Active
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#dc2626' }}>
      <AlertCircle size={12} /> Error
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#6b7280' }}>
      <Clock size={12} /> Idle
    </span>
  );
}

function EngineBadge({ engine }: { engine?: string }) {
  if (!engine) return null;
  const colors: Record<string, { bg: string; text: string }> = {
    scrapfly: { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
    firecrawl: { bg: 'rgba(249,115,22,0.12)', text: '#c2410c' },
    scraperapi: { bg: 'rgba(16,185,129,0.12)', text: '#047857' },
  };
  const c = colors[engine] || { bg: 'rgba(107,114,128,0.12)', text: '#4b5563' };
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>
      via {engine}
    </span>
  );
}

function ScraperCard({
  config,
  userId,
  onRunComplete,
}: {
  config: ScraperConfig;
  userId: string | null;
  onRunComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<ScraperForm>(() => config.form);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState<boolean | null>(null);

  // Only sync form from config when the scraper id changes (not on every re-render)
  const prevIdRef = React.useRef(config.id);
  useEffect(() => {
    if (prevIdRef.current !== config.id) {
      prevIdRef.current = config.id;
      setForm(config.form);
    }
  }, [config.id, config.form]);

  const handleSave = async () => {
    if (!userId) return;
    try {
      const supabase = createClient();
      await supabase.from('scrape_campaigns').upsert({
        user_id: userId,
        name: `${config.name} Default`,
        source: config.id as 'aliexpress' | 'walmart' | 'rakuten' | 'topcashback' | 'befrugal' | 'swagbucks' | 'ibotta' | 'other',
        keywords: form.keywords,
        urls: form.urls,
        min_price: form.minPrice ? parseFloat(form.minPrice) : null,
        max_price: form.maxPrice ? parseFloat(form.maxPrice) : null,
        min_rating: form.minRating ? parseFloat(form.minRating) : 4.0,
        free_shipping: form.freeShipping,
        max_shipping_days: form.maxShippingDays ? parseInt(form.maxShippingDays) : null,
        gift_receipt: form.giftReceipt,
        include_variants: form.includeVariants,
        min_stock: form.minStock ? parseInt(form.minStock) : 1,
        brand: form.brand || null,
        require_upc: form.requireUPC,
        require_sku: form.requireSKU,
        status: form.enabled ? 'active' : 'paused',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,name' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save scraper error:', err);
    }
  };

  const handleRun = async () => {
    if (!userId) return;
    setRunning(true);
    setRunMessage(null);
    setRunSuccess(null);

    try {
      await handleSave();

      // Get Scrapfly API key from saved credentials
      const supabase = createClient();
      const { data: credData } = await supabase
        .from('api_credentials')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service', 'scrapfly')
        .single();

      const scrapflyKey = (credData?.credentials as Record<string, string>)?.apiKey;

      // Check if AliExpress DS API credentials exist (preferred source for AliExpress)
      const { data: aliDsCredData } = await supabase
        .from('api_credentials')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service', 'aliexpress_ds')
        .single();
      const aliDsCreds = aliDsCredData?.credentials as Record<string, string> | null;
      const hasAliDsApi = !!(aliDsCreds?.appKey && aliDsCreds?.appSecret);

      if (config.id === 'aliexpress' && !hasAliDsApi && !scrapflyKey) {
        setRunSuccess(false);
        setRunMessage('No AliExpress DS API credentials found and no Scrapfly key saved. Add either in API Connections first.');
        setTimeout(() => { setRunMessage(null); setRunSuccess(null); }, 6000);
        setRunning(false);
        return;
      }

      if (config.id === 'walmart' && !scrapflyKey) {
        setRunSuccess(false);
        setRunMessage('Scrapfly API key not found. Go to API Connections → Scrapfly and save your key first.');
        setTimeout(() => { setRunMessage(null); setRunSuccess(null); }, 6000);
        setRunning(false);
        return;
      }

      if (config.id === 'aliexpress') {
        const res = await fetch('/api/scrape/aliexpress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            scrapflyKey,
            keywords: form.keywords,
            urls: form.urls,
            minPrice: form.minPrice ? parseFloat(form.minPrice) : undefined,
            maxPrice: form.maxPrice ? parseFloat(form.maxPrice) : undefined,
            minRating: form.minRating ? parseFloat(form.minRating) : undefined,
            freeShipping: form.freeShipping,
            priceMultiplier: form.priceMultiplier ? parseFloat(form.priceMultiplier) : 3.0,
            lowPriceMarkupEnabled: form.lowPriceMarkupEnabled,
            lowPriceMarkupAmount: form.lowPriceMarkupAmount,
            lowPriceMarkupThreshold: form.lowPriceMarkupThreshold,
          }),
        });
        const result = await res.json() as { success: boolean; message: string; productsFound?: number };
        setRunSuccess(result.success);
        setRunMessage(result.message);
      } else if (config.id === 'walmart') {
        const res = await fetch('/api/scrape/walmart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            scrapflyKey,
            keywords: form.keywords,
            urls: form.urls,
            minPrice: form.minPrice ? parseFloat(form.minPrice) : undefined,
            maxPrice: form.maxPrice ? parseFloat(form.maxPrice) : undefined,
            minRating: form.minRating ? parseFloat(form.minRating) : undefined,
            requireUPC: form.requireUPC,
            requireSKU: form.requireSKU,
          }),
        });
        const result = await res.json() as { success: boolean; message: string; productsFound?: number };
        setRunSuccess(result.success);
        setRunMessage(result.message);
      } else {
        // For cashback scrapers and firecrawl — update last_run_at and show info
        await supabase.from('scrape_campaigns').update({
          last_run_at: new Date().toISOString(),
        }).eq('user_id', userId).eq('name', `${config.name} Default`);
        setRunSuccess(true);
        setRunMessage(`${config.name} scrape queued. Results will appear in your dashboard when complete.`);
      }

      setTimeout(() => { setRunMessage(null); setRunSuccess(null); }, 8000);
      onRunComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setRunSuccess(false);
      setRunMessage(`Run failed: ${msg}`);
      setTimeout(() => { setRunMessage(null); setRunSuccess(null); }, 6000);
    } finally {
      setRunning(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: config.color }}>
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{config.name}</h3>
              <StatusBadge status={config.status} />
              <EngineBadge engine={config.scraperEngine} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>Last run: <span className="font-medium" style={{ color: 'var(--foreground)' }}>{config.lastRun}</span></span>
            <span>Found: <span className="font-semibold" style={{ color: 'var(--primary)' }}>{config.productsFound}</span></span>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-primary text-xs px-3 py-1.5 gap-1.5 disabled:opacity-60"
              onClick={handleRun}
              disabled={running || !userId}
              title={!userId ? 'Sign in to run scrapers' : undefined}
            >
              {running ? <><RotateCcw size={11} className="animate-spin" /> Running…</> : <><Play size={11} /> Run</>}
            </button>
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />}
        </div>
      </div>

      {/* Run result message */}
      {runMessage && (
        <div className="px-5 pb-2">
          <p className="text-xs px-3 py-2 rounded-md" style={{
            background: runSuccess ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
            color: runSuccess ? '#059669' : '#dc2626',
            border: `1px solid ${runSuccess ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`,
          }}>
            {runMessage}
          </p>
        </div>
      )}

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }} className="px-5 py-5">

          {/* AliExpress price buffer notice */}
          {config.id === 'aliexpress' && (
            <div className="mb-4 flex items-start gap-2 px-3 py-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#b91c1c' }}>
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p><strong>⚠️ AliExpress Logged-Out Price Warning:</strong> AliExpress shows fake &quot;SuperDeal&quot; prices to logged-out visitors (e.g. $0.99 free shipping). Once logged in, the real price jumps dramatically — one real example: $0.99 → $7.50 + $2.00 shipping (nearly $10 total). Use the <strong>Minimum Flat Markup</strong> setting below to automatically add $10 to any product priced $0.99–$5.00.</p>
                <p className="mt-1" style={{ color: '#7c3aed' }}><strong>💡 Best solution:</strong> Add your <strong>AliExpress Dropshipping API</strong> credentials in API Connections. When present, the scraper uses the official DS API (real wholesale prices, no login discrepancy) instead of Scrapfly scraping.</p>
              </div>
            </div>
          )}

          {/* Walmart Scrapfly notice */}
          {config.id === 'walmart' && (
            <div className="mb-4 flex items-start gap-2 px-3 py-3 rounded-lg text-xs" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', color: '#1d4ed8' }}>
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <p><strong>Switched to Scrapfly:</strong> Walmart scraping now uses Scrapfly with residential proxies and anti-bot bypass (ASP) instead of ScraperAPI. Walmart has heavy bot detection — Scrapfly&apos;s ASP mode handles this better. Make sure your Scrapfly API key is saved in API Connections.</p>
              </div>
            </div>
          )}

          {/* Firecrawl notice */}
          {config.id === 'firecrawl' && (
            <div className="mb-4 flex items-start gap-2 px-3 py-3 rounded-lg text-xs" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: '#c2410c' }}>
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <p><strong>Firecrawl:</strong> Paste direct product page URLs below. Firecrawl converts any webpage into clean structured JSON — great for sites that block Scrapfly. Integrates natively with Lovable, Replit, Cursor, and other AI builders. Save your Firecrawl API key in API Connections first.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <Field label="Keywords (comma-separated)">
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="e.g. USB-C hub, wireless earbuds, LED strip"
                  className="input-base text-xs h-9"
                />
              </Field>
            </div>
            <Field label="Brand Filter (optional)">
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g. Anker, Baseus, Samsung"
                className="input-base text-xs h-9"
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Direct URLs (one per line — overrides keyword search)">
                <textarea
                  value={form.urls}
                  onChange={(e) => setForm({ ...form, urls: e.target.value })}
                  placeholder={config.id === 'aliexpress' ? 'https://www.aliexpress.com/item/...' : config.id === 'walmart' ? 'https://www.walmart.com/ip/...' : 'https://...'}
                  rows={3}
                  className="input-base text-xs resize-none"
                />
              </Field>
            </div>

            {/* AliExpress price adjustment settings */}
            {config.id === 'aliexpress' && (
              <div className="sm:col-span-2 lg:col-span-3 space-y-3">

                {/* Low-price flat markup rule */}
                <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Minimum Flat Markup for Low-Price Products</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                        AliExpress shows fake &quot;logged-out&quot; prices (e.g. $0.99 free shipping). When you log in, the real price jumps dramatically — one example: $0.99 → $7.50 + $2.00 shipping (nearly $10 total). This rule adds a flat dollar amount to any scraped price that falls within the threshold range, so you&apos;re not listing products at a loss.
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={form.lowPriceMarkupEnabled}
                        onChange={(e) => setForm({ ...form, lowPriceMarkupEnabled: e.target.checked })}
                        className="accent-orange-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs font-medium" style={{ color: form.lowPriceMarkupEnabled ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                        {form.lowPriceMarkupEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                  {form.lowPriceMarkupEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Apply to prices up to ($)">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.lowPriceMarkupThreshold}
                          onChange={(e) => setForm({ ...form, lowPriceMarkupThreshold: e.target.value })}
                          placeholder="5.00"
                          className="input-base text-xs h-9"
                        />
                      </Field>
                      <Field label="Add this amount ($)">
                        <input
                          type="number"
                          step="0.50"
                          min="0"
                          value={form.lowPriceMarkupAmount}
                          onChange={(e) => setForm({ ...form, lowPriceMarkupAmount: e.target.value })}
                          placeholder="10.00"
                          className="input-base text-xs h-9"
                        />
                      </Field>
                      <div className="col-span-2 text-[11px] px-2 py-1.5 rounded" style={{ background: 'rgba(239,68,68,0.05)', color: '#b91c1c' }}>
                        Example: scraped price of <strong>$0.99</strong> (≤ ${form.lowPriceMarkupThreshold || '5.00'}) → add <strong>${form.lowPriceMarkupAmount || '10.00'}</strong> → saved as <strong>${(0.99 + parseFloat(form.lowPriceMarkupAmount || '10.00')).toFixed(2)}</strong>. Then the multiplier below is applied on top.
                      </div>
                    </div>
                  )}
                </div>

                {/* Price multiplier */}
                <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <Field label="SuperDeals Price Multiplier (logged-out → real price adjustment)">
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="10"
                        value={form.priceMultiplier}
                        onChange={(e) => setForm({ ...form, priceMultiplier: e.target.value })}
                        placeholder="3.0"
                        className="input-base text-xs h-9 w-28"
                      />
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Example: $0.99 scraped price × <strong>{form.priceMultiplier || '3.0'}</strong> = <strong style={{ color: 'var(--foreground)' }}>${(0.99 * parseFloat(form.priceMultiplier || '3.0')).toFixed(2)}</strong> adjusted price saved to dashboard
                      </div>
                    </div>
                  </Field>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    Set to 1.0 to use raw scraped prices. Set to 3.0–4.0 for SuperDeals pages. The raw price is also saved separately so you can adjust later.
                  </p>
                </div>

              </div>
            )}

            <Field label="Min Price ($)">
              <input
                type="number"
                value={form.minPrice}
                onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
                placeholder="0.00"
                className="input-base text-xs h-9"
              />
            </Field>
            <Field label="Max Price ($)">
              <input
                type="number"
                value={form.maxPrice}
                onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
                placeholder="500.00"
                className="input-base text-xs h-9"
              />
            </Field>
            <Field label="Minimum Rating (0–5)">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.minRating}
                onChange={(e) => setForm({ ...form, minRating: e.target.value })}
                placeholder="4.0"
                className="input-base text-xs h-9"
              />
            </Field>
            <Field label="Max Shipping Days">
              <input
                type="number"
                value={form.maxShippingDays}
                onChange={(e) => setForm({ ...form, maxShippingDays: e.target.value })}
                placeholder="e.g. 14"
                className="input-base text-xs h-9"
              />
            </Field>
            <Field label="Minimum Stock Qty">
              <input
                type="number"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                placeholder="1"
                className="input-base text-xs h-9"
              />
            </Field>

            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted-foreground)' }}>Filters &amp; Requirements</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { key: 'freeShipping', label: 'Free Shipping Only', icon: <Truck size={13} /> },
                  { key: 'giftReceipt', label: 'Gift Receipt Available', icon: <Gift size={13} /> },
                  { key: 'includeVariants', label: 'Include Variants', icon: <Package size={13} /> },
                  { key: 'requireUPC', label: 'Require UPC', icon: <Barcode size={13} /> },
                  { key: 'requireSKU', label: 'Require SKU', icon: <Search size={13} /> },
                  { key: 'enabled', label: 'Scraper Enabled', icon: <Star size={13} /> },
                ].map(({ key, label, icon }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background: form[key as keyof ScraperForm] ? 'rgba(249,115,22,0.08)' : 'var(--card)',
                      border: `1px solid ${form[key as keyof ScraperForm] ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!form[key as keyof ScraperForm]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="accent-orange-500 w-3.5 h-3.5"
                    />
                    <span style={{ color: form[key as keyof ScraperForm] ? 'var(--primary)' : 'var(--muted-foreground)' }}>{icon}</span>
                    <span className="text-xs font-medium leading-tight" style={{ color: form[key as keyof ScraperForm] ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {form.giftReceipt && (
              <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: '#c2410c' }}>
                <Gift size={13} className="flex-shrink-0 mt-0.5" />
                <span><strong>Gift receipt enabled:</strong> Orders will be placed with gift receipt / blank invoice so the purchase price is hidden from the customer. This is critical for drop shipping — the customer only sees the product, not what you paid.</span>
              </div>
            )}
            {(form.requireUPC || form.requireSKU) && (
              <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', color: '#1d4ed8' }}>
                <Barcode size={13} className="flex-shrink-0 mt-0.5" />
                <span><strong>UPC/SKU required:</strong> Only products with identifiers will be imported. These are required fields for Google Shopping listings.</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setForm(defaultForm())} className="btn-secondary text-xs">Reset</button>
            <button
              onClick={handleSave}
              disabled={!userId}
              title={!userId ? 'Sign in to save parameters' : undefined}
              className="btn-primary text-xs gap-1.5 disabled:opacity-60"
            >
              {saved ? <><CheckCircle2 size={13} /> Saved!</> : 'Save Parameters'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScrapersPage() {
  const [scrapers, setScrapers] = useState<ScraperConfig[]>(buildDefaultScrapers());
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<DbStats>({ activeScrapers: 0, productsFoundToday: 0, passedMargin: 0, sentToReview: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: campaigns } = await supabase
        .from('scrape_campaigns')
        .select('*')
        .eq('user_id', user.id);

      const campaignMap: Record<string, Record<string, unknown>> = {};
      (campaigns || []).forEach((c) => {
        if (c && typeof c === 'object' && 'source' in c) {
          campaignMap[(c as Record<string, unknown>)['source'] as string] = c as Record<string, unknown>;
        }
      });

      const built: ScraperConfig[] = SCRAPER_META.map((meta) => {
        const campaign = campaignMap[meta.id];
        let status: ScraperConfig['status'] = 'idle';
        if (campaign) {
          const s = campaign['status'] as string;
          if (s === 'active') status = 'active';
          else if (s === 'error') status = 'error';
          else status = 'idle';
        }
        const lastRunAt = campaign?.['last_run_at'] as string | null;
        let lastRun = 'Never';
        if (lastRunAt) {
          const diff = Date.now() - new Date(lastRunAt).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 60) lastRun = `${mins} min ago`;
          else if (mins < 1440) lastRun = `${Math.floor(mins / 60)}h ago`;
          else lastRun = `${Math.floor(mins / 1440)}d ago`;
        }
        const form: ScraperForm = {
          enabled: status === 'active',
          keywords: (campaign?.['keywords'] as string) || '',
          urls: (campaign?.['urls'] as string) || '',
          minPrice: campaign?.['min_price'] != null ? String(campaign['min_price']) : '',
          maxPrice: campaign?.['max_price'] != null ? String(campaign['max_price']) : '',
          minRating: campaign?.['min_rating'] != null ? String(campaign['min_rating']) : '4.0',
          freeShipping: (campaign?.['free_shipping'] as boolean) || false,
          maxShippingDays: campaign?.['max_shipping_days'] != null ? String(campaign['max_shipping_days']) : '',
          giftReceipt: (campaign?.['gift_receipt'] as boolean) || false,
          includeVariants: campaign?.['include_variants'] !== false,
          minStock: campaign?.['min_stock'] != null ? String(campaign['min_stock']) : '1',
          brand: (campaign?.['brand'] as string) || '',
          requireUPC: (campaign?.['require_upc'] as boolean) || false,
          requireSKU: (campaign?.['require_sku'] as boolean) || false,
          priceMultiplier: campaign?.['price_multiplier'] != null ? String(campaign['price_multiplier']) : '3.0',
          lowPriceMarkupEnabled: campaign?.['low_price_markup_enabled'] !== false,
          lowPriceMarkupAmount: campaign?.['low_price_markup_amount'] != null ? String(campaign['low_price_markup_amount']) : '10.00',
          lowPriceMarkupThreshold: campaign?.['low_price_markup_threshold'] != null ? String(campaign['low_price_markup_threshold']) : '5.00',
        };
        return {
          ...meta,
          status,
          lastRun,
          productsFound: (campaign?.['products_found'] as number) || 0,
          form,
        };
      });

      setScrapers(built);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());
      const { count: passedMargin } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('margin_pct', 30)
        .gte('created_at', today.toISOString());
      const { count: sentToReview } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending_review');

      setStats({
        activeScrapers: built.filter((s) => s.status === 'active').length,
        productsFoundToday: todayProducts || 0,
        passedMargin: passedMargin || 0,
        sentToReview: sentToReview || 0,
      });
    } catch (err) {
      console.error('Scrapers load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <AppLayout title="Scrapers" subtitle="Configure scraping parameters for each source site">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Scrapers', value: loading ? '…' : `${stats.activeScrapers} / ${scrapers.length}`, color: 'var(--positive)' },
            { label: 'Products Found Today', value: loading ? '…' : stats.productsFoundToday.toString(), color: 'var(--primary)' },
            { label: 'Passed 30% Margin', value: loading ? '…' : stats.passedMargin.toString(), color: 'var(--positive)' },
            { label: 'In Review Queue', value: loading ? '…' : stats.sentToReview.toString(), color: 'var(--info)' },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated px-4 py-4">
              <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', color: '#1e40af' }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>How scraping works:</strong> Click <strong>Run</strong> on any scraper to make a live API call to Scrapfly (AliExpress &amp; Walmart) or Firecrawl. Products are saved directly to your Supabase database and appear in the Product Review queue. Make sure your API keys are saved in <strong>API Connections</strong> first. Cashback scrapers (Rakuten, TopCashback, etc.) are queued for the next scheduled run.
          </div>
        </div>

        <div className="space-y-3">
          {scrapers.map((scraper) => (
            <ScraperCard key={scraper.id} config={scraper} userId={userId} onRunComplete={loadData} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
