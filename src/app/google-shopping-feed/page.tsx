'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Tag,
  Barcode,
  Hash,
  Globe,
  Star,
  Image as ImageIcon,
} from 'lucide-react';

interface GsProduct {
  id: string;
  title: string;
  gs_brand: string | null;
  gs_upc: string | null;
  gs_mpn: string | null;
  gs_identifier_exists: boolean | null;
  gs_condition: string | null;
  gs_google_product_category: string | null;
  gs_compliant: boolean | null;
  image_url: string | null;
  category: string | null;
  brand: string | null;
  upc: string | null;
  sku: string | null;
  image_count: number;
}

interface KpiData {
  total: number;
  compliant: number;
  nonCompliant: number;
  missingData: number;
}

const REQUIREMENTS = [
  {
    field: 'Brand',
    icon: <Tag size={14} />,
    rule: 'Must be "brand not available" if unknown',
  },
  {
    field: 'UPC',
    icon: <Barcode size={14} />,
    rule: 'Must be "brand not available" if unknown',
  },
  {
    field: 'MPN',
    icon: <Hash size={14} />,
    rule: 'Optional but recommended',
  },
  {
    field: 'identifier_exists',
    icon: <CheckCircle2 size={14} />,
    rule: 'Should be false for items without UPC/MPN',
  },
  {
    field: 'Google Product Category',
    icon: <Globe size={14} />,
    rule: 'Required for Google Shopping feed',
  },
  {
    field: 'Condition',
    icon: <Star size={14} />,
    rule: 'Must be specified (new, used, refurbished, etc.)',
  },
  {
    field: 'Images',
    icon: <ImageIcon size={14} />,
    rule: 'At least 1 image required',
  },
];

function getFieldStatus(product: GsProduct, field: string): 'ok' | 'missing' | 'fallback' {
  switch (field) {
    case 'brand':
      if (!product.gs_brand) return 'missing';
      if (product.gs_brand === 'brand not available') return 'fallback';
      return 'ok';
    case 'upc':
      if (!product.gs_upc) return 'missing';
      if (product.gs_upc === 'brand not available') return 'fallback';
      return 'ok';
    case 'mpn':
      if (!product.gs_mpn) return 'fallback';
      return 'ok';
    case 'identifier_exists':
      return product.gs_identifier_exists !== null ? 'ok' : 'missing';
    case 'condition':
      return product.gs_condition ? 'ok' : 'missing';
    case 'category':
      return product.gs_google_product_category ? 'ok' : 'missing';
    case 'images':
      return product.image_count > 0 ? 'ok' : 'missing';
    default:
      return 'ok';
  }
}

