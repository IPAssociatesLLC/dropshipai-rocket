'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '@/components/ui/Modal';
import AppImage from '@/components/ui/AppImage';
import { Loader2, ExternalLink } from 'lucide-react';
import { PendingProduct } from './productData';
import { toast } from 'sonner';

interface ListingFormValues {
  title: string;
  listPrice: string;
  description: string;
  category: string;
  condition: string;
  quantity: string;
  handlingDays: string;
  shipsFrom: string;
  tags: string;
}

interface Props {
  product: PendingProduct | null;
  open: boolean;
  onClose: () => void;
  onPublished: (productId: string) => void;
}

const CATEGORIES = [
  'Electronics', 'Health & Beauty', 'Home & Garden', 'Automotive',
  'Sports & Outdoors', 'Toys & Games', 'Clothing', 'Books & Media',
];

export default function ListingEditorModal({ product, open, onClose, onPublished }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ListingFormValues>({
    values: product
      ? {
          title: product.title,
          listPrice: (product.googleLowest * 0.92).toFixed(2),
          description: `Brand new ${product.title}. Fast shipping with gift receipt. 100% authentic product.`,
          category: product.category,
          condition: 'new',
          quantity: '10',
          handlingDays: '1',
          shipsFrom: 'United States',
          tags: product.category.toLowerCase() + ', free shipping, fast delivery',
        }
      : undefined,
  });

  const onSubmit = async (data: ListingFormValues) => {
    setIsSubmitting(true);
    // Backend: POST to Bonanza API with listing data + product.id
    await new Promise((r) => setTimeout(r, 1800));
    setIsSubmitting(false);
    toast.success(`Published "${data.title.substring(0, 40)}..." to Bonanza`);
    onPublished(product!.id);
    reset();
    onClose();
  };

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Bonanza Listing"
      subtitle={`Source: ${product.title.substring(0, 50)}...`}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Buy: <span className="font-mono-data text-foreground">${product.buyPrice.toFixed(2)}</span>
            {' · '}
            Margin: <span className="font-mono-data text-positive">{product.margin.toFixed(1)}%</span>
            {' · '}
            Cashback: <span className="font-mono-data text-accent">{product.cashbackPct}%</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              className="btn-primary min-w-[140px] justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish to Bonanza'
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Product preview */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
          <AppImage
            src={product.image}
            alt={product.imageAlt}
            width={48}
            height={48}
            className="w-12 h-12 rounded-md object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{product.title}</p>
            <p className="text-[11px] text-muted-foreground">
              Google lowest: <span className="font-mono-data text-foreground">${product.googleLowest.toFixed(2)}</span>
              {' · '}
              Your buy: <span className="font-mono-data text-foreground">${product.buyPrice.toFixed(2)}</span>
            </p>
          </div>
          <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5">
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Listing Title <span className="text-negative">*</span>
            </label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Bonanza listing title — keep under 80 characters for best search visibility
            </p>
            <input
              {...register('title', { required: 'Title is required', maxLength: { value: 80, message: 'Max 80 characters' } })}
              className="input-base"
              placeholder="Product listing title..."
            />
            {errors.title && <p className="text-xs text-negative mt-1">{errors.title.message}</p>}
          </div>

          {/* Price + Quantity row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                List Price (USD) <span className="text-negative">*</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-1.5">Pre-filled at 92% of Google lowest</p>
              <input
                {...register('listPrice', {
                  required: 'Price is required',
                  pattern: { value: /^\d+(\.\d{1,2})?$/, message: 'Valid price required' },
                })}
                className="input-base font-mono-data"
                placeholder="0.00"
              />
              {errors.listPrice && <p className="text-xs text-negative mt-1">{errors.listPrice.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Quantity <span className="text-negative">*</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-1.5">Units available to sell</p>
              <input
                {...register('quantity', { required: 'Quantity required', min: { value: 1, message: 'Min 1' } })}
                type="number"
                className="input-base font-mono-data"
                placeholder="10"
              />
              {errors.quantity && <p className="text-xs text-negative mt-1">{errors.quantity.message}</p>}
            </div>
          </div>

          {/* Category + Condition row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Category</label>
              <select {...register('category')} className="input-base">
                {CATEGORIES.map((cat) => (
                  <option key={`cat-${cat}`} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Condition</label>
              <select {...register('condition')} className="input-base">
                <option value="new">New</option>
                <option value="like-new">Like New</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>

          {/* Handling + Ships From row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Handling Days</label>
              <p className="text-[11px] text-muted-foreground mb-1.5">Days to ship after order</p>
              <input
                {...register('handlingDays')}
                type="number"
                className="input-base font-mono-data"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Ships From</label>
              <input
                {...register('shipsFrom')}
                className="input-base"
                placeholder="United States"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Description <span className="text-negative">*</span>
            </label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Buyer-facing listing description. Gift receipt included automatically.
            </p>
            <textarea
              {...register('description', { required: 'Description is required', minLength: { value: 20, message: 'Min 20 characters' } })}
              className="input-base min-h-[80px] resize-y"
              placeholder="Describe the product..."
            />
            {errors.description && <p className="text-xs text-negative mt-1">{errors.description.message}</p>}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Search Tags</label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Comma-separated tags for Bonanza search visibility
            </p>
            <input
              {...register('tags')}
              className="input-base"
              placeholder="electronics, fast shipping, usb-c..."
            />
          </div>
        </div>

        {/* Gift receipt note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-info-subtle border border-info/20">
          <span className="text-xs text-info font-semibold mt-0.5">ℹ</span>
          <p className="text-xs text-info/80">
            Orders will be fulfilled with a gift receipt — no source pricing visible to buyer.
            Cashback routing through {product.cashbackSite} will be applied automatically.
          </p>
        </div>
      </div>
    </Modal>
  );
}