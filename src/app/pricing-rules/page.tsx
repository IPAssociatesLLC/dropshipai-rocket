'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Edit2, DollarSign, Percent, Tag, Save, X, ToggleLeft, ToggleRight, Info } from 'lucide-react';

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
  notes: string;
  // Fee fields
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

const SOURCE_OPTIONS = [
  { value: 'aliexpress', label: 'AliExpress', color: '#ef4444' },
  { value: 'walmart', label: 'Walmart Flash Deals', color: '#3b82f6' },
  { value: 'rakuten', label: 'Rakuten', color: '#f59e0b' },
  { value: 'topcashback', label: 'TopCashback', color: '#10b981' },
  { value: 'befrugal', label: 'BeFrugal', color: '#8b5cf6' },
  { value: 'swagbucks', label: 'Swagbucks', color: '#dc2626' },
  { value: 'firecrawl', label: 'Firecrawl (Any Site)', color: '#f97316' },
  { value: 'all', label: 'All Sources (Default)', color: '#6b7280' },
];

const RULE_TYPE_OPTIONS = [
  { value: 'percentage', label: '% Markup', icon: <Percent size={13} /> },
  { value: 'multiplier', label: 'Price Multiplier', icon: <DollarSign size={13} /> },
  { value: 'flat', label: 'Flat Add ($)', icon: <Tag size={13} /> },
];

const emptyRule = (): Omit<PricingRule, 'id'> => ({
  name: '',
  source: 'aliexpress',
  ruleType: 'percentage',
  markupValue: 30,
  minPrice: null,
  maxPrice: null,
  flatMarkup: 0,
  lowPriceThreshold: null,
  lowPriceFlatAdd: null,
  roundTo99: true,
  priority: 1,
  isActive: true,
  notes: '',
  marketplaceFeeType: 'percent',
  marketplaceFee: 3.5,
  paypalFeeType: 'percent',
  paypalFee: 2.9,
  shippingFeeType: 'free',
  shippingFee: 0,
  minProfitType: 'percent',
  minProfit: 15,
  maxProfitType: 'none',
  maxProfit: null,
});

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
    notes: (row.notes as string) || '',
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

function previewPrice(rule: Omit<PricingRule, 'id'>, sampleCost = 9.99): string {
  let price = sampleCost;
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
  return `$${price.toFixed(2)}`;
}

function calcNetProfit(rule: Omit<PricingRule, 'id'>, sampleCost = 9.99): string {
  const sellPriceStr = previewPrice(rule, sampleCost);
  const sellPrice = parseFloat(sellPriceStr.replace('$', ''));
  let fees = 0;
  if (rule.marketplaceFeeType === 'percent') fees += sellPrice * (rule.marketplaceFee / 100);
  else fees += rule.marketplaceFee;
  if (rule.paypalFeeType === 'percent') fees += sellPrice * (rule.paypalFee / 100);
  else fees += rule.paypalFee;
  if (rule.shippingFeeType === 'dollar') fees += rule.shippingFee;
  const profit = sellPrice - sampleCost - fees;
  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
  return `$${profit.toFixed(2)} (${margin.toFixed(1)}% margin)`;
}

// Toggle button for % vs $
function TypeToggle({ value, onChange }: { value: 'percent' | 'dollar'; onChange: (v: 'percent' | 'dollar') => void }) {
  return (
    <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        onClick={() => onChange('percent')}
        className="px-2 py-1 text-xs font-medium transition-colors"
        style={{
          background: value === 'percent' ? 'rgba(249,115,22,0.15)' : 'var(--card)',
          color: value === 'percent' ? 'var(--primary)' : 'var(--muted-foreground)',
        }}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onChange('dollar')}
        className="px-2 py-1 text-xs font-medium transition-colors"
        style={{
          background: value === 'dollar' ? 'rgba(249,115,22,0.15)' : 'var(--card)',
          color: value === 'dollar' ? 'var(--primary)' : 'var(--muted-foreground)',
        }}
      >
        $
      </button>
    </div>
  );
}

