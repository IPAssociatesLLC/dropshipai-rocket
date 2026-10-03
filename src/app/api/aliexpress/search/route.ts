import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAliDsApi, dsFeedNameGet, dsFeedItemIdsGet, dsProductGet, freightCalculate, runWithConcurrencyLimit } from '@/lib/aliexpress-ds';
import { categoryLabel } from '@/lib/aliexpress-categories';

// Map UI sort values to AliExpress DS text search sortBy values
const TEXT_SORT_MAP: Record<string, string> = {
  'orders,desc': 'orders,desc',
  'price,asc': 'price,asc',
  'price,desc': 'price,desc',
  'score,desc': 'score,desc',
  'default': '',
};

async function writeActivityLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  entry: {
    type: string;
    status: string;
    title: string;
    message: string;
    detail?: string;
    source?: string;
    products_count?: number;
    error_code?: string;
    duration?: string;
  }
) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      type: entry.type,
      status: entry.status,
      title: entry.title,
      message: entry.message,
      detail: entry.detail ?? null,
      source: entry.source ?? 'AliExpress DS API',
      products_count: entry.products_count ?? null,
      error_code: entry.error_code ?? null,
      duration: entry.duration ?? null,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[ActivityLog] Failed to write log:', e);
  }
}

export async function POST(request: NextRequest) {
  const LOG = (...args: unknown[]) => console.log('[AliExpress Search]', ...args);
  const ERR = (...args: unknown[]) => console.error('[AliExpress Search ERROR]', ...args);
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      ERR('Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { keywords, categoryId, minPrice, maxPrice, pageNo = 1, pageSize = 20, sortBy, searchId } = body;
    LOG('Search request:', { keywords, categoryId, minPrice, maxPrice, pageNo, pageSize, sortBy, hasSearchId: !!searchId });

    const hasKeywords = keywords && typeof keywords === 'string' && keywords.trim().length > 0;
    const hasCategoryId = categoryId && String(categoryId).trim().length > 0;

    const { data: credRow, error: credError } = await supabase
      .from('api_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('service', 'aliexpress_ds')
      .single();

    if (credError) ERR('Credential fetch error:', credError);

    const creds = (credRow?.credentials as Record<string, string>) || {};
    if (!creds.appKey || !creds.appSecret) {
      ERR('Missing appKey or appSecret');
      return NextResponse.json({ error: 'AliExpress DS API credentials not configured. Please add them in API Connections.' }, { status: 400 });
    }

    
    const searchCreds = { appKey: creds.appKey, appSecret: creds.appSecret, ...(creds.accessToken ? { accessToken: creds.accessToken } : {}) };
    
    // TEMPORARY LOG FOR FEED NAMES
    try {
      const feedNamesRes = await callAliDsApi('aliexpress.ds.feedname.get', searchCreds, {});
      console.log('----- AVAILABLE FEED NAMES -----');
      console.log(JSON.stringify(feedNamesRes, null, 2));
      console.log('--------------------------------');
    } catch(e){}


    const durationMs = () => Date.now() - startTime;
    const durationStr = () => {
      const ms = durationMs();
      return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    };

    function normalizeProduct(prod: any, defaultCatId?: string) {
      return {
        itemId: String(prod.product_id ?? prod.itemId ?? ''),
        title: prod.product_title ?? prod.title ?? '',
        itemMainPic: prod.product_main_image_url ?? prod.itemMainPic ?? '',
        salePrice: prod.target_sale_price ?? prod.targetSalePrice ?? prod.salePrice ?? '0',
        originalPrice: prod.target_original_price ?? prod.targetOriginalPrice ?? prod.originalPrice ?? '0',
        targetSalePrice: prod.target_sale_price ?? prod.targetSalePrice ?? prod.salePrice ?? '0',
        targetOriginalPrice: prod.target_original_price ?? prod.targetOriginalPrice ?? prod.originalPrice ?? '0',
        targetOriginalPriceCurrency: prod.target_original_price_currency ?? prod.targetOriginalPriceCurrency ?? 'USD',
        salePriceCurrency: prod.target_sale_price_currency ?? prod.salePriceCurrency ?? 'USD',
        discount: prod.discount ?? '0%',
        evaluateRate: prod.evaluate_rate ?? prod.evaluateRate ?? '0',
        orders: String(prod.lastest_volume ?? prod.orders ?? 0),
        cateId: String(prod.category_id ?? prod.cateId ?? defaultCatId ?? ''),
        itemUrl: prod.product_detail_url ?? prod.itemUrl ?? `//www.aliexpress.com/item/${prod.product_id ?? prod.itemId}.html`,
        freightAmount: String(prod.freightAmount ?? '0'),
        skuNumber: prod.skuNumber,
      };
    }

    // Determine the keyword to send.
    // If user provided keywords, use them.
    // If no keywords but category is selected, use the category label as a generic search term so text.search doesn't ignore the categoryId.
    let searchKeyword = keywords || '';
    if (!searchKeyword && hasCategoryId) {
      const label = categoryLabel(categoryId) || '';
      // Just use the first major word of the category to avoid complex strings that crash the API
      searchKeyword = label.split(/[^a-zA-Z0-9]/)[0].trim() || 'best';
    }

    const allNormalized: any[] = [];
    let totalCount = 0;
    let rawResponse = null;
    let debugInfo = {};
    let errorCode = null;
    let errorMsg = null;
    
    const minP = (minPrice !== undefined && minPrice !== '') ? parseFloat(String(minPrice)) : null;
    const maxP = (maxPrice !== undefined && maxPrice !== '') ? parseFloat(String(maxPrice)) : null;

    // Multi-page fetch to ensure we find items within the price range locally
    for (let p = 1; p <= 3; p++) {
      const extraParams: Record<string, string> = {
        local: 'en_US',
        countryCode: 'US',
        currency: 'USD',
        pageSize: '50', // Fetch large pages for local filtering
        pageIndex: String(p),
        keyWord: searchKeyword,
      };
      
      if (hasCategoryId) extraParams.categoryId = String(categoryId);
      
      const sortByKey = sortBy ?? 'orders,desc';
      const aliSortBy = TEXT_SORT_MAP[sortByKey] ?? sortByKey;
      if (aliSortBy) extraParams.sortBy = aliSortBy;

      LOG(`[Page ${p}] Calling aliexpress.ds.text.search with params:`, extraParams);
      const result = await callAliDsApi('aliexpress.ds.text.search', searchCreds, extraParams);
      
      if (!result.success) {
        if (p === 1) {
          errorCode = result.errorCode;
          errorMsg = result.errorMsg;
          rawResponse = result.rawResponse;
        }
        break;
      }
      
      if (p === 1) {
        rawResponse = result.rawResponse;
        debugInfo = { endpoint: 'aliexpress.ds.text.search' };
      }

      const innerData = result.data as any;
      const searchData = innerData?.['data'];
      const productsWrapper = searchData?.products;
      let rawProducts: any[] = (
        (Array.isArray(productsWrapper) ? productsWrapper : null) ??
        (productsWrapper?.selection_search_product) ??
        []
      );
      
      if (p === 1) totalCount = searchData?.totalCount ?? rawProducts.length;

      for (const prod of rawProducts) {
        const norm = normalizeProduct(prod, categoryId);
        
        // Local filters
        const price = parseFloat(norm.targetSalePrice) || 0;
        if (minP !== null && price < minP) continue;
        if (maxP !== null && price > maxP) continue;
        
        // Local Category Filter (since text.search sometimes leaks global products if keyword matches globally)
        if (hasCategoryId) {
           const cats = String(norm.cateId).split(',');
           if (!cats.includes(String(categoryId))) continue;
        }
        
        allNormalized.push(norm);
      }

      if (allNormalized.length >= pageSize) break;
      if (rawProducts.length < 50) break; 
    }

    if (errorCode) {
      ERR('API call failed:', errorCode, errorMsg);
      await writeActivityLog(supabase, user.id, {
        type: 'api',
        status: 'failed',
        title: 'AliExpress Product Search',
        message: `Search failed: ${errorCode ?? 'Unknown error'}`,
        detail: errorMsg ?? 'API returned an error',
        source: 'AliExpress DS API',
        products_count: 0,
        error_code: String(errorCode ?? ''),
        duration: durationStr(),
      });
      return NextResponse.json({
        error: `AliExpress API error (${errorCode}): ${errorMsg}`,
        code: errorCode,
        rawResponse,
      }, { status: 400 });
    }

    // Sort locally in case text.search ignored the sort (it often does)
    const sortByKey = sortBy ?? 'orders,desc';
    if (sortByKey === 'orders,desc') {
      allNormalized.sort((a, b) => parseInt(b.orders) - parseInt(a.orders));
    } else if (sortByKey === 'price,asc') {
      allNormalized.sort((a, b) => parseFloat(a.targetSalePrice) - parseFloat(b.targetSalePrice));
    } else if (sortByKey === 'price,desc') {
      allNormalized.sort((a, b) => parseFloat(b.targetSalePrice) - parseFloat(a.targetSalePrice));
    } else if (sortByKey === 'score,desc') {
      allNormalized.sort((a, b) => parseFloat(b.evaluateRate) - parseFloat(a.evaluateRate));
    }

    const finalProducts = allNormalized.slice(0, pageSize);

    // Fetch shipping costs for the final products before returning
    const finalProductsWithFreight = await runWithConcurrencyLimit(finalProducts, 5, async (prod: any) => {
      try {
        const fRes = await freightCalculate(searchCreds, { product_id: prod.itemId, product_num: 1, country_code: 'US', price_currency: 'USD' }).catch(() => null);
        let shippingFee = '0';
        if (fRes && fRes.success) {
          const opts = (fRes.data as any)?.delivery_options;
          if (opts && opts.length > 0) {
            shippingFee = String(opts[0].shipping_fee_cent || '0');
          }
        }
        return { ...prod, freightAmount: shippingFee };
      } catch (e) {
        return { ...prod, freightAmount: '0' };
      }
    });

    const searchLabel = hasKeywords
      ? `"${keywords.trim()}"${hasCategoryId ? ` in category ${categoryId}` : ''}`
      : `Browse category ${categoryId ?? '(all)'}`;

    const logStatus = finalProductsWithFreight.length > 0 ? 'completed' : 'failed';
    const logMessage = finalProductsWithFreight.length > 0
      ? `Search completed: ${finalProductsWithFreight.length} products for ${searchLabel}`
      : `Search returned 0 products for ${searchLabel} — no matching results from AliExpress`;

    await writeActivityLog(supabase, user.id, {
      type: 'scan',
      status: logStatus,
      title: 'AliExpress Product Discovery',
      message: logMessage,
      detail: `Keywords: ${keywords?.trim() || '(none)'} | Category: ${hasCategoryId ? categoryId : '(all)'} | Sort: ${sortBy || 'relevance'} | Price: ${minPrice || '*'}-${maxPrice || '*'} | Returned: ${finalProductsWithFreight.length}`,
      source: 'AliExpress DS API',
      products_count: finalProductsWithFreight.length,
      error_code: finalProductsWithFreight.length === 0 ? 'ZERO_RESULTS' : undefined,
      duration: durationStr(),
    });

    return NextResponse.json({
      success: true,
      products: finalProductsWithFreight,
      totalCount: Number(totalCount),
      pageIndex: pageNo,
      pageSize,
      rawResponse,
      debugInfo,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AliExpress Search ERROR] Caught exception:', msg, err);
    return NextResponse.json({ error: msg, debugInfo: { exception: msg } }, { status: 500 });
  }
}