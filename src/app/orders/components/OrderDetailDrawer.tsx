'use client';

import React from 'react';
import AppImage from '@/components/ui/AppImage';
import { X, ExternalLink, CheckCircle, Circle, Loader, AlertCircle, Copy } from 'lucide-react';
import { Order, STATUS_CONFIG, SOURCE_LABELS } from './ordersData';
import { toast } from 'sonner';

interface Props {
  order: Order | null;
  onClose: () => void;
}

export default function OrderDetailDrawer({ order, onClose }: Props) {
  if (!order) return null;

  const copyTracking = () => {
    // In real app: navigator.clipboard.writeText(order.trackingNumber)
    toast.success('Tracking number copied');
  };

  const profit = order.salePrice - order.buyPrice - order.cashbackEarned * -1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-border flex flex-col animate-slide-in-right h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <AppImage
              src={order.productImage}
              alt={order.productImageAlt}
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight max-w-[260px] truncate">
                {order.product}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono-data text-[11px] text-muted-foreground">{order.id}</span>
                <span className={STATUS_CONFIG[order.status].cls}>
                  {STATUS_CONFIG[order.status].label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Financials */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Sale Price</p>
              <p className="font-mono-data text-lg font-bold text-foreground">${order.salePrice.toFixed(2)}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Buy Price</p>
              <p className="font-mono-data text-lg font-bold text-foreground">${order.buyPrice.toFixed(2)}</p>
            </div>
            <div className="bg-positive-subtle rounded-lg p-3 border border-positive/15">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Margin</p>
              <p className="font-mono-data text-lg font-bold text-positive">{order.margin.toFixed(1)}%</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Cashback Earned</p>
              <p className="font-mono-data text-lg font-bold text-accent">+${order.cashbackEarned.toFixed(2)}</p>
            </div>
          </div>

          {/* Buyer */}
          <div className="card-elevated p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground mb-2">Buyer</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Name</span>
              <span className="text-foreground font-medium">{order.buyer}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Email</span>
              <span className="font-mono-data text-foreground">{order.buyerEmail}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Bonanza Order</span>
              <span className="font-mono-data text-foreground">{order.bonanzaOrderId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Gift Receipt</span>
              <span className={order.giftReceipt ? 'text-positive font-semibold' : 'text-muted-foreground'}>
                {order.giftReceipt ? '✓ Included' : 'Not set'}
              </span>
            </div>
          </div>

          {/* Cashback routing */}
          <div className="card-elevated p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground mb-2">Cashback Route</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cashback Site</span>
              <span className="badge-base bg-positive-subtle text-positive border border-positive/20">
                {order.cashbackSite}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono-data text-foreground">{order.cashbackPct}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Earned</span>
              <span className="font-mono-data text-accent font-semibold">+${order.cashbackEarned.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Source</span>
              <span className="badge-base bg-secondary text-muted-foreground border border-border">
                {SOURCE_LABELS[order.source]}
              </span>
            </div>
            {order.sourceOrderId && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Source Order ID</span>
                <span className="font-mono-data text-foreground">{order.sourceOrderId}</span>
              </div>
            )}
          </div>

          {/* Tracking */}
          {order.trackingNumber && (
            <div className="card-elevated p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground mb-2">Shipment</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Carrier</span>
                <span className="text-foreground">{order.carrier}</span>
              </div>
              <div className="flex items-start justify-between text-xs gap-2">
                <span className="text-muted-foreground flex-shrink-0">Tracking</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono-data text-foreground text-[11px] break-all">{order.trackingNumber}</span>
                  <button onClick={copyTracking} className="btn-ghost p-0.5 flex-shrink-0">
                    <Copy size={11} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Est. Delivery</span>
                <span className="text-foreground">{order.estimatedDelivery}</span>
              </div>
              {order.deliveredAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivered</span>
                  <span className="text-positive font-semibold">{order.deliveredAt}</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-3">Fulfillment Timeline</p>
            <div className="relative pl-5">
              {order.timeline.map((event, idx) => {
                const isLast = idx === order.timeline.length - 1;
                return (
                  <div key={event.id} className="relative pb-4">
                    {!isLast && (
                      <div className="absolute left-[-13px] top-5 bottom-0 w-px bg-border" />
                    )}
                    <div className="absolute left-[-18px] top-0.5">
                      {event.status === 'completed' ? (
                        <CheckCircle size={14} className="text-positive" />
                      ) : event.status === 'active' ? (
                        <Loader size={14} className="text-warning animate-spin" />
                      ) : (
                        <Circle size={14} className="text-border" />
                      )}
                    </div>
                    <div className="ml-1">
                      <p className={`text-xs font-medium leading-tight ${
                        event.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {event.label}
                      </p>
                      {event.detail && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{event.detail}</p>
                      )}
                      {event.timestamp && (
                        <p className="font-mono-data text-[10px] text-muted-foreground/60 mt-0.5">{event.timestamp}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exception alert */}
          {order.status === 'exception' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-negative-subtle border border-negative/20">
              <AlertCircle size={14} className="text-negative mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-negative">Fulfillment Exception</p>
                <p className="text-[11px] text-negative/70 mt-0.5">
                  Carrier attempted delivery but could not complete. Contact buyer to confirm address or arrange re-delivery.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-border flex gap-2 flex-shrink-0">
          {order.trackingNumber && (
            <a
              href={`https://track.aftership.com/${order.trackingNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex-1 justify-center text-xs gap-1.5"
            >
              <ExternalLink size={13} />
              Track Shipment
            </a>
          )}
          <button
            onClick={() => { toast.success('Bonanza order page opened'); }}
            className="btn-secondary flex-1 justify-center text-xs gap-1.5"
          >
            <ExternalLink size={13} />
            View on Bonanza
          </button>
        </div>
      </div>
    </div>
  );
}