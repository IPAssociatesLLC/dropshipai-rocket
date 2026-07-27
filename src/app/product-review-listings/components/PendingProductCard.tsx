'use client';

import React from 'react';
import { ExternalLink, Star, ShoppingCart, X, Package } from 'lucide-react';
import { PendingProduct, SOURCE_LABELS, SOURCE_COLORS } from './productData';

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

interface Props {
  product: PendingProduct;
  pricingRules?: PricingRuleCalc[];
  onPublish: (product: PendingProduct) => void;
  onReject: (id: string) => void;
}

function findBestRule(rules: PricingRuleCalc[], source: string): PricingRuleCalc | null {
  const active = rules.filter((r) => r.isActive);
  const sourceMatch = active.filter((r) => r.source === source).sort((a, b) => b.priority - a.priority);
  if (sourceMatch.length > 0) return sourceMatch[0];
  const allMatch = active.filter((r) => r.source === 'all').sort((a, b) => b.priority - a.priority);
  if (allMatch.length > 0) return allMatch[0];
  return null;
}

function calcSellPrice(buyPrice: number, rule: PricingRuleCalc): number {
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

function calcEffectiveMargin(buyPrice: number, sellPrice: number, rule: PricingRuleCalc): number {
  if (sellPrice <= 0) return 0;
  let fees = 0;
  if (rule.marketplaceFeeType === 'percent') fees += sellPrice * (rule.marketplaceFee / 100);
  else fees += rule.marketplaceFee;
  if (rule.paypalFeeType === 'percent') fees += sellPrice * (rule.paypalFee / 100);
  else fees += rule.paypalFee;
  if (rule.shippingFeeType === 'dollar') fees += rule.shippingFee;
  if (!isFinite(fees) || fees < 0) return 0;
  const profit = sellPrice - buyPrice - fees;
  return parseFloat(((profit / sellPrice) * 100).toFixed(1));
}

// Normalize image URL: handle protocol-relative URLs
function normalizeImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export default function PendingProductCard({ product, pricingRules = [], onPublish, onReject }: Props) {
  const rule = findBestRule(pricingRules, product.source);

  // Calculate sell price from pricing rule, or fall back to 2x buy price
  const sellPrice = rule
    ? calcSellPrice(product.buyPrice, rule)
    : parseFloat((product.buyPrice * 2).toFixed(2));

  // Calculate effective margin (after fees) using rule, or simple gross margin
  const effectiveMargin = rule
    ? calcEffectiveMargin(product.buyPrice, sellPrice, rule)
    : sellPrice > 0
    ? parseFloat((((sellPrice - product.buyPrice) / sellPrice) * 100).toFixed(1))
    : 0;

  // Gross margin (before fees)
  const grossMargin = sellPrice > 0
    ? parseFloat((((sellPrice - product.buyPrice) / sellPrice) * 100).toFixed(1))
    : 0;

  const marginColor =
    effectiveMargin >= 40
      ? 'text-accent'
      : effectiveMargin >= 25
      ? 'text-positive' :'text-info';

  const imageUrl = normalizeImageUrl(product.image);

  return (
    <div className="card-elevated card-hover p-4 flex flex-col gap-3 group">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-secondary flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={product.imageAlt}
              width={64}
              height={64}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const icon = document.createElement('div');
                  icon.className = 'flex items-center justify-center w-full h-full';
                  icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-30" style="color:var(--muted-foreground)"><rect width="20" height="20" x="2" y="2" rx="2" ry="2"/><circle cx="8" cy="8" r="2"/><path d="m21 15-5-5L5 21"/></svg>';
                  parent.appendChild(icon);
                }
              }}
            />
          ) : (
            <Package size={24} className="text-muted-foreground opacity-30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{product.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`badge-base ${SOURCE_COLORS[product.source] || 'bg-secondary text-muted-foreground border border-border'}`}>
              {SOURCE_LABELS[product.source] || product.source}
            </span>
            <span className="badge-base status-badge-muted">{product.category}</span>
          </div>
        </div>
        <button
          onClick={() => onReject(product.id)}
          className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          aria-label="Reject product"
        >
          <X size={14} />
        </button>
      </div>

      {/* Price comparison */}
      <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Buy price</span>
          <span className="font-mono-data font-semibold text-foreground">${product.buyPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Sell price</span>
          <span className="font-mono-data font-semibold text-positive">${sellPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-border pt-2">
          <span className="text-muted-foreground">Gross margin</span>
          <span className="font-mono-data font-semibold text-foreground">{grossMargin.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">
              {rule ? `After fees (${rule.source === 'all' ? 'default rule' : rule.source})` : 'Est. after fees'}
            </span>
          </div>
          <span className={`font-mono-data text-[10px] font-semibold ${effectiveMargin > 0 ? 'text-accent' : 'text-negative'}`}>
            {effectiveMargin.toFixed(1)}%
          </span>
        </div>
        {product.freeShipping && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-mono-data text-positive font-semibold">Free</span>
          </div>
        )}
      </div>

      {/* Margin badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Star size={11} className="text-accent fill-accent" />
          <span className="text-xs text-muted-foreground">
            {product.rating > 0 ? product.rating.toFixed(1) : '—'}{' '}
            {product.reviewCount && product.reviewCount > 0
              ? `(${product.reviewCount.toLocaleString()})`
              : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono-data text-xl font-bold ${marginColor}`}>
            {effectiveMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Cashback / scraped info */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-positive-subtle border border-positive/15">
        {product.cashbackPct > 0 ? (
          <>
            <span className="text-[10px] font-semibold text-positive">{product.cashbackPct}% cashback</span>
            <span className="text-[10px] text-muted-foreground">via {product.cashbackSite}</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">No cashback configured</span>
        )}
        {product.scrapedAt && (
          <span className="ml-auto text-[10px] text-muted-foreground font-mono-data">{product.scrapedAt}</span>
        )}
      </div>

      {/* Rule info */}
      {rule && (
        <div className="text-[10px] text-muted-foreground px-1">
          Pricing rule: <span className="text-foreground font-medium">{rule.ruleType === 'percentage' ? `+${rule.markupValue}% markup` : rule.ruleType === 'multiplier' ? `${rule.markupValue}x multiplier` : `+$${rule.markupValue} flat`}</span>
          {rule.marketplaceFee > 0 && <span> · {rule.marketplaceFee}{rule.marketplaceFeeType === 'percent' ? '%' : '$'} mkt fee</span>}
          {rule.paypalFee > 0 && <span> · {rule.paypalFee}{rule.paypalFeeType === 'percent' ? '%' : '$'} PayPal</span>}
        </div>
      )}
      {!rule && pricingRules.length === 0 && (
        <div className="text-[10px] text-warning px-1">No pricing rules set — showing estimated prices</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onPublish(product)}
          className="btn-primary flex-1 text-xs py-1.5 justify-center"
        >
          <ShoppingCart size={13} />
          Publish to Bonanza
        </button>
        <a
          href={product.sourceUrl || `https://www.aliexpress.com`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary px-2.5 py-1.5"
          aria-label="View source"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}