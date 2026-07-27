'use client';

import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { ExternalLink, Edit2, Pause, Play, Trash2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { ActiveListing, SOURCE_LABELS, SOURCE_COLORS } from './productData';
import { toast } from 'sonner';

interface Props {
  listings: ActiveListing[];
}

type SortKey = 'margin' | 'listPrice' | 'soldCount' | 'views' | 'lastChecked';
type SortDir = 'asc' | 'desc';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'status-badge-active' },
  paused: { label: 'Paused', cls: 'status-badge-muted' },
  'price-alert': { label: 'Price Alert', cls: 'status-badge-pending' },
  'stock-alert': { label: 'Stock Alert', cls: 'status-badge-alert' },
  'out-of-stock': { label: 'Out of Stock', cls: 'status-badge-alert' },
};

export default function ActiveListingsTable({ listings }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('margin');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...listings].sort((a, b) => {
    const aVal = a[sortKey as keyof ActiveListing];
    const bVal = b[sortKey as keyof ActiveListing];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
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

  const toggleAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((l) => l.id)));
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="text-muted-foreground/40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />;
  };

  const handleAction = (action: string, listing: ActiveListing) => {
    // Backend: trigger action on listing (pause, resume, delete, recheck)
    toast.success(`${action} for ${listing.bonanzaId}`);
  };

  return (
    <div className="card-elevated overflow-hidden">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20 animate-slide-up">
          <span className="text-xs font-medium text-primary">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => { toast.success(`Rechecked ${selected.size} listings`); setSelected(new Set()); }}
              className="btn-ghost text-xs gap-1"
            >
              <RefreshCw size={12} />
              Recheck prices
            </button>
            <button
              onClick={() => { toast.success(`Paused ${selected.size} listings`); setSelected(new Set()); }}
              className="btn-ghost text-xs gap-1"
            >
              <Pause size={12} />
              Pause all
            </button>
            <button
              onClick={() => { toast.success(`Deleted ${selected.size} listings`); setSelected(new Set()); }}
              className="btn-danger text-xs gap-1 py-1"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={selected.size === sorted.length && sorted.length > 0}
                  onChange={toggleAll}
                  className="accent-primary"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bonanza ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                <button onClick={() => handleSort('listPrice')} className="flex items-center gap-1 ml-auto">
                  List Price <SortIcon col="listPrice" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Buy Price</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                <button onClick={() => handleSort('margin')} className="flex items-center gap-1 ml-auto">
                  Margin <SortIcon col="margin" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                <button onClick={() => handleSort('soldCount')} className="flex items-center gap-1 ml-auto">
                  Sold <SortIcon col="soldCount" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Checked</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((listing) => {
              const status = STATUS_MAP[listing.status] || STATUS_MAP.active;
              const isSelected = selected.has(listing.id);
              const marginColor =
                listing.margin < 25
                  ? 'text-negative'
                  : listing.margin < 35
                  ? 'text-warning' :'text-positive';

              return (
                <tr
                  key={listing.id}
                  className={`table-row-hover border-b border-border/50 ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(listing.id)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AppImage
                        src={listing.image}
                        alt={listing.imageAlt}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                      />
                      <span className="font-medium text-foreground truncate max-w-[180px]" title={listing.title}>
                        {listing.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono-data text-muted-foreground">{listing.bonanzaId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge-base ${SOURCE_COLORS[listing.source]}`}>
                      {SOURCE_LABELS[listing.source]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono-data text-foreground">${listing.listPrice.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono-data text-muted-foreground">${listing.buyPrice.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono-data font-semibold ${marginColor}`}>
                      {listing.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={status.cls}>{status.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono-data text-foreground">{listing.soldCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{listing.lastChecked}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative group/btn">
                        <button
                          onClick={() => handleAction('Rechecked price', listing)}
                          className="btn-ghost p-1.5"
                          aria-label="Recheck price"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-10">
                          <div className="px-2 py-1 rounded text-[10px] bg-secondary border border-border whitespace-nowrap">Recheck price</div>
                        </div>
                      </div>
                      <div className="relative group/btn">
                        <button
                          onClick={() => handleAction(listing.status === 'paused' ? 'Resumed' : 'Paused', listing)}
                          className="btn-ghost p-1.5"
                          aria-label={listing.status === 'paused' ? 'Resume listing' : 'Pause listing'}
                        >
                          {listing.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}
                        </button>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-10">
                          <div className="px-2 py-1 rounded text-[10px] bg-secondary border border-border whitespace-nowrap">
                            {listing.status === 'paused' ? 'Resume listing' : 'Pause listing'}
                          </div>
                        </div>
                      </div>
                      <div className="relative group/btn">
                        <button
                          onClick={() => handleAction('Editing', listing)}
                          className="btn-ghost p-1.5"
                          aria-label="Edit listing"
                        >
                          <Edit2 size={13} />
                        </button>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-10">
                          <div className="px-2 py-1 rounded text-[10px] bg-secondary border border-border whitespace-nowrap">Edit listing</div>
                        </div>
                      </div>
                      <div className="relative group/btn">
                        <a
                          href={`https://bonanza.com/listings/${listing.bonanzaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost p-1.5 inline-flex"
                          aria-label="View on Bonanza"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/btn:block z-10">
                          <div className="px-2 py-1 rounded text-[10px] bg-secondary border border-border whitespace-nowrap">View on Bonanza</div>
                        </div>
                      </div>
                    </div>
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
          <span className="text-foreground font-medium">87</span> active listings
        </p>
        <div className="flex items-center gap-1">
          {['1', '2', '3', '4', '5'].map((page) => (
            <button
              key={`page-${page}`}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                page === '1' ?'bg-primary/10 text-primary border border-primary/20' :'btn-ghost'
              }`}
            >
              {page}
            </button>
          ))}
          <span className="text-muted-foreground text-xs px-1">...</span>
          <button className="btn-ghost text-xs px-2 h-7">Next</button>
        </div>
      </div>
    </div>
  );
}