export default function GoogleShoppingFeedPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<GsProduct[]>([]);
  const [kpi, setKpi] = useState<KpiData>({ total: 0, compliant: 0, nonCompliant: 0, missingData: 0 });
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixCount, setFixCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'compliant' | 'non_compliant'>('all');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, title, gs_brand, gs_upc, gs_mpn, gs_identifier_exists, gs_condition, gs_google_product_category, gs_compliant, image_url, category, brand, upc, sku')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: GsProduct[] = (data || []).map((p) => ({
        ...p,
        image_count: p.image_url ? 1 : 0,
      }));

      setProducts(mapped);

      const total = mapped.length;
      const compliant = mapped.filter((p) => p.gs_compliant).length;
      const nonCompliant = mapped.filter((p) => p.gs_compliant === false).length;
      const missingData = mapped.filter(
        (p) => !p.gs_brand || !p.gs_upc || !p.gs_condition || !p.gs_google_product_category
      ).length;

      setKpi({ total, compliant, nonCompliant, missingData });
      setFixCount(nonCompliant + missingData);
    } catch (err) {
      console.error('Google Shopping Feed load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFixAll = async () => {
    if (!user?.id) return;
    setFixing(true);
    try {
      const supabase = createClient();
      const toFix = products.filter((p) => !p.gs_compliant);

      for (const p of toFix) {
        const gsBrand = p.brand && p.brand.trim() ? p.brand.trim() : 'brand not available';
        const gsUpc = p.upc && p.upc.trim() ? p.upc.trim() : 'brand not available';
        const gsMpn = p.sku && p.sku.trim() ? `MPN-${p.sku.trim()}` : null;
        const gsIdentifierExists = !(gsUpc === 'brand not available' && !gsMpn);
        const gsCompliant = !!(p.image_url && p.category);

        await supabase
          .from('products')
          .update({
            gs_brand: gsBrand,
            gs_upc: gsUpc,
            gs_mpn: gsMpn,
            gs_identifier_exists: gsIdentifierExists,
            gs_condition: 'new',
            gs_google_product_category: p.category || 'Uncategorized',
            gs_compliant: gsCompliant,
            gs_compliance_checked_at: new Date().toISOString(),
          })
          .eq('id', p.id);
      }

      await loadData();
    } catch (err) {
      console.error('Fix all error:', err);
    } finally {
      setFixing(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'compliant' && p.gs_compliant) ||
      (filter === 'non_compliant' && !p.gs_compliant);
    return matchSearch && matchFilter;
  });

  const kpiCards = [
    {
      label: 'Total Listings',
      value: kpi.total,
      icon: <ShoppingBag size={18} />,
      iconBg: 'rgba(100,116,139,0.12)',
      iconColor: '#64748b',
    },
    {
      label: 'Compliant',
      value: kpi.compliant,
      icon: <CheckCircle2 size={18} />,
      iconBg: 'rgba(5,150,105,0.12)',
      iconColor: '#059669',
    },
    {
      label: 'Non-Compliant',
      value: kpi.nonCompliant,
      icon: <AlertCircle size={18} />,
      iconBg: 'rgba(249,115,22,0.12)',
      iconColor: '#f97316',
    },
    {
      label: 'Missing Data',
      value: kpi.missingData,
      icon: <AlertTriangle size={18} />,
      iconBg: 'rgba(59,130,246,0.12)',
      iconColor: '#3b82f6',
    },
  ];

  return (
    <AppLayout
      title="Google Shopping Feed"
      subtitle="Ensure listings meet Google Products requirements"
    >
      <div className="space-y-5">
        {/* Fix All button */}
        <div className="flex justify-end">
          <button
            onClick={handleFixAll}
            disabled={fixing || fixCount === 0}
            className="btn-secondary text-xs gap-2 disabled:opacity-50"
          >
            <Wrench size={13} className={fixing ? 'animate-spin' : ''} />
            {fixing ? 'Fixing…' : `Fix All (${fixCount})`}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => (
            <div key={card.label} className="card-elevated px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {card.label}
                </p>
                <p className="text-3xl font-bold font-mono-data" style={{ color: 'var(--foreground)' }}>
                  {loading ? '…' : card.value}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Google Shopping Requirements */}
        <div className="card-elevated p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            Google Shopping Requirements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REQUIREMENTS.map((req) => (
              <div
                key={req.field}
                className="flex items-start gap-3 px-4 py-3 rounded-lg"
                style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--muted-foreground)' }}
                >
                  {req.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                    {req.field}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {req.rule}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Listings Compliance Table */}
        <div className="card-elevated overflow-hidden">
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Listings Compliance
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Search listings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-base text-xs h-8 w-48"
              />
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {(['all', 'compliant', 'non_compliant'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: filter === f ? 'var(--primary)' : 'transparent',
                      color: filter === f ? '#fff' : 'var(--muted-foreground)',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'compliant' ? 'Compliant' : 'Non-Compliant'}
                  </button>
                ))}
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="btn-secondary text-xs h-8 gap-1.5"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                  {['Title', 'Brand', 'UPC', 'MPN', 'identifier_exists', 'Condition', 'Images', 'Compliant'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
                      <RefreshCw size={16} className="animate-spin inline mr-2" />
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
                      No listings found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((product) => {
                    const brandStatus = getFieldStatus(product, 'brand');
                    const upcStatus = getFieldStatus(product, 'upc');
                    const mpnStatus = getFieldStatus(product, 'mpn');
                    const idStatus = getFieldStatus(product, 'identifier_exists');
                    const condStatus = getFieldStatus(product, 'condition');
                    const imgStatus = getFieldStatus(product, 'images');

                    return (
                      <tr
                        key={product.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Title */}
                        <td className="px-4 py-3 max-w-[200px]">
                          <span
                            className="truncate block font-medium"
                            style={{ color: 'var(--foreground)' }}
                            title={product.title}
                          >
                            {product.title.length > 40
                              ? product.title.slice(0, 40) + '…'
                              : product.title}
                          </span>
                        </td>

                        {/* Brand */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <FieldCell
                            value={product.gs_brand || '—'}
                            status={brandStatus}
                          />
                        </td>

                        {/* UPC */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <FieldCell
                            value={product.gs_upc || '—'}
                            status={upcStatus}
                          />
                        </td>

                        {/* MPN */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <FieldCell
                            value={product.gs_mpn || '—'}
                            status={mpnStatus}
                          />
                        </td>

                        {/* identifier_exists */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <FieldCell
                            value={
                              product.gs_identifier_exists === null
                                ? '—'
                                : product.gs_identifier_exists
                                ? 'true' :'false'
                            }
                            status={idStatus}
                          />
                        </td>

                        {/* Condition */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <FieldCell
                            value={product.gs_condition || '—'}
                            status={condStatus}
                          />
                        </td>

                        {/* Images */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className="flex items-center gap-1 font-medium"
                            style={{ color: imgStatus === 'ok' ? '#059669' : '#dc2626' }}
                          >
                            {imgStatus === 'ok' ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {product.image_count}
                          </span>
                        </td>

                        {/* Compliant */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {product.gs_compliant ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}
                            >
                              <CheckCircle2 size={10} /> Compliant
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}
                            >
                              <AlertCircle size={10} /> Non-Compliant
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div
              className="px-5 py-3 text-xs"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
            >
              Showing {filtered.length} of {products.length} listings
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function FieldCell({ value, status }: { value: string; status: 'ok' | 'missing' | 'fallback' }) {
  const color =
    status === 'ok' ?'var(--foreground)'
      : status === 'fallback' ?'var(--muted-foreground)' :'#dc2626';

  return (
    <span className="text-xs" style={{ color }}>
      {value}
    </span>
  );
}
