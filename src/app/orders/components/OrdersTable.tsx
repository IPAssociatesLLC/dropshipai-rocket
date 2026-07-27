'use client';

import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { ChevronUp, ChevronDown, ExternalLink, Eye } from 'lucide-react';
import { Order, STATUS_CONFIG, SOURCE_LABELS } from './ordersData';

interface Props {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

type SortKey = 'salePrice' | 'margin' | 'placedAt' | 'cashbackEarned';
type SortDir = 'asc' | 'desc';

export default function OrdersTable({ orders, onSelectOrder }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('placedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...orders].sort((a, b) => {
    const aVal = a[sortKey as keyof Order];
    const bVal = b[sortKey as keyof Order];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={11} className="text-muted-foreground/40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-primary" />
      : <ChevronDown size={11} className="text-primary" />;
  };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === sorted.length && sorted.length > 0}
                  onChange={() =>
                    selected.size === sorted.length
                      ? setSelected(new Set())
                      : setSelected(new Set(sorted.map((o) => o.id)))
                  }
                  className="accent-primary"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Buyer</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bonanza ID</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                <button onClick={() => handleSort('salePrice')} className="flex items-center gap-1 ml-auto">
                  Sale <SortIcon col="salePrice" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Buy</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                <button onClick={() => handleSort('margin')} className="flex items-center gap-1 ml-auto">
                  Margin <SortIcon col="margin" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cashback</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tracking</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                <button onClick={() => handleSort('placedAt')} className="flex items-center gap-1">
                  Placed <SortIcon col="placedAt" />
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">View</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((order) => {
              const status = STATUS_CONFIG[order.status];
              const isSelected = selected.has(order.id);
              const marginColor =
                order.margin < 20
                  ? 'text-negative'
                  : order.margin < 35
                  ? 'text-warning' :'text-positive';

              return (
                <tr
                  key={order.id}
                  className={`table-row-hover border-b border-border/50 cursor-pointer group ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={() => onSelectOrder(order)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(order.id)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AppImage
                        src={order.productImage}
                        alt={order.productImageAlt}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                      />
                      <span className="font-medium text-foreground truncate max-w-[160px]" title={order.product}>
                        {order.product}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground">{order.buyer}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono-data text-muted-foreground">{order.bonanzaOrderId}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono-data text-foreground">${order.salePrice.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono-data text-muted-foreground">${order.buyPrice.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono-data font-semibold ${marginColor}`}>
                      {order.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="badge-base bg-positive-subtle text-positive border border-positive/20">
                        {order.cashbackSite}
                      </span>
                      <span className="font-mono-data text-[10px] text-accent">+${order.cashbackEarned.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-base bg-secondary text-muted-foreground border border-border">
                      {SOURCE_LABELS[order.source]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={status.cls}>{status.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    {order.trackingNumber ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="font-mono-data text-[10px] text-muted-foreground truncate max-w-[100px]">
                          {order.trackingNumber}
                        </span>
                        <a
                          href={`https://track.aftership.com/${order.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost p-0.5"
                          aria-label="Track shipment"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{order.placedAt}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectOrder(order); }}
                      className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="View order details"
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Showing <span className="text-foreground font-medium">{sorted.length}</span> of{' '}
          <span className="text-foreground font-medium">47</span> orders
        </p>
        <div className="flex items-center gap-1">
          {['1', '2', '3', '4'].map((page) => (
            <button
              key={`ord-page-${page}`}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                page === '1' ?'bg-primary/10 text-primary border border-primary/20' :'btn-ghost'
              }`}
            >
              {page}
            </button>
          ))}
          <button className="btn-ghost text-xs px-2 h-7">Next</button>
        </div>
      </div>
    </div>
  );
}