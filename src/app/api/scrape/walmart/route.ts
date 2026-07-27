import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface WalmartProduct {
  title?: string;
  price?: number | string;
  original_price?: number | string;
  image?: string;
  url?: string;
  rating?: number | string;
  reviews?: number | string;
  upc?: string;
  sku?: string;
  brand?: string;
  in_stock?: boolean;
  product_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, scrapflyKey, keywords, urls, minPrice, maxPrice, minRating, requireUPC, requireSKU } = body as {
      userId: string;
      scrapflyKey: string;
      keywords?: string;
      urls?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      requireUPC?: boolean;
      requireSKU?: boolean;
    };

    if (!userId || !scrapflyKey) {
      return NextResponse.json({ success: false, message: 'Missing userId or Scrapfly API key.' }, { status: 400 });
    }

    const targetUrls: string[] = [];

    if (urls) {
      urls.split('\n').map((u) => u.trim()).filter(Boolean).forEach((u) => targetUrls.push(u));
    }

    if (keywords && targetUrls.length === 0) {
      const kwList = keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 3);
      for (const kw of kwList) {
        const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(kw)}&sort=best_seller`;
        targetUrls.push(searchUrl);
      }
    }

    if (targetUrls.length === 0) {
      // Default: Walmart flash deals / rollback page
      targetUrls.push('https://www.walmart.com/shop/deals/flash-picks');
    }

    const savedProducts: string[] = [];
    const errors: string[] = [];

    for (const targetUrl of targetUrls.slice(0, 3)) {
      try {
        // Scrapfly Walmart scraper — Walmart has heavy anti-bot, ASP bypass is critical
        const scrapflyUrl = new URL('https://api.scrapfly.io/scrape');
        scrapflyUrl.searchParams.set('key', scrapflyKey);
        scrapflyUrl.searchParams.set('url', targetUrl);
        scrapflyUrl.searchParams.set('asp', 'true'); // Anti-scraping protection bypass — essential for Walmart
        scrapflyUrl.searchParams.set('country', 'us');
        scrapflyUrl.searchParams.set('render_js', 'true');
        scrapflyUrl.searchParams.set('format', 'json');
        scrapflyUrl.searchParams.set('extraction_model', 'product_list');
        // Walmart-specific: use residential proxies for better success rate
        scrapflyUrl.searchParams.set('proxy_pool', 'public_residential_pool');

        const res = await fetch(scrapflyUrl.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(45000), // Walmart can be slow
        });

        if (!res.ok) {
          const errText = await res.text();
          errors.push(`Scrapfly error for ${targetUrl}: HTTP ${res.status} — ${errText.slice(0, 200)}`);
          continue;
        }

        const data = await res.json() as Record<string, unknown>;
        const result = data?.result as Record<string, unknown>;
        const extracted = result?.extracted_data as Record<string, unknown>;
        const products = (extracted?.products || extracted?.items || []) as WalmartProduct[];

        if (!products || products.length === 0) {
          errors.push(`No products extracted from ${targetUrl}`);
          continue;
        }

        const supabase = await createClient();

        for (const p of products.slice(0, 20)) {
          const price = typeof p.price === 'string' ? parseFloat(p.price.replace(/[^0-9.]/g, '')) : Number(p.price || 0);

          // Apply filters
          if (minPrice && price < minPrice) continue;
          if (maxPrice && price > maxPrice) continue;
          if (minRating && Number(p.rating || 0) < minRating) continue;
          if (requireUPC && !p.upc) continue;
          if (requireSKU && !p.sku) continue;
          if (p.in_stock === false) continue;

          const title = p.title || 'Walmart Product';
          const imageUrl = p.image || '';
          const productUrl = p.url || targetUrl;

          const { data: inserted, error: insertErr } = await supabase
            .from('products')
            .upsert({
              user_id: userId,
              title,
              source_url: productUrl,
              source_site: 'walmart',
              source_price: price,
              image_url: imageUrl,
              rating: Number(p.rating || 0),
              review_count: Number(p.reviews || 0),
              upc: p.upc || null,
              sku: p.sku || null,
              brand: p.brand || null,
              external_id: p.product_id || '',
              status: 'pending_review',
              margin_pct: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,source_url', ignoreDuplicates: true })
            .select('id')
            .single();

          if (insertErr) {
            console.error('Insert Walmart product error:', insertErr);
          } else if (inserted) {
            savedProducts.push(inserted.id);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error scraping ${targetUrl}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: savedProducts.length > 0 || errors.length === 0,
      productsFound: savedProducts.length,
      message: savedProducts.length > 0
        ? `Scraped and saved ${savedProducts.length} Walmart products to your dashboard.${errors.length > 0 ? ` (${errors.length} URL(s) had errors)` : ''}`
        : `Scrape completed but no new products were saved. ${errors.join('; ')}`,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Walmart scrape error:', err);
    return NextResponse.json({ success: false, message: `Server error: ${message}` }, { status: 500 });
  }
}
