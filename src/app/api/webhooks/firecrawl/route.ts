import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Firecrawl webhook event types
interface FirecrawlWebhookPayload {
  success: boolean;
  type: string;
  id: string;
  webhookId?: string;
  data: FirecrawlMonitorPageData[] | FirecrawlCheckCompletedData[];
  metadata?: Record<string, unknown>;
  error?: string;
}

interface FirecrawlMonitorPageData {
  monitorId: string;
  checkId: string;
  url: string;
  status: 'new' | 'same' | 'changed' | 'removed';
  previousScrapeId?: string;
  currentScrapeId?: string;
  error?: string | null;
  isMeaningful?: boolean;
  judgment?: {
    meaningful: boolean;
    confidence: string;
    reason: string;
    meaningfulChanges?: Array<{
      type: string;
      before: string;
      after: string;
      reason: string;
    }>;
  };
  diff?: {
    text?: string;
  };
}

interface FirecrawlCheckCompletedData {
  monitorId: string;
  checkId: string;
  status: string;
  summary?: {
    totalPages: number;
    same: number;
    changed: number;
    new: number;
    removed: number;
    error: number;
  };
}

// Extract price from markdown content using regex patterns
function extractPriceFromMarkdown(markdown: string): number | null {
  // Common price patterns: $19.99, USD 19.99, 19.99 USD, ¥1999, etc.
  const patterns = [
    /\$\s*([\d,]+\.?\d*)/,
    /USD\s*([\d,]+\.?\d*)/i,
    /price[:\s]+\$?\s*([\d,]+\.?\d*)/i,
    /sale[:\s]+\$?\s*([\d,]+\.?\d*)/i,
    /now[:\s]+\$?\s*([\d,]+\.?\d*)/i,
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) return price;
    }
  }
  return null;
}