interface RuleFormProps {
  initial: Omit<PricingRule, 'id'>;
  onSave: (rule: Omit<PricingRule, 'id'>) => void;
  onCancel: () => void;
  saving: boolean;
}

function RuleForm({ initial, onSave, onCancel, saving }: RuleFormProps) {
  const [form, setForm] = useState<Omit<PricingRule, 'id'>>(initial);

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const sourceColor = SOURCE_OPTIONS.find((s) => s.value === form.source)?.color || '#6b7280';

  return (
    <div className="card-elevated p-5 border-2" style={{ borderColor: `${sourceColor}33` }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Rule Name */}
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Rule Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. AliExpress Standard Markup"
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* Source */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Source</label>
          <select
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
            className="input-base h-9 text-xs w-full"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Rule Type */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Markup Type</label>
          <div className="flex gap-1.5">
            {RULE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('ruleType', opt.value)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors"
                style={{
                  background: form.ruleType === opt.value ? 'rgba(249,115,22,0.12)' : 'var(--card)',
                  border: `1px solid ${form.ruleType === opt.value ? 'rgba(249,115,22,0.4)' : 'var(--border)'}`,
                  color: form.ruleType === opt.value ? 'var(--primary)' : 'var(--muted-foreground)',
                }}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Markup Value */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {form.ruleType === 'percentage' ? 'Markup %' : form.ruleType === 'multiplier' ? 'Multiplier (e.g. 3.0)' : 'Add Amount ($)'}
          </label>
          <input
            type="number"
            step={form.ruleType === 'multiplier' ? '0.1' : '1'}
            min="0"
            value={form.markupValue}
            onChange={(e) => set('markupValue', parseFloat(e.target.value) || 0)}
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* Additional Flat Markup */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Additional Flat Add ($)</label>
          <input
            type="number"
            step="0.50"
            min="0"
            value={form.flatMarkup}
            onChange={(e) => set('flatMarkup', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* ── FEE SECTION ── */}
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="border-t pt-3 mt-1" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Fee &amp; Overhead Settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Marketplace Selling Fee */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Marketplace Selling Fee</label>
                <div className="flex gap-1.5 items-center">
                  <TypeToggle value={form.marketplaceFeeType} onChange={(v) => set('marketplaceFeeType', v)} />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.marketplaceFee}
                    onChange={(e) => set('marketplaceFee', Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100))}
                    placeholder={form.marketplaceFeeType === 'percent' ? '3.5' : '0.00'}
                    className="input-base h-9 text-xs flex-1"
                  />
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                    {form.marketplaceFeeType === 'percent' ? '%' : '$'}
                  </span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Bonanza seller fee (varies by category)</p>
              </div>

              {/* PayPal Fee */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>PayPal Seller Fee</label>
                <div className="flex gap-1.5 items-center">
                  <TypeToggle value={form.paypalFeeType} onChange={(v) => set('paypalFeeType', v)} />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.paypalFee}
                    onChange={(e) => set('paypalFee', Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100))}
                    placeholder={form.paypalFeeType === 'percent' ? '2.9' : '0.30'}
                    className="input-base h-9 text-xs flex-1"
                  />
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                    {form.paypalFeeType === 'percent' ? '%' : '$'}
                  </span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>PayPal transaction fee</p>
              </div>

              {/* Shipping Fee */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Shipping Fee</label>
                <div className="flex gap-1.5 items-center">
                  <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => set('shippingFeeType', 'free')}
                      className="px-2 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: form.shippingFeeType === 'free' ? 'rgba(16,185,129,0.15)' : 'var(--card)',
                        color: form.shippingFeeType === 'free' ? '#10b981' : 'var(--muted-foreground)',
                      }}
                    >
                      Free
                    </button>
                    <button
                      type="button"
                      onClick={() => set('shippingFeeType', 'dollar')}
                      className="px-2 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: form.shippingFeeType === 'dollar' ? 'rgba(249,115,22,0.15)' : 'var(--card)',
                        color: form.shippingFeeType === 'dollar' ? 'var(--primary)' : 'var(--muted-foreground)',
                      }}
                    >
                      $
                    </button>
                  </div>
                  {form.shippingFeeType === 'dollar' && (
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={form.shippingFee}
                      onChange={(e) => set('shippingFee', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="input-base h-9 text-xs flex-1"
                    />
                  )}
                  {form.shippingFeeType === 'free' && (
                    <span className="text-xs" style={{ color: '#10b981' }}>Free shipping to buyer</span>
                  )}
                </div>
              </div>

              {/* Minimum Profit Margin */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Minimum Profit Margin</label>
                <div className="flex gap-1.5 items-center">
                  <TypeToggle value={form.minProfitType} onChange={(v) => set('minProfitType', v)} />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.minProfit}
                    onChange={(e) => set('minProfit', parseFloat(e.target.value) || 0)}
                    placeholder={form.minProfitType === 'percent' ? '15' : '2.00'}
                    className="input-base h-9 text-xs flex-1"
                  />
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                    {form.minProfitType === 'percent' ? '%' : '$'}
                  </span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Cheap items need a minimum floor</p>
              </div>

              {/* Maximum Profit Margin */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Maximum Profit Margin</label>
                <div className="flex gap-1.5 items-center">
                  <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    {(['none', 'percent', 'dollar'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('maxProfitType', v)}
                        className="px-2 py-1 text-xs font-medium transition-colors"
                        style={{
                          background: form.maxProfitType === v ? 'rgba(249,115,22,0.15)' : 'var(--card)',
                          color: form.maxProfitType === v ? 'var(--primary)' : 'var(--muted-foreground)',
                        }}
                      >
                        {v === 'none' ? 'None' : v === 'percent' ? '%' : '$'}
                      </button>
                    ))}
                  </div>
                  {form.maxProfitType !== 'none' && (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={form.maxProfit ?? ''}
                      onChange={(e) => set('maxProfit', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder={form.maxProfitType === 'percent' ? '60' : '50.00'}
                      className="input-base h-9 text-xs flex-1"
                    />
                  )}
                  {form.maxProfitType !== 'none' && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      {form.maxProfitType === 'percent' ? '%' : '$'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>% margins can get too high on expensive items</p>
              </div>
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Apply to Cost Min ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.minPrice ?? ''}
            onChange={(e) => set('minPrice', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Any"
            className="input-base h-9 text-xs w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Apply to Cost Max ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.maxPrice ?? ''}
            onChange={(e) => set('maxPrice', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Any"
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* Low Price Markup */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Low-Price Threshold ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.lowPriceThreshold ?? ''}
            onChange={(e) => set('lowPriceThreshold', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g. 5.00"
            className="input-base h-9 text-xs w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Low-Price Flat Add ($)</label>
          <input
            type="number"
            step="0.50"
            min="0"
            value={form.lowPriceFlatAdd ?? ''}
            onChange={(e) => set('lowPriceFlatAdd', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="e.g. 10.00"
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Priority (1 = highest)</label>
          <input
            type="number"
            min="1"
            max="99"
            value={form.priority}
            onChange={(e) => set('priority', parseInt(e.target.value) || 1)}
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Notes (optional)</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. For AliExpress SuperDeals with logged-out prices"
            className="input-base h-9 text-xs w-full"
          />
        </div>

        {/* Options row */}
        <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.roundTo99}
              onChange={(e) => set('roundTo99', e.target.checked)}
              className="accent-orange-500 w-3.5 h-3.5"
            />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Round to .99 (e.g. $19.99)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="accent-orange-500 w-3.5 h-3.5"
            />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Rule Active</span>
          </label>
        </div>

        {/* Preview */}
        <div className="sm:col-span-2 lg:col-span-3 px-3 py-2.5 rounded-lg text-xs space-y-1" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="flex items-center gap-2">
            <Info size={13} style={{ color: 'var(--primary)' }} className="flex-shrink-0" />
            <span style={{ color: 'var(--muted-foreground)' }}>
              Preview: cost of <strong style={{ color: 'var(--foreground)' }}>$9.99</strong> →
              sell price <strong style={{ color: 'var(--primary)' }}>{previewPrice(form, 9.99)}</strong>
              {' '}· net profit <strong style={{ color: '#10b981' }}>{calcNetProfit(form, 9.99)}</strong>
            </span>
          </div>
          {form.lowPriceThreshold && form.lowPriceFlatAdd && (
            <div className="flex items-center gap-2 pl-5">
              <span style={{ color: 'var(--muted-foreground)' }}>
                Low-price: cost of <strong style={{ color: 'var(--foreground)' }}>$1.99</strong> →
                sell price <strong style={{ color: 'var(--primary)' }}>{previewPrice(form, 1.99)}</strong>
                {' '}· net profit <strong style={{ color: '#10b981' }}>{calcNetProfit(form, 1.99)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onCancel} className="btn-secondary text-xs gap-1.5">
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="btn-primary text-xs gap-1.5 disabled:opacity-60"
        >
          {saving ? <><Save size={13} className="animate-pulse" /> Saving…</> : <><Save size={13} /> Save Rule</>}
        </button>
      </div>
    </div>
  );
}

export default function PricingRulesPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSource, setFilterSource] = useState('all');

  const fetchRules = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true });
      if (error) { console.error('Pricing rules fetch error:', error.message); }
      setRules((data || []).map((r) => mapDbRule(r as Record<string, unknown>)));
    } catch (err) {
      console.error('Pricing rules error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSave = async (form: Omit<PricingRule, 'id'>) => {
    if (!userId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        user_id: userId,
        name: form.name,
        source: form.source,
        rule_type: form.ruleType,
        markup_value: form.markupValue,
        min_price: form.minPrice,
        max_price: form.maxPrice,
        flat_markup: form.flatMarkup,
        low_price_threshold: form.lowPriceThreshold,
        low_price_flat_add: form.lowPriceFlatAdd,
        round_to_99: form.roundTo99,
        priority: form.priority,
        is_active: form.isActive,
        notes: form.notes,
        marketplace_fee_type: form.marketplaceFeeType,
        marketplace_fee: form.marketplaceFee,
        paypal_fee_type: form.paypalFeeType,
        paypal_fee: form.paypalFee,
        shipping_fee_type: form.shippingFeeType,
        shipping_fee: form.shippingFee,
        min_profit_type: form.minProfitType,
        min_profit: form.minProfit,
        max_profit_type: form.maxProfitType,
        max_profit: form.maxProfit,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data, error } = await supabase
          .from('pricing_rules')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();
        if (!error && data) {
          setRules((prev) => prev.map((r) => r.id === editingId ? mapDbRule(data as Record<string, unknown>) : r));
        }
      } else {
        const { data, error } = await supabase
          .from('pricing_rules')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          setRules((prev) => [...prev, mapDbRule(data as Record<string, unknown>)]);
        }
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Save rule error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('pricing_rules').delete().eq('id', id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = async (rule: PricingRule) => {
    const supabase = createClient();
    await supabase.from('pricing_rules').update({ is_active: !rule.isActive }).eq('id', rule.id);
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
  };

  const editingRule = editingId ? rules.find((r) => r.id === editingId) : null;

  const filtered = filterSource === 'all'
    ? rules
    : rules.filter((r) => r.source === filterSource);

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <AppLayout title="Pricing Rules" subtitle="Set custom markup rules per source to control your sell prices">
      <div className="space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Rules', value: rules.length, color: 'var(--primary)' },
            { label: 'Active Rules', value: activeCount, color: 'var(--positive)' },
            { label: 'Sources Covered', value: new Set(rules.map((r) => r.source)).size, color: 'var(--info)' },
            { label: 'Inactive Rules', value: rules.length - activeCount, color: 'var(--muted-foreground)' },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated px-4 py-4">
              <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', color: '#1e40af' }}>
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>How pricing rules work:</strong> When a product is scraped, the system finds the matching rule for its source (highest priority first). The rule applies a markup to the cost price, then deducts fees (Marketplace %, PayPal %, Shipping) to calculate net profit. Set Minimum Profit Margin to ensure cheap items are still profitable. Set Maximum Profit Margin to cap markup on expensive items. All fee fields support both % and $ modes.
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Filter:</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilterSource('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${filterSource === 'all' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground border border-border'}`}
              >
                All
              </button>
              {SOURCE_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
                <button
                  key={s.value}
                  onClick={() => setFilterSource(s.value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${filterSource === s.value ? 'border' : 'bg-secondary text-muted-foreground border border-border'}`}
                  style={filterSource === s.value ? { background: `${s.color}18`, color: s.color, borderColor: `${s.color}40` } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="btn-primary text-xs gap-1.5"
          >
            <Plus size={14} /> New Rule
          </button>
        </div>

        {/* New Rule Form */}
        {showForm && !editingId && (
          <RuleForm
            initial={emptyRule()}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        {/* Rules List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-elevated h-20 animate-pulse" style={{ background: 'var(--card)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated px-6 py-12 text-center">
            <DollarSign size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No pricing rules yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Create your first rule to automatically mark up scraped product prices before they appear in your listings.
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-xs mt-4 gap-1.5">
              <Plus size={13} /> Create First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((rule) => {
              const sourceInfo = SOURCE_OPTIONS.find((s) => s.value === rule.source);
              const isEditing = editingId === rule.id;
              return (
                <div key={rule.id}>
                  {isEditing ? (
                    <RuleForm
                      initial={{ ...rule }}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  ) : (
                    <div
                      className="card-elevated px-5 py-4 flex items-start gap-4"
                      style={{ opacity: rule.isActive ? 1 : 0.6 }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: sourceInfo?.color || '#6b7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{rule.name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${sourceInfo?.color || '#6b7280'}18`, color: sourceInfo?.color || '#6b7280' }}>
                            {sourceInfo?.label || rule.source}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: rule.isActive ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)', color: rule.isActive ? '#059669' : '#6b7280' }}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
                            Priority {rule.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <span>
                            {rule.ruleType === 'percentage' && <><Percent size={11} className="inline mr-0.5" />{rule.markupValue}% markup</>}
                            {rule.ruleType === 'multiplier' && <><DollarSign size={11} className="inline mr-0.5" />×{rule.markupValue} multiplier</>}
                            {rule.ruleType === 'flat' && <><Tag size={11} className="inline mr-0.5" />+${rule.markupValue} flat</>}
                          </span>
                          <span>Mkt fee: {rule.marketplaceFee}{rule.marketplaceFeeType === 'percent' ? '%' : '$'}</span>
                          <span>PayPal: {rule.paypalFee}{rule.paypalFeeType === 'percent' ? '%' : '$'}</span>
                          <span>Ship: {rule.shippingFeeType === 'free' ? 'Free' : `$${rule.shippingFee}`}</span>
                          <span>Min profit: {rule.minProfit}{rule.minProfitType === 'percent' ? '%' : '$'}</span>
                          {rule.maxProfitType !== 'none' && rule.maxProfit != null && (
                            <span>Max profit: {rule.maxProfit}{rule.maxProfitType === 'percent' ? '%' : '$'}</span>
                          )}
                          {rule.roundTo99 && <span>.99 rounding</span>}
                        </div>
                        <div className="mt-1.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                          Preview: $9.99 cost → sell <strong style={{ color: 'var(--primary)' }}>{previewPrice(rule, 9.99)}</strong>
                          {' '}· net <strong style={{ color: '#10b981' }}>{calcNetProfit(rule, 9.99)}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => handleToggle(rule)} className="p-1.5 rounded transition-colors" style={{ color: rule.isActive ? '#059669' : 'var(--muted-foreground)' }} title={rule.isActive ? 'Disable rule' : 'Enable rule'}>
                          {rule.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => { setEditingId(rule.id); setShowForm(false); }} className="p-1.5 rounded transition-colors hover:bg-secondary" style={{ color: 'var(--muted-foreground)' }} title="Edit rule">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded transition-colors hover:bg-negative-subtle" style={{ color: 'var(--muted-foreground)' }} title="Delete rule">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
