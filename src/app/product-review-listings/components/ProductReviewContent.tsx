'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShoppingBag, ListChecks, Filter, Search, RefreshCw, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import PendingProductCard from './PendingProductCard';
import ActiveListingsTable from './ActiveListingsTable';
import ListingEditorModal from './ListingEditorModal';
import { PendingProduct, ActiveListing } from './productData';

// Pricing rule shape (subset of what we need for sell price calculation)
interface PricingRuleCalc {
  source: string;
  ruleType: 'percentage' | 'flat' | 'multiplier';
  markupValue: number;
  flatMarkup: number;
  lowPriceThreshold: number | null;
  lowPriceFlatAdd: number | null;
  roundTo99: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  marketplaceFeeType: 'percent' | 'dollar';
  marketplaceFee: number;
  paypalFeeType: 'percent' | 'dollar';
  paypalFee: number;
  shippingFeeType: 'free' | 'dollar';
  shippingFee: number;
  minProfitType: 'percent' | 'dollar';
  minProfit: number;
  maxProfitType: 'percent' | 'dollar' | 'none';
  maxProfit: number | null;
  priority: number;
  isActive: boolean;
}

const SOURCES = ['All', 'AliExpress', 'Walmart Flash', 'Rakuten', 'TopCashback'];
const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Home & Garden', 'Toys', 'Sports', 'Beauty', 'Books', 'Other'];

type TabId = 'pending' | 'active';

export function calcSellPrice(buyPrice: number, rule: PricingRuleCalc): number {
  let price = buyPrice;
  if (rule.lowPriceThreshold && rule.lowPriceFlatAdd && price <= rule.lowPriceThreshold) {
    price += rule.lowPriceFlatAdd;
  }
  if (rule.ruleType === 'percentage') {
    price = price * (1 + rule.markupValue / 100);
  } else if (rule.ruleType === 'multiplier') {
    price = price * rule.markupValue;
  } else if (rule.ruleType === 'flat') {
    price = price + rule.markupValue;
  }
  price += rule.flatMarkup || 0;
  if (rule.roundTo99) {
    price = Math.ceil(price) - 0.01;
  }
  if (rule.minPrice && price < rule.minPrice) price = rule.minPrice;
  if (rule.maxPrice && price > rule.maxPrice) price = rule.maxPrice;
  return parseFloat(price.toFixed(2));
}

export function calcEffectiveMargin(buyPrice: number, sellPrice: number, rule: PricingRuleCalc): number {
  if (sellPrice <= 0) return 0;
  let fees = 0;
  if (rule.marketplaceFeeType === 'percent') fees += sellPrice * (rule.marketplaceFee / 100);
  else fees += rule.marketplaceFee;
  if (rule.paypalFeeType === 'percent') fees += sellPrice * (rule.paypalFee / 100);
  else fees += rule.paypalFee;
  if (rule.shippingFeeType === 'dollar') fees += rule.shippingFee;
  const profit = sellPrice - buyPrice - fees;
  return parseFloat(((profit / sellPrice) * 100).toFixed(1));
}

function findBestRule(rules: PricingRuleCalc[], source: string): PricingRuleCalc | null {
  const active = rules.filter((r) => r.isActive);
  // Prefer source-specific rule, then 'all' fallback
  const sourceMatch = active.filter((r) => r.source === source).sort((a, b) => b.priority - a.priority);
  if (sourceMatch.length > 0) return sourceMatch[0];
  const allMatch = active.filter((r) => r.source === 'all').sort((a, b) => b.priority - a.priority);
  if (allMatch.length > 0) return allMatch[0];
  return null;
}