// Extract stock status from markdown
function extractStockFromMarkdown(markdown: string): boolean | null {
  const lowerMd = markdown.toLowerCase();
  if (lowerMd.includes('out of stock') || lowerMd.includes('sold out') || lowerMd.includes('unavailable') || lowerMd.includes('not available')) {
    return false;
  }
  if (lowerMd.includes('in stock') || lowerMd.includes('add to cart') || lowerMd.includes('buy now') || lowerMd.includes('available')) {
    return true;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as FirecrawlWebhookPayload;

    // Log the event for debugging
    console.log('[Firecrawl Webhook]', payload.type, 'id:', payload.id);

    // Only process monitor events
    if (!payload.type?.startsWith('monitor.')) {
      return NextResponse.json({ received: true, processed: false, reason: 'Not a monitor event' });
    }

    if (!payload.success) {
      console.warn('[Firecrawl Webhook] Event reported failure:', payload.error);
      return NextResponse.json({ received: true, processed: false, reason: 'Event reported failure' });
    }

    const supabase = await createClient();

    // Handle monitor.page — a single page was checked and may have changed
    if (payload.type === 'monitor.page') {
      const pages = payload.data as FirecrawlMonitorPageData[];
      const results: Array<{ url: string; action: string; productId?: string }> = [];

      for (const page of pages) {
        if (page.status !== 'changed' && page.status !== 'new') {
          results.push({ url: page.url, action: 'skipped_no_change' });
          continue;
        }

        // Find the product in Supabase by source_url
        const { data: products } = await supabase
          .from('products')
          .select('id, user_id, title, source_price, stock, bonanza_listing_id, source_url')
          .eq('source_url', page.url)
          .limit(5);

        if (!products || products.length === 0) {
          // Also check bonanza_listings by source_url
          const { data: listings } = await supabase
            .from('bonanza_listings')
            .select('id, user_id, title, price, cost, source_url')
            .eq('source_url', page.url)
            .limit(5);

          if (!listings || listings.length === 0) {
            results.push({ url: page.url, action: 'no_matching_product' });
            continue;
          }

          // Update bonanza_listings directly
          for (const listing of listings) {
            const diffText = page.diff?.text || '';
            const newPrice = extractPriceFromMarkdown(diffText);
            const inStock = extractStockFromMarkdown(diffText);

            const updateData: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
              last_synced_at: new Date().toISOString(),
            };

            if (newPrice !== null) updateData.cost = newPrice;
            if (inStock === false) updateData.status = 'out_of_stock';
            if (inStock === true && listing.status === 'out_of_stock') updateData.status = 'active';

            await supabase.from('bonanza_listings').update(updateData).eq('id', listing.id);
            results.push({ url: page.url, action: 'bonanza_listing_updated', productId: listing.id });
          }
          continue;
        }

        // Process each matching product
        for (const product of products) {
          const diffText = page.diff?.text || '';
          const newPrice = extractPriceFromMarkdown(diffText);
          const inStock = extractStockFromMarkdown(diffText);

          const productUpdate: Record<string, unknown> = {
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          let alertType: string | null = null;
          let oldValue: number | null = null;
          let newValue: number | null = null;
          let alertMessage = '';

          // Price change detected
          if (newPrice !== null && newPrice !== Number(product.source_price)) {
            const oldPrice = Number(product.source_price);
            productUpdate.source_price = newPrice;
            alertType = 'price_change';
            oldValue = oldPrice;
            newValue = newPrice;
            const direction = newPrice < oldPrice ? '↓ decreased' : '↑ increased';
            alertMessage = `Price ${direction} from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} on ${page.url}`;
          }

          // Stock change detected
          if (inStock === false && (product.stock === null || product.stock > 0)) {
            productUpdate.stock = 0;
            if (!alertType) {
              alertType = 'out_of_stock';
              alertMessage = `Product went out of stock: ${product.title} — ${page.url}`;
            }
          } else if (inStock === true && product.stock === 0) {
            productUpdate.stock = 1;
            if (!alertType) {
              alertType = 'back_in_stock';
              alertMessage = `Product back in stock: ${product.title} — ${page.url}`;
            }
          }

          // Update the product record
          await supabase.from('products').update(productUpdate).eq('id', product.id);

          // Create a price_alert record if something changed
          if (alertType) {
            await supabase.from('price_alerts').insert({
              user_id: product.user_id,
              product_id: product.id,
              alert_type: alertType,
              old_value: oldValue,
              new_value: newValue,
              message: alertMessage,
              is_read: false,
            });
          }

          // Sync to bonanza_listings if this product has a bonanza listing
          if (product.bonanza_listing_id) {
            const bonanzaUpdate: Record<string, unknown> = {
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (newPrice !== null) bonanzaUpdate.cost = newPrice;
            if (inStock === false) bonanzaUpdate.status = 'out_of_stock';
            if (inStock === true) bonanzaUpdate.status = 'active';

            // Update bonanza_listings by bonanza_item_id or source_url
            await supabase
              .from('bonanza_listings')
              .update(bonanzaUpdate)
              .or(`bonanza_item_id.eq.${product.bonanza_listing_id},source_url.eq.${page.url}`)
              .eq('user_id', product.user_id);
          }

          results.push({ url: page.url, action: alertType || 'checked_no_change', productId: product.id });
        }
      }

      return NextResponse.json({ received: true, processed: true, results });
    }

    // Handle monitor.check.completed — summary of the full check run
    if (payload.type === 'monitor.check.completed') {
      const checks = payload.data as FirecrawlCheckCompletedData[];
      const summaries = checks.map((c) => ({
        monitorId: c.monitorId,
        checkId: c.checkId,
        status: c.status,
        summary: c.summary,
      }));
      console.log('[Firecrawl Webhook] Check completed:', JSON.stringify(summaries));
      return NextResponse.json({ received: true, processed: true, summaries });
    }

    return NextResponse.json({ received: true, processed: false, reason: 'Unhandled event type' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Firecrawl Webhook] Error:', err);
    // Always return 200 to Firecrawl so it doesn't retry indefinitely
    return NextResponse.json({ received: true, processed: false, error: message });
  }
}
