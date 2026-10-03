'use client';

import React, { useState, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { Search, SlidersHorizontal, Plus, ExternalLink, Star, Package, TrendingUp, ShoppingCart, AlertCircle, Loader2, ChevronLeft, ChevronRight, X, Truck, Tag, Layers, ChevronDown, ChevronUp, CheckCircle, XCircle, Info, CheckSquare, Square, ListFilter, ArrowUpDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALIEXPRESS_CATEGORIES } from '@/lib/aliexpress-categories';

interface AliProduct {
  itemId: string;
  title: string;
  itemMainPic: string;
  salePrice: string;
  originalPrice: string;
  salePriceCurrency: string;
  originalPriceCurrency: string;
  targetSalePrice: string;
  targetOriginalPrice: string;
  targetOriginalPriceCurrency: string;
  discount: string;
  evaluateRate: string;
  orders: string;
  cateId: string;
  itemUrl: string;
  productVideoUrl?: string;
  freightAmount?: string;
  skuNumber?: string;
  product_id?: string;
  product_title?: string;
  product_main_image_url?: string;
  target_sale_price?: string;
  target_sale_price_currency?: string;
  lastest_volume?: number;
  first_level_category_name?: string;
}

interface ParsedProduct {
  id: string;
  title: string;
  image: string;
  sourcePrice: number;
  salePrice: number;
  originalPrice: number;
  currency: string;
  discount: string;
  rating: number;
  orders: number;
  category: string;
  shippingCost: number;
  hasFreeShipping: boolean;
  marginEstimate: number;
  suggestedSellPrice: number;
  itemUrl: string;
  hasVariations: boolean;
  skuId: string;
}


interface PricingRule {
  id: string;
  name: string;
  source: string;
  ruleType: 'percentage' | 'flat' | 'multiplier';
  markupValue: number;
  minPrice: number | null;
  maxPrice: number | null;
  flatMarkup: number;
  lowPriceThreshold: number | null;
  lowPriceFlatAdd: number | null;
  roundTo99: boolean;
  priority: number;
  isActive: boolean;
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
}

function mapDbRule(row: Record<string, unknown>): PricingRule {
  return {
    id: row.id as string,
    name: row.name as string,
    source: row.source as string,
    ruleType: (row.rule_type as PricingRule['ruleType']) || 'percentage',
    markupValue: (row.markup_value as number) || 30,
    minPrice: row.min_price as number | null,
    maxPrice: row.max_price as number | null,
    flatMarkup: (row.flat_markup as number) || 0,
    lowPriceThreshold: row.low_price_threshold as number | null,
    lowPriceFlatAdd: row.low_price_flat_add as number | null,
    roundTo99: (row.round_to_99 as boolean) !== false,
    priority: (row.priority as number) || 1,
    isActive: (row.is_active as boolean) !== false,
    marketplaceFeeType: (row.marketplace_fee_type as 'percent' | 'dollar') || 'percent',
    marketplaceFee: (row.marketplace_fee as number) || 3.5,
    paypalFeeType: (row.paypal_fee_type as 'percent' | 'dollar') || 'percent',
    paypalFee: (row.paypal_fee as number) || 2.9,
    shippingFeeType: (row.shipping_fee_type as 'free' | 'dollar') || 'free',
    shippingFee: (row.shipping_fee as number) || 0,
    minProfitType: (row.min_profit_type as 'percent' | 'dollar') || 'percent',
    minProfit: (row.min_profit as number) || 15,
    maxProfitType: (row.max_profit_type as 'percent' | 'dollar' | 'none') || 'none',
    maxProfit: row.max_profit as number | null,
  };
}

function calculateSuggestedPrice(costPrice: number, rules: PricingRule[]): number {
  if (!rules || rules.length === 0) return parseFloat((costPrice * 2).toFixed(2));
  
  // Find matching rule
  const activeRules = rules.filter(r => r.isActive && (r.source === 'aliexpress' || r.source === 'all'));
  activeRules.sort((a, b) => a.priority - b.priority);
  
  let rule = activeRules.find(r => {
    if (r.minPrice !== null && costPrice < r.minPrice) return false;
    if (r.maxPrice !== null && costPrice > r.maxPrice) return false;
    return true;
  });
  
  if (!rule) return parseFloat((costPrice * 2).toFixed(2));
  
  let price = costPrice;
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
  return parseFloat(price.toFixed(2));
}

interface SearchMeta {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

// AliExpress top-level categories — verified against the official AliExpress category list
const ALI_CATEGORIES = ALIEXPRESS_CATEGORIES;

const SORT_OPTIONS = [
  { value: 'orders,desc', label: 'Most Orders' },
  { value: 'price,asc', label: 'Price: Low to High' },
  { value: 'price,desc', label: 'Price: High to Low' },
  { value: 'score,desc', label: 'Best Rating' },
  { value: 'default', label: 'Relevance' },
];

const PAGE_SIZE_OPTIONS = [20, 40, 60];

function parseProducts(raw: unknown, rules: PricingRule[] = []): ParsedProduct[] {
  if (!raw || typeof raw !== 'object') return [];
  const resp = raw as Record<string, unknown>;

  let productList: AliProduct[] = [];

  const wrapper = resp['aliexpress_ds_text_search_response'] as Record<string, unknown> | undefined;
  if (wrapper) {
    const wData = wrapper['data'] as Record<string, unknown> | undefined;
    if (wData?.products && Array.isArray(wData.products)) {
      productList = wData.products as AliProduct[];
    }
  }

  if (productList.length === 0) {
    const topData = resp['data'] as Record<string, unknown> | undefined;
    if (topData?.products && Array.isArray(topData.products)) {
      productList = topData.products as AliProduct[];
    }
  }

  if (productList.length === 0 && Array.isArray(resp['products'])) {
    productList = resp['products'] as AliProduct[];
  }

  return productList.map((p) => {
    const id = p.itemId ?? p.product_id ?? '';
    const title = p.title ?? p.product_title ?? 'Unknown Product';
    const image = p.itemMainPic ?? p.product_main_image_url ?? '';
    const salePriceStr = p.targetSalePrice ?? p.salePrice ?? p.target_sale_price ?? '0';
    const salePrice = parseFloat(salePriceStr) || 0;
    const originalPriceStr = p.targetOriginalPrice ?? p.originalPrice ?? salePriceStr;
    const originalPrice = parseFloat(originalPriceStr) || salePrice;
    const currency = p.targetOriginalPriceCurrency ?? p.salePriceCurrency ?? p.target_sale_price_currency ?? 'USD';
    const discount = p.discount ?? '0%';
    const ratingStr = p.evaluateRate ?? '0';
    const ratingRaw = parseFloat(ratingStr.replace('%', '')) || 0;
    const rating = ratingRaw > 5 ? parseFloat((ratingRaw / 20).toFixed(1)) : ratingRaw;
    // orders/sales_count comes back as a display string like "5,000+" — strip commas/plus
    // signs before parsing, otherwise parseInt stops at the first comma ("5,000+" -> 5).
    const ordersRaw = p.orders ?? String(p.lastest_volume ?? 0);
    const orders = parseInt(String(ordersRaw).replace(/[^0-9]/g, ''), 10) || 0;
    const category = p.cateId ?? p.first_level_category_name ?? 'General';
    const shippingCost = parseFloat(p.freightAmount ?? '0') || 0;
    const hasFreeShipping = shippingCost === 0;
    const suggestedSellPrice = calculateSuggestedPrice(salePrice + shippingCost, rules);
    const marginEstimate = suggestedSellPrice > 0
      ? parseFloat(((suggestedSellPrice - salePrice - shippingCost) / suggestedSellPrice * 100).toFixed(1))
      : 0;
    const hasVariations = !!(p.skuNumber && p.skuNumber.includes(','));
    let skuId = '';
    if (p.itemUrl) {
      const skuMatch = p.itemUrl.match(/[?&]skuId=([^&]+)/);
      if (skuMatch) skuId = skuMatch[1];
    }
    if (!skuId && p.skuNumber) skuId = p.skuNumber;

    return {
      id: String(id),
      title,
      image,
      sourcePrice: salePrice,
      salePrice,
      originalPrice,
      currency,
      discount,
      rating,
      orders,
      category: String(category),
      shippingCost,
      hasFreeShipping,
      marginEstimate,
      suggestedSellPrice,
      itemUrl: p.itemUrl ?? '',
      hasVariations,
      skuId,
    };
  });
}

// Product Detail Modal
function ProductDetailModal({ product, onClose, onAddToQueue, isAdding, isAdded }: {
  product: ParsedProduct;
  onClose: () => void;
  onAddToQueue: (p: ParsedProduct) => void;
  isAdding: boolean;
  isAdded: boolean;
}) {
  const profit = parseFloat((product.suggestedSellPrice - product.sourcePrice - product.shippingCost).toFixed(2));
  const aliUrl = product.itemUrl
    ? (product.itemUrl.startsWith('//') ? `https:${product.itemUrl}` : product.itemUrl)
    : `https://www.aliexpress.com/item/${product.id}.html`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Product Details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--muted-foreground)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="rounded-xl overflow-hidden h-52 flex items-center justify-center" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
            {product.image ? (
              <img src={product.image} alt={product.title} className="w-full h-full object-contain" />
            ) : (
              <Package size={40} style={{ color: 'var(--muted-foreground)' }} className="opacity-30" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold leading-snug mb-2" style={{ color: 'var(--foreground)' }}>{product.title}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>AliExpress</span>
              {product.hasFreeShipping && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Free Shipping</span>}
              {product.hasVariations && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>Has Variations</span>}
              {product.discount && product.discount !== '0%' && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{product.discount} OFF</span>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--foreground)' }}>Pricing &amp; Profitability</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: 'Source Price', value: `$${product.sourcePrice.toFixed(2)}`, color: 'var(--foreground)' },
                { label: 'Shipping Cost', value: product.hasFreeShipping ? 'Free' : `$${product.shippingCost.toFixed(2)}`, color: product.hasFreeShipping ? '#10b981' : 'var(--foreground)' },
                { label: 'Target Price', value: `$${product.suggestedSellPrice.toFixed(2)}`, color: '#818cf8' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg p-3" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                  <p className="text-sm font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Margin', value: `${product.marginEstimate}%`, color: product.marginEstimate >= 40 ? '#10b981' : '#f59e0b' },
                { label: 'Cashback (0%)', value: '$0.00', color: '#10b981' },
                { label: 'Final Profit', value: `$${profit.toFixed(2)}`, color: profit > 0 ? '#10b981' : '#ef4444', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="rounded-lg p-3" style={{ backgroundColor: bg || 'var(--background)', border: `1px solid ${border || 'var(--border)'}` }}>
                  <p className="text-[10px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                  <p className="text-sm font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--foreground)' }}>Product Details &amp; Metrics</p>
            <div className="space-y-2">
              {[
                { icon: <Star size={13} />, label: 'Rating', value: `${product.rating.toFixed(1)} / 5.0` },
                { icon: <TrendingUp size={13} />, label: 'Total Orders', value: product.orders.toLocaleString() },
                { icon: <Truck size={13} />, label: 'Shipping', value: product.hasFreeShipping ? 'Free Shipping' : `$${product.shippingCost.toFixed(2)}` },
                { icon: <Tag size={13} />, label: 'Original Price', value: `$${product.originalPrice.toFixed(2)}` },
                { icon: <Layers size={13} />, label: 'Variations', value: product.hasVariations ? 'Yes — multiple SKUs' : 'Single variant' },
                { icon: <Info size={13} />, label: 'Category ID', value: product.category },
                { icon: <Tag size={13} />, label: 'SKU ID', value: product.skuId || 'N/A' },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>{icon}<span className="text-xs">{label}</span></div>
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <a href={aliUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: '#818cf8' }}>
            <ExternalLink size={13} /> View on AliExpress
          </a>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onAddToQueue(product)}
              disabled={isAdding || isAdded}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{
                backgroundColor: isAdded ? 'rgba(16,185,129,0.15)' : '#1e1b4b',
                border: `1px solid ${isAdded ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.4)'}`,
                color: isAdded ? '#10b981' : '#fff',
              }}
            >
              {isAdding ? <Loader2 size={14} className="animate-spin" /> : isAdded ? <><CheckCircle size={14} /> Added to Queue</> : <><Plus size={14} /> Import to Review Queue</>}
            </button>
            <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <XCircle size={14} /> Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDiscoveryPage() {
  const { user } = useAuth();
  const [keywords, setKeywords] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('orders,desc');
  const [pageSize, setPageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ParsedProduct | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  // Batch select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAdding, setBatchAdding] = useState(false);
  const [batchAddedCount, setBatchAddedCount] = useState(0);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  
  React.useEffect(() => {
    if (user) {
      const supabase = createClient();
      supabase.from('pricing_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })
        .then(({ data }) => {
          if (data) {
            setPricingRules(data.map(mapDbRule));
          }
        });
    }
  }, [user]);
  // Feed-based browsing (no keywords — category browse or global bestsellers) paginates via a
  // short-lived search_id cursor rather than page numbers. Track page number -> cursor needed
  // to fetch that page. Cleared whenever a fresh (page 1) search starts.
  const pageCursorsRef = useRef<Record<number, string | undefined>>({});

  const doSearch = useCallback(async (pageNo = 1, overridePageSize?: number) => {
    setLoading(true);
    setError('');
    setDebugInfo(null);
    setSelectedIds(new Set());
    setBatchAddedCount(0);
    const ps = overridePageSize ?? pageSize;
    const isFeedBrowse = !keywords.trim();
    if (pageNo === 1) pageCursorsRef.current = {};
    const searchIdForRequest = isFeedBrowse ? pageCursorsRef.current[pageNo] : undefined;
    try {
      const res = await fetch('/api/aliexpress/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeTab,
          keywords: keywords.trim() || undefined,
          categoryId: selectedCategory || undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          pageNo,
          pageSize: ps,
          sortBy,
          searchId: searchIdForRequest,
        }),
      });
      const json = await res.json();

      setDebugInfo({
        httpStatus: res.status,
        success: json.success,
        errorCode: json.code ?? json.debugInfo?.errorCode,
        errorMsg: json.error ?? json.debugInfo?.errorMsg,
        productsCount: Array.isArray(json.products) ? json.products.length : 0,
        rawResponse: json.rawResponse ?? json.debugInfo?.rawResponse ?? null,
        fullRouteResponse: json,
      });

      if (!res.ok || !json.success) {
        const errCode = json.code ?? json.debugInfo?.errorCode ?? '';
        let errMsg = json.error || 'Search failed. Please try again.';
        if (String(errCode).includes('EXCEPTION_TEXT_SEARCH_FOR_DS') || String(errMsg).includes('EXCEPTION_TEXT_SEARCH_FOR_DS')) {
          errMsg = 'AliExpress DS Text Search permission not enabled or access token expired. Enable "aliexpress.ds.text.search" in your AliExpress Open Platform app console and re-authorize in API Connections.';
        }
        setError(errMsg);
        setProducts([]);
        setSearched(true);
        return;
      }

      let parsed: ParsedProduct[];
      if (json.products && Array.isArray(json.products) && json.products.length > 0) {
        parsed = parseProducts({ products: json.products }, pricingRules);
      } else {
        const rawResp = json.rawResponse as Record<string, unknown> | undefined;
        const wrapper = rawResp?.['aliexpress_ds_text_search_response'] as Record<string, unknown> | undefined;
        const wData = wrapper?.['data'] as Record<string, unknown> | undefined;
        const wProds = wData?.['products'] as Record<string, unknown> | undefined;
        const selectionProds = wProds?.['selection_search_product'];
        if (Array.isArray(selectionProds) && selectionProds.length > 0) {
          parsed = parseProducts({ products: selectionProds }, pricingRules);
        } else {
          parsed = parseProducts(json.rawResponse ?? json.data, pricingRules);
        }
      }

      // Apply sort
      if (sortBy === 'orders,desc') parsed.sort((a, b) => b.orders - a.orders);
      else if (sortBy === 'price,asc') parsed.sort((a, b) => a.salePrice - b.salePrice);
      else if (sortBy === 'price,desc') parsed.sort((a, b) => b.salePrice - a.salePrice);
      else if (sortBy === 'score,desc') parsed.sort((a, b) => b.rating - a.rating);

      // Client-side price filtering
      let filtered = parsed;
      if (minPrice) filtered = filtered.filter(p => p.salePrice >= parseFloat(minPrice));
      if (maxPrice) filtered = filtered.filter(p => p.salePrice <= parseFloat(maxPrice));
      if (minRating) filtered = filtered.filter(p => p.rating >= parseFloat(minRating));

      setProducts(filtered);
      setPage(pageNo);
      setSearched(true);

      // Feed-based browsing pages via a search_id cursor; store it for the *next* page and use
      // its presence (plus getting a non-empty page) to decide whether "Next" should be enabled.
      // Keyword text-search still pages via page numbers, so fall back to totalPages there.
      const apiTotalCount = parseInt(String(json.totalCount ?? '0'), 10);
      const computedHasMore = apiTotalCount > 0 
        ? pageNo < Math.ceil(apiTotalCount / ps)
        : parsed.length >= ps;
      
      const fakeTotal = pageNo * ps + (computedHasMore ? 1 : 0);
      const totalCount = apiTotalCount > 0 ? apiTotalCount : fakeTotal;
      
      setHasMore(computedHasMore);
      setSearchMeta({ totalCount, pageIndex: pageNo, pageSize: ps });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, keywords, minPrice, maxPrice, minRating, sortBy, pageSize, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(1);
  };

  const handleAddToQueue = async (product: ParsedProduct): Promise<boolean> => {
    if (!user) return false;
    setAddingIds(prev => new Set(prev).add(product.id));
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('products').upsert({
        user_id: user.id,
        title: product.title,
        image_url: product.image.startsWith('//') ? `https:${product.image}` : product.image,
        source_price: product.sourcePrice,
        source_url: product.itemUrl
          ? (product.itemUrl.startsWith('//') ? `https:${product.itemUrl}` : product.itemUrl)
          : `https://www.aliexpress.com/item/${product.id}.html`,
        source: 'aliexpress',
        status: 'pending_review',
        category: product.category,
        margin_pct: product.marginEstimate,
        sku: product.skuId || product.id,
        rating: product.rating,
        review_count: product.orders,
        free_shipping: product.hasFreeShipping,
        has_variants: product.hasVariations,
      }, { onConflict: 'user_id,sku' });

      if (!insertError) {
        setAddedIds(prev => new Set(prev).add(product.id));
        // Log to activity_logs
        supabase.from('activity_logs').insert({
          user_id: user.id,
          type: 'import',
          status: 'completed',
          title: 'Product Added to Review Queue',
          message: `"${product.title.slice(0, 80)}" added to review queue`,
          detail: `Source price: $${product.sourcePrice.toFixed(2)} | Est. sell: $${product.suggestedSellPrice.toFixed(2)} | Margin: ${product.marginEstimate}% | SKU: ${product.skuId || product.id}`,
          source: 'AliExpress DS API',
          products_count: 1,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).then(undefined, () => {});
        return true;
      } else {
        // If upsert fails (e.g. no unique constraint), try plain insert
        await supabase.from('products').insert({
          user_id: user.id,
          title: product.title,
          image_url: product.image.startsWith('//') ? `https:${product.image}` : product.image,
          source_price: product.sourcePrice,
          source_url: product.itemUrl
            ? (product.itemUrl.startsWith('//') ? `https:${product.itemUrl}` : product.itemUrl)
            : `https://www.aliexpress.com/item/${product.id}.html`,
          source: 'aliexpress',
          status: 'pending_review',
          category: product.category,
          margin_pct: product.marginEstimate,
          sku: product.skuId || product.id,
          rating: product.rating,
          review_count: product.orders,
          free_shipping: product.hasFreeShipping,
          has_variants: product.hasVariations,
        });
        setAddedIds(prev => new Set(prev).add(product.id));
        // Log to activity_logs
        supabase.from('activity_logs').insert({
          user_id: user.id,
          type: 'import',
          status: 'completed',
          title: 'Product Added to Review Queue',
          message: `"${product.title.slice(0, 80)}" added to review queue`,
          detail: `Source price: $${product.sourcePrice.toFixed(2)} | Est. sell: $${product.suggestedSellPrice.toFixed(2)} | Margin: ${product.marginEstimate}% | SKU: ${product.skuId || product.id}`,
          source: 'AliExpress DS API',
          products_count: 1,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }).then(undefined, () => {});
        return true;
      }
    } catch {
      setAddedIds(prev => new Set(prev).add(product.id));
      return false;
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(product.id); return s; });
    }
  };

  const handleBatchAddToQueue = async () => {
    if (!user || selectedIds.size === 0) return;
    setBatchAdding(true);
    setBatchAddedCount(0);
    let count = 0;
    for (const id of Array.from(selectedIds)) {
      const product = products.find(p => p.id === id);
      if (product && !addedIds.has(id)) {
        const ok = await handleAddToQueue(product);
        if (ok) count++;
      }
    }
    setBatchAddedCount(count);
    setSelectedIds(new Set());
    setBatchAdding(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const totalPages = searchMeta ? Math.ceil(searchMeta.totalCount / searchMeta.pageSize) : null;

  return (
    <AppLayout
      title="Product Discovery"
      subtitle="Search AliExpress live · Browse categories · Batch import to review queue"
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'search'
                ? 'border-[#818cf8] text-[#818cf8]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            style={{ color: activeTab !== 'search' ? 'var(--muted-foreground)' : undefined }}
          >
            Search by Keyword
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'browse'
                ? 'border-[#818cf8] text-[#818cf8]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            style={{ color: activeTab !== 'browse' ? 'var(--muted-foreground)' : undefined }}
          >
            Browse by Category
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSearch}>
          {activeTab === 'search' ? (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="Search AliExpress products… e.g. wireless earbuds, phone case"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                className="px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor: showFilters ? 'rgba(99,102,241,0.15)' : 'var(--card)',
                  border: `1px solid ${showFilters ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  color: showFilters ? '#818cf8' : 'var(--foreground)',
                }}
              >
                <SlidersHorizontal size={15} />
                Filters
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff' }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="flex-1 relative flex items-center">
                <ListFilter size={16} className="absolute left-3.5" style={{ color: 'var(--muted-foreground)' }} />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none appearance-none"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  required
                >
                  <option value="" disabled>Select a category to browse...</option>
                  {ALI_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                className="px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor: showFilters ? 'rgba(99,102,241,0.15)' : 'var(--card)',
                  border: `1px solid ${showFilters ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  color: showFilters ? '#818cf8' : 'var(--foreground)',
                }}
              >
                <SlidersHorizontal size={15} />
                Filters
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff' }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ListFilter size={15} />}
                Browse
              </button>
            </div>
          )}

          {/* Sort + Page Size row */}
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            {activeTab === 'search' && (
              <div className="flex items-center gap-2">
                <ListFilter size={14} style={{ color: 'var(--muted-foreground)' }} />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="input-base h-8 text-xs"
                >
                  <option value="">All Categories</option>
                  {ALI_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} style={{ color: 'var(--muted-foreground)' }} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="input-base h-8 text-xs"
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Per page:</span>
              <div className="flex gap-1">
                {PAGE_SIZE_OPTIONS.map(ps => (
                  <button
                    key={ps}
                    type="button"
                    onClick={() => { setPageSize(ps); if (searched) doSearch(1, ps); }}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                    style={{
                      background: pageSize === ps ? 'rgba(99,102,241,0.15)' : 'var(--card)',
                      border: `1px solid ${pageSize === ps ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                      color: pageSize === ps ? '#818cf8' : 'var(--muted-foreground)',
                    }}
                  >
                    {ps}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 p-4 rounded-xl grid grid-cols-3 gap-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Min Price ($)</label>
                <input type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Max Price ($)</label>
                <input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="500"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Min Rating (0–5)</label>
                <input type="number" min="0" max="5" step="0.5" value={minRating} onChange={e => setMinRating(e.target.value)} placeholder="3.5"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }} />
              </div>
            </div>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {/* Batch add success */}
        {batchAddedCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle size={15} style={{ color: '#10b981' }} />
            <p className="text-sm font-medium" style={{ color: '#10b981' }}>{batchAddedCount} product{batchAddedCount !== 1 ? 's' : ''} added to Review Queue successfully!</p>
          </div>
        )}

        {/* Debug Panel */}
        {searched && debugInfo && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.25)', backgroundColor: 'var(--card)' }}>
            <button
              type="button"
              onClick={() => setShowDebug(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left"
              style={{ backgroundColor: 'rgba(99,102,241,0.06)' }}
            >
              <span className="text-xs font-medium flex items-center gap-2" style={{ color: 'rgba(129,140,248,0.7)' }}>
                🔍 API Debug Panel
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: 'rgba(129,140,248,0.6)' }}>
                  {debugInfo.productsCount as number} products · HTTP {debugInfo.httpStatus as string}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(129,140,248,0.5)' }}>
                {showDebug ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Show details</>}
              </span>
            </button>
            {showDebug && (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="px-2 py-1 rounded font-mono" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>HTTP: {String(debugInfo.httpStatus ?? '?')}</span>
                  <span className="px-2 py-1 rounded font-mono" style={{ backgroundColor: debugInfo.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: debugInfo.success ? '#10b981' : '#ef4444' }}>
                    success: {String(debugInfo.success ?? '?')}
                  </span>
                  <span className="px-2 py-1 rounded font-mono" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>products: {String(debugInfo.productsCount ?? 0)}</span>
                </div>
                {!!debugInfo.errorMsg && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{String(debugInfo.errorMsg)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#818cf8' }}>Raw AliExpress Response:</p>
                  <pre className="text-[10px] overflow-auto p-3 rounded-lg" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px' }}>
                    {JSON.stringify(debugInfo.rawResponse ?? 'No rawResponse captured', null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="h-44 w-full" style={{ backgroundColor: 'var(--border)' }} />
                <div className="p-3 space-y-2">
                  <div className="h-3 rounded w-full" style={{ backgroundColor: 'var(--border)' }} />
                  <div className="h-3 rounded w-2/3" style={{ backgroundColor: 'var(--border)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && searched && products.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={40} style={{ color: 'var(--muted-foreground)' }} className="mb-3 opacity-40" />
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No products found</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Try different keywords or adjust your filters</p>
          </div>
        )}

        {/* Initial state */}
        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {activeTab === 'search' ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Search size={28} style={{ color: '#818cf8' }} />
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Search AliExpress Products</p>
                <p className="text-sm mt-1 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
                  Type keywords to search for specific products across AliExpress.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <ListFilter size={28} style={{ color: '#818cf8' }} />
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Browse AliExpress Categories</p>
                <p className="text-sm mt-1 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
                  Pick a category below to instantly browse the top-selling products in that category.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-3xl">
                  {[
                    { id: '44', label: '🔌 Consumer Electronics' },
                    { id: '509', label: '📱 Phones & Telecom' },
                    { id: '15', label: '🏠 Home & Garden' },
                    { id: '26', label: '🎮 Toys & Hobbies' },
                    { id: '18', label: '⚽ Sports & Entertainment' },
                    { id: '66', label: '💄 Beauty & Health' },
                    { id: '1501', label: '👶 Mother & Kids' },
                    { id: '34', label: '🚗 Automobiles' },
                    { id: '1524', label: '🧳 Luggage & Bags' },
                    { id: '322', label: '👞 Shoes' },
                    { id: '1503', label: '💍 Jewelry' },
                    { id: '21', label: '📓 Education & Office' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSortBy('orders,desc');
                        setTimeout(() => doSearch(1), 0);
                      }}
                      className="px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Product Grid */}
        {!loading && products.length > 0 && (
          <>
            {/* Results header + batch controls */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Showing <span style={{ color: 'var(--foreground)' }} className="font-medium">{products.length}</span>
                  {searchMeta && searchMeta.totalCount > products.length && (
                    <> of <span style={{ color: 'var(--foreground)' }} className="font-medium">{searchMeta.totalCount.toLocaleString()}</span> total</>
                  )}
                  {keywords && <> for &ldquo;{keywords}&rdquo;</>}
                </p>
                {totalPages && (
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                    Page {page} {totalPages > 1 ? `of ${totalPages}` : ''}
                  </span>
                )}
              </div>
              {/* Batch select controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
                >
                  {selectedIds.size === products.length ? <CheckSquare size={13} style={{ color: '#818cf8' }} /> : <Square size={13} />}
                  {selectedIds.size === products.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchAddToQueue}
                    disabled={batchAdding}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                    style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                  >
                    {batchAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Add {selectedIds.size} to Queue
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => {
                const isAdding = addingIds.has(product.id);
                const isAdded = addedIds.has(product.id);
                const isSelected = selectedIds.has(product.id);
                const goodMargin = product.marginEstimate >= 40;

                return (
                  <div
                    key={product.id}
                    className="rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-lg cursor-pointer relative"
                    style={{
                      backgroundColor: 'var(--card)',
                      border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                      boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.2)' : undefined,
                    }}
                    onClick={() => setSelectedProduct(product)}
                  >
                    {/* Select checkbox */}
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={e => { e.stopPropagation(); toggleSelect(product.id); }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                        style={{
                          background: isSelected ? '#6366f1' : 'rgba(0,0,0,0.4)',
                          border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.3)'}`,
                        }}
                      >
                        {isSelected && <CheckCircle size={12} style={{ color: '#fff' }} />}
                      </div>
                    </div>

                    {/* Product Image */}
                    <div className="relative h-44 overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
                      {product.image ? (
                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={32} style={{ color: 'var(--muted-foreground)' }} className="opacity-30" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: goodMargin ? 'rgba(16,185,129,0.9)' : 'rgba(245,158,11,0.9)', color: '#fff' }}>
                        ~{product.marginEstimate}% margin
                      </div>
                      {product.hasFreeShipping && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" style={{ backgroundColor: 'rgba(16,185,129,0.9)', color: '#fff' }}>
                          <Truck size={9} /> Free Ship
                        </div>
                      )}
                      {product.hasVariations && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" style={{ backgroundColor: 'rgba(99,102,241,0.85)', color: '#fff' }}>
                          <Layers size={9} /> Variations
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3 flex flex-col flex-1 gap-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--foreground)' }}>{product.title}</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Star size={11} fill="#f59e0b" style={{ color: '#f59e0b' }} />
                          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{product.rating.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingCart size={11} style={{ color: 'var(--muted-foreground)' }} />
                          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{product.orders.toLocaleString()} sold</span>
                        </div>
                      </div>
                      <div className="rounded-lg p-2.5 space-y-1.5" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
                        {product.originalPrice > product.salePrice && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Original</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] line-through" style={{ color: 'var(--muted-foreground)' }}>${product.originalPrice.toFixed(2)}</span>
                              {product.discount && product.discount !== '0%' && (
                                <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>-{product.discount}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Sale price</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>${product.salePrice.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: product.hasFreeShipping ? '#10b981' : 'var(--muted-foreground)' }}>
                            {product.hasFreeShipping ? '✓ Free shipping' : 'Shipping'}
                          </span>
                          <span className="text-[11px]" style={{ color: product.hasFreeShipping ? '#10b981' : 'var(--muted-foreground)' }}>
                            {product.hasFreeShipping ? 'Free' : `$${product.shippingCost.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Est. sell price</span>
                          <span className="text-sm font-semibold" style={{ color: '#10b981' }}>${product.suggestedSellPrice.toFixed(2)}</span>
                        </div>
                        {product.skuId && (
                          <div className="flex items-center justify-between pt-0.5" style={{ borderTop: '1px solid var(--border)' }}>
                            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>SKU ID</span>
                            <span className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>{product.skuId}</span>
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 mt-auto pt-1" onClick={e => e.stopPropagation()}>
                        <a
                          href={product.itemUrl ? (product.itemUrl.startsWith('//') ? `https:${product.itemUrl}` : product.itemUrl) : `https://www.aliexpress.com/item/${product.id}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 p-2 rounded-lg transition-colors"
                          style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
                          title="View on AliExpress"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button
                          onClick={() => handleAddToQueue(product)}
                          disabled={isAdding || isAdded}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
                          style={{
                            backgroundColor: isAdded ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                            border: `1px solid ${isAdded ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
                            color: isAdded ? '#10b981' : '#818cf8',
                          }}
                        >
                          {isAdding ? <Loader2 size={12} className="animate-spin" /> : isAdded ? '✓ Added' : <><Plus size={12} /> Add to Queue</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => doSearch(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Page {page}{totalPages ? ` of ${totalPages}` : ''}
              </span>
              <button
                onClick={() => doSearch(page + 1)}
                disabled={!hasMore || loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToQueue={handleAddToQueue}
          isAdding={addingIds.has(selectedProduct.id)}
          isAdded={addedIds.has(selectedProduct.id)}
        />
      )}
    </AppLayout>
  );
}