function mapDbProduct(row: Record<string, unknown>): PendingProduct {
  const createdAt = row.created_at as string | null;
  let scrapedAt = '';
  if (createdAt) {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) scrapedAt = `${mins}m ago`;
    else if (mins < 1440) scrapedAt = `${Math.floor(mins / 60)}h ago`;
    else scrapedAt = `${Math.floor(mins / 1440)}d ago`;
  }
  return {
    id: row.id as string,
    title: row.title as string,
    source: row.source as string,
    sourceUrl: row.source_url as string,
    buyPrice: row.source_price as number,
    googleLowest: (row.google_lowest_price as number) || 0,
    margin: (row.margin_pct as number) || 0,
    category: (row.category as string) || 'Other',
    brand: (row.brand as string) || '',
    upc: (row.upc as string) || '',
    sku: (row.sku as string) || '',
    image: (row.image_url as string) || '',
    imageAlt: `Product image for ${row.title}`,
    rating: (row.rating as number) || 0,
    reviewCount: (row.review_count as number) || (row.orders_count as number) || 0,
    freeShipping: (row.free_shipping as boolean) || false,
    giftReceipt: (row.gift_receipt as boolean) || false,
    shippingDays: (row.shipping_days as number) || 0,
    stock: (row.stock as number) || 0,
    hasVariants: (row.has_variants as boolean) || false,
    cashbackSite: (row.cashback_site as string) || '',
    cashbackPct: (row.cashback_pct as number) || 0,
    scrapedAt,
  };
}

function mapDbListing(row: Record<string, unknown>): ActiveListing {
  const buyPrice = (row.source_price as number) || 0;
  const listPrice = (row.bonanza_list_price as number) || (buyPrice * 1.4);
  const margin = listPrice > 0 ? ((listPrice - buyPrice) / listPrice) * 100 : 0;
  const lastChecked = row.last_checked_at
    ? (() => {
        const diff = Date.now() - new Date(row.last_checked_at as string).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
        return `${Math.floor(mins / 1440)}d ago`;
      })()
    : 'Never';

  return {
    id: row.id as string,
    title: row.title as string,
    source: row.source as string,
    sourceUrl: (row.source_url as string) || '',
    bonanzaId: (row.bonanza_listing_id as string) || 'N/A',
    bonanzaUrl: (row.bonanza_listing_url as string) || '',
    buyPrice,
    listPrice,
    margin,
    status: 'active',
    soldCount: 0,
    views: 0,
    lastChecked,
    image: (row.image_url as string) || '',
    imageAlt: `Active listing: ${row.title}`,
    cashbackSite: (row.cashback_site as string) || '',
    cashbackPct: (row.cashback_pct as number) || 0,
  };
}

