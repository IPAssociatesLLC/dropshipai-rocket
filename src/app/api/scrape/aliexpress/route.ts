import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dsTextSearch, type AliDsCredentials,  } from '@/lib/aliexpress-ds';

interface ScrapflyProduct {
  title?: string;
  price?: number | string;
  original_price?: number | string;
  image?: string;
  url?: string;
  rating?: number | string;
  reviews?: number | string;
  sold?: number | string;
  shipping?: number | string;
  store?: string;
  product_id?: string;
}

interface AliDsProduct {
  product_id?: string | number;
  subject?: string;
  product_main_image_url?: string;
  app_sale_price?: string;
  original_price?: string;
  sale_price?: string;
  evaluate_rate?: string;
  lastest_volume?: number | string;
  shop_url?: string;
  product_detail_url?: string;
  target_sale_price?: string;
  target_original_price?: string;
}

/**
 * Apply price adjustments to a raw scraped price:
 * 1. If lowPriceMarkupEnabled and price <= threshold, add flat markup amount
 * 2. Apply multiplier on top
 */
function applyPriceAdjustments(
  rawPrice: number,
  multiplier: number,
  lowPriceMarkupEnabled: boolean,
  lowPriceMarkupAmount: number,
  lowPriceMarkupThreshold: number,
): number {
  let price = rawPrice;
  if (lowPriceMarkupEnabled && price > 0 && price <= lowPriceMarkupThreshold) {
    price = price + lowPriceMarkupAmount;
  }
  if (multiplier > 1) {
    price = price * multiplier;
  }
  return Math.round(price * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      scrapflyKey,
      keywords,
      urls,
      minPrice,
      maxPrice,
      minRating,
      freeShipping,
      priceMultiplier,
      lowPriceMarkupEnabled = true,
      lowPriceMarkupAmount = 10.0,
      lowPriceMarkupThreshold = 5.0,
    } = body as {
      userId: string;
      scrapflyKey: string;
      keywords?: string;
      urls?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      freeShipping?: boolean;
      priceMultiplier?: number;
      lowPriceMarkupEnabled?: boolean;
      lowPriceMarkupAmount?: number;
      lowPriceMarkupThreshold?: number;
    };

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Missing userId.' }, { status: 400 });
    }

    const multiplier = priceMultiplier && priceMultiplier > 1 ? priceMultiplier : 1;
    const markupEnabled = lowPriceMarkupEnabled !== false;
    const markupAmount = typeof lowPriceMarkupAmount === 'number' ? lowPriceMarkupAmount : 10.0;
    const markupThreshold = typeof lowPriceMarkupThreshold === 'number' ? lowPriceMarkupThreshold : 5.0;

    const supabase = await createClient();

    // Check if AliExpress DS API credentials are saved
    const { data: aliCreds } = await supabase
      .from('api_credentials')
      .select('credentials, is_connected')
      .eq('user_id', userId)
      .eq('service', 'aliexpress_ds')
      .single();

    const aliDsCreds = aliCreds?.credentials as Record<string, string> | null;
    const hasAliDsApi = !!(aliDsCreds?.appKey && aliDsCreds?.appSecret);

    const savedProducts: string[] = [];
    const errors: string[] = [];
    let dataSource = 'scrapfly';

    if (hasAliDsApi) {
      // ── AliExpress Dropshipping API path ──────────────────────────────────
      dataSource = 'aliexpress_ds_api';
      const creds: AliDsCredentials = {
        appKey: aliDsCreds!.appKey,
        appSecret: aliDsCreds!.appSecret,
        accessToken: aliDsCreds!.accessToken || undefined,
      };

      const searchKeywords = keywords
        ? keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 3)
        : ['electronics'];

      for (const kw of searchKeywords) {
        try {
          // Use dsTextSearch from the DS API utility
          const result = await dsTextSearch(creds, {
            keywords: kw,
            sort: 'SALE_PRICE_ASC',
            page_no: 1,
            page_size: 20,
            target_currency: 'USD',
            target_language: 'EN',
          });

          if (!result.success) {
            errors.push(`DS API error for "${kw}": ${result.errorMsg}`);
            continue;
          }

          const respData = result.data as Record<string, unknown>;
          const items = ((respData?.products as Record<string, unknown>)?.product as AliDsProduct[]) || [];

          for (const p of items.slice(0, 20)) {
            const rawPriceStr = p.target_sale_price || p.app_sale_price || p.sale_price || '0';
            const rawPrice = parseFloat(String(rawPriceStr).replace(/[^0-9.]/g, '')) || 0;
            const adjustedPrice = applyPriceAdjustments(rawPrice, multiplier, markupEnabled, markupAmount, markupThreshold);

            if (minPrice && adjustedPrice < minPrice) continue;
            if (maxPrice && adjustedPrice > maxPrice) continue;
            const rating = parseFloat(String(p.evaluate_rate || '0').replace('%', '')) / 20;
            if (minRating && rating < minRating) continue;

            const title = p.subject || 'AliExpress Product';
            const imageUrl = p.product_main_image_url || '';
            const productUrl = p.product_detail_url || `https://www.aliexpress.com/item/${p.product_id}.html`;

            const { data: inserted, error: insertErr } = await supabase
              .from('products')
              .upsert({
                user_id: userId,
                title,
                source_url: productUrl,
                source_site: 'aliexpress',
                source_price: adjustedPrice,
                raw_source_price: rawPrice,
                shipping_cost: 0,
                image_url: imageUrl,
                rating,
                review_count: 0,
                sold_count: Number(p.lastest_volume || 0),
                store_name: '',
                external_id: String(p.product_id || ''),
                status: 'pending_review',
                margin_pct: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,source_url', ignoreDuplicates: true })
              .select('id')
              .single();

            if (!insertErr && inserted) {
              savedProducts.push(inserted.id);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`DS API error for "${kw}": ${msg}`);
        }
      }
    } else {
      // ── Scrapfly fallback path ────────────────────────────────────────────
      if (!scrapflyKey) {
        return NextResponse.json({ success: false, message: 'No AliExpress DS API credentials found and no Scrapfly API key provided. Add credentials in API Connections.' }, { status: 400 });
      }

      const targetUrls: string[] = [];

      if (urls) {
        urls.split('\n').map((u: string) => u.trim()).filter(Boolean).forEach((u: string) => targetUrls.push(u));
      }

      if (keywords && targetUrls.length === 0) {
        const kwList = keywords.split(',').map((k: string) => k.trim()).filter(Boolean).slice(0, 3);
        for (const kw of kwList) {
          const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(kw)}&SortType=total_tranpro_desc`;
          targetUrls.push(searchUrl);
        }
      }

      if (targetUrls.length === 0) {
        targetUrls.push('https://www.aliexpress.com/ssr/300002660/Deals-HomePage');
      }

      for (const targetUrl of targetUrls.slice(0, 3)) {
        try {
          const scrapflyUrl = new URL('https://api.scrapfly.io/scrape');
          scrapflyUrl.searchParams.set('key', scrapflyKey);
          scrapflyUrl.searchParams.set('url', targetUrl);
          scrapflyUrl.searchParams.set('asp', 'true');
          scrapflyUrl.searchParams.set('render_js', 'true');
          scrapflyUrl.searchParams.set('country', 'us');
          scrapflyUrl.searchParams.set('proxy_pool', 'public_residential_pool');
          scrapflyUrl.searchParams.set('format', 'json');

          const sfRes = await fetch(scrapflyUrl.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(30000),
          });

          if (!sfRes.ok) {
            errors.push(`Scrapfly error for ${targetUrl}: HTTP ${sfRes.status}`);
            continue;
          }

          const sfData = await sfRes.json() as Record<string, unknown>;
          const content = (sfData?.result as Record<string, unknown>)?.content as string || '';

          // Parse product data from the scraped HTML/JSON
          const productMatches = content.match(/"productId"\s*:\s*"?(\d+)"?/g) || [];
          const titleMatches = content.match(/"title"\s*:\s*"([^"]+)"/g) || [];
          const priceMatches = content.match(/"salePrice"\s*:\s*\{[^}]*"value"\s*:\s*"([^"]+)"/g) || [];

          const scrapedProducts: ScrapflyProduct[] = productMatches.slice(0, 20).map((_, i) => {
            const idMatch = productMatches[i]?.match(/(\d+)/);
            const titleMatch = titleMatches[i]?.match(/"title"\s*:\s*"([^"]+)"/);
            const priceMatch = priceMatches[i]?.match(/"value"\s*:\s*"([^"]+)"/);
            return {
              product_id: idMatch?.[1] || '',
              title: titleMatch?.[1] || 'AliExpress Product',
              price: priceMatch?.[1] || '0',
            };
          });

          for (const p of scrapedProducts) {
            const rawPrice = parseFloat(String(p.price || '0').replace(/[^0-9.]/g, '')) || 0;
            const adjustedPrice = applyPriceAdjustments(rawPrice, multiplier, markupEnabled, markupAmount, markupThreshold);

            if (minPrice && adjustedPrice < minPrice) continue;
            if (maxPrice && adjustedPrice > maxPrice) continue;
            if (freeShipping && Number(p.shipping || 0) > 0) continue;

            const productUrl = p.url || (p.product_id ? `https://www.aliexpress.com/item/${p.product_id}.html` : targetUrl);

            const { data: inserted, error: insertErr } = await supabase
              .from('products')
              .upsert({
                user_id: userId,
                title: p.title || 'AliExpress Product',
                source_url: productUrl,
                source_site: 'aliexpress',
                source_price: adjustedPrice,
                raw_source_price: rawPrice,
                shipping_cost: Number(p.shipping || 0),
                image_url: p.image || '',
                rating: Number(p.rating || 0),
                review_count: Number(p.reviews || 0),
                sold_count: Number(p.sold || 0),
                store_name: p.store || '',
                external_id: p.product_id || '',
                status: 'pending_review',
                margin_pct: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,source_url', ignoreDuplicates: true })
              .select('id')
              .single();

            if (!insertErr && inserted) {
              savedProducts.push(inserted.id);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Scrapfly error for ${targetUrl}: ${msg}`);
        }
      }
    }

    const total = savedProducts.length;
    const errCount = errors.length;

    return NextResponse.json({
      success: true,
      message: `Scraped ${total} product${total !== 1 ? 's' : ''} from AliExpress${errCount > 0 ? ` (${errCount} error${errCount !== 1 ? 's' : ''})` : ''}.`,
      count: total,
      dataSource,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message: `Server error: ${msg}` }, { status: 500 });
  }
}