export default function ProductReviewContent() {
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [selectedSource, setSelectedSource] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minMargin, setMinMargin] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [activeListings, setActiveListings] = useState<ActiveListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [publishTarget, setPublishTarget] = useState<PendingProduct | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [pricingRules, setPricingRules] = useState<PricingRuleCalc[]>([]);

  const fetchPricingRules = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });
      if (data) {
        setPricingRules(
          data.map((r: Record<string, unknown>) => ({
            source: r.source as string,
            ruleType: (r.rule_type as 'percentage' | 'flat' | 'multiplier') || 'percentage',
            markupValue: (r.markup_value as number) || 30,
            flatMarkup: (r.flat_markup as number) || 0,
            lowPriceThreshold: r.low_price_threshold as number | null,
            lowPriceFlatAdd: r.low_price_flat_add as number | null,
            roundTo99: (r.round_to_99 as boolean) !== false,
            minPrice: r.min_price as number | null,
            maxPrice: r.max_price as number | null,
            marketplaceFeeType: (r.marketplace_fee_type as 'percent' | 'dollar') || 'percent',
            marketplaceFee: (r.marketplace_fee as number) ?? 3.5,
            paypalFeeType: (r.paypal_fee_type as 'percent' | 'dollar') || 'percent',
            paypalFee: (r.paypal_fee as number) ?? 2.9,
            shippingFeeType: (r.shipping_fee_type as 'free' | 'dollar') || 'free',
            shippingFee: (r.shipping_fee as number) || 0,
            minProfitType: (r.min_profit_type as 'percent' | 'dollar') || 'percent',
            minProfit: (r.min_profit as number) || 15,
            maxProfitType: (r.max_profit_type as 'percent' | 'dollar' | 'none') || 'none',
            maxProfit: r.max_profit as number | null,
            priority: (r.priority as number) || 1,
            isActive: (r.is_active as boolean) !== false,
          }))
        );
      }
    } catch (err) {
      console.error('Pricing rules fetch error:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'pending_review')
        .gte('margin_pct', minMargin)
        .order('margin_pct', { ascending: false });
      if (error) { console.error('Products fetch error:', error.message); return; }
      setProducts((data || []).map(mapDbProduct));
    } catch (err) {
      console.error('Products error:', err);
    } finally {
      setLoading(false);
    }
  }, [minMargin]);

  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'listed')
        .order('updated_at', { ascending: false });
      if (error) { console.error('Listings fetch error:', error.message); return; }
      setActiveListings((data || []).map(mapDbListing));
    } catch (err) {
      console.error('Listings error:', err);
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchPricingRules(); }, [fetchPricingRules]);
  useEffect(() => { if (activeTab === 'active') fetchListings(); }, [activeTab, fetchListings]);

  const handlePublish = (product: PendingProduct) => {
    setPublishTarget(product);
    setEditorOpen(true);
  };

  const handleReject = async (id: string) => {
    const supabase = createClient();
    await supabase.from('products').update({ status: 'rejected' }).eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePublished = async (productId: string) => {
    const supabase = createClient();
    await supabase.from('products').update({ status: 'listed' }).eq('id', productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleScan = async () => {
    setIsScanning(true);
    setTimeout(() => { setIsScanning(false); fetchProducts(); }, 1500);
  };

  const sourceMap: Record<string, string> = {
    'AliExpress': 'aliexpress',
    'Walmart Flash': 'walmart',
    'Rakuten': 'rakuten',
    'TopCashback': 'topcashback',
  };

  const filteredPending = products.filter((p) => {
    const sourceMatch = selectedSource === 'All' || p.source === sourceMap[selectedSource];
    const catMatch = selectedCategory === 'All' || p.category === selectedCategory;
    const marginMatch = p.margin >= minMargin;
    const searchMatch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase());
    return sourceMatch && catMatch && marginMatch && searchMatch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary border border-border">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
              activeTab === 'pending' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingBag size={15} />
            Pending Review
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'pending' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {products.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
              activeTab === 'active' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListChecks size={15} />
            Active Listings
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {activeListings.length}
            </span>
          </button>
        </div>
        <button onClick={handleScan} disabled={isScanning} className="btn-primary text-sm disabled:opacity-60">
          {isScanning ? <><RefreshCw size={14} className="animate-spin" />Scanning...</> : <><Zap size={14} />Run Scrape Now</>}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products..." className="input-base pl-8 h-8 text-xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Source:</span>
          <div className="flex gap-1 flex-wrap">
            {SOURCES.map((src) => (
              <button key={`src-${src}`} onClick={() => setSelectedSource(src)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${selectedSource === src ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'}`}>
                {src}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Category:</span>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="input-base h-8 text-xs w-auto pr-6">
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Min margin:</span>
          <select value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value))} className="input-base h-8 text-xs w-auto pr-6">
            {[30, 35, 40, 45, 50].map((v) => <option key={v} value={v}>{v}%+</option>)}
          </select>
        </div>
      </div>

      {activeTab === 'pending' && (
        <div>
          {loading ? (
            <div className="card-elevated py-16 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="card-elevated py-16 flex flex-col items-center justify-center text-center">
              <ShoppingBag size={32} className="text-muted-foreground mb-3" />
              <p className="text-base font-semibold text-foreground mb-1">No products in review queue</p>
              <p className="text-sm text-muted-foreground max-w-sm">Products with {minMargin}%+ margin will appear here after each scrape cycle.</p>
              <button onClick={handleScan} className="btn-primary mt-4"><Zap size={14} />Run Scrape Now</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{filteredPending.length}</span> profitable products · sorted by margin · min {minMargin}%
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPending.map((product) => (
                  <PendingProductCard
                    key={product.id}
                    product={product}
                    pricingRules={pricingRules}
                    onPublish={handlePublish}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'active' && (
        listingsLoading ? (
          <div className="card-elevated py-16 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ActiveListingsTable listings={activeListings} />
        )
      )}

      <ListingEditorModal
        product={publishTarget}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setPublishTarget(null); }}
        onPublished={handlePublished}
      />
    </div>
  );
}