import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAliDsApi, dsFeedNameGet, dsFeedItemIdsGet, dsProductGet, runWithConcurrencyLimit } from '@/lib/aliexpress-ds';
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
    LOG('Credential row found:', !!credRow);

    const creds = (credRow?.credentials as Record<string, string>) || {};
    LOG('Has appKey:', !!creds.appKey, '| Has appSecret:', !!creds.appSecret, '| Has accessToken:', !!creds.accessToken);

    if (!creds.appKey || !creds.appSecret) {
      ERR('Missing appKey or appSecret');
      return NextResponse.json({ error: 'AliExpress DS API credentials not configured. Please add them in API Connections.' }, { status: 400 });
    }

    const searchCreds = { appKey: creds.appKey, appSecret: creds.appSecret, ...(creds.accessToken ? { accessToken: creds.accessToken } : {}) };

    const durationMs = () => Date.now() - startTime;
    const durationStr = () => {
      const ms = durationMs();
      return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    };

    // Helper: run text.search and return normalized products + meta
    async function runTextSearch(kw: string, catId?: string, page = 1): Promise<{
      products: unknown[];
      totalCount: number | string;
      rawResponse: unknown;
      debugInfo: Record<string, unknown>;
      errorCode?: string | number;
      errorMsg?: string;
    }> {
      const extraParams: Record<string, string> = {
        local: 'en_US',
        countryCode: 'US',
        currency: 'USD',
        pageSize: String(Math.min(pageSize, 50)),
        pageIndex: String(page),
        keyWord: kw.trim(),
      };
      if (catId) extraParams.categoryId = String(catId);
      const sortByKey = sortBy ?? 'orders,desc';
      const aliSortBy = TEXT_SORT_MAP[sortByKey] ?? sortByKey;
      if (aliSortBy) extraParams.sortBy = aliSortBy;
      if (minPrice !== undefined && minPrice !== '' && minPrice !== null) extraParams.priceFrom = String(minPrice);
      if (maxPrice !== undefined && maxPrice !== '' && maxPrice !== null) extraParams.priceTo = String(maxPrice);

      LOG('Calling aliexpress.ds.text.search with params:', extraParams);
      const result = await callAliDsApi('aliexpress.ds.text.search', searchCreds, extraParams);
      LOG('text.search result.success:', result.success, 'errorCode:', result.errorCode);

      if (!result.success) {
        return {
          products: [],
          totalCount: 0,
          rawResponse: result.rawResponse,
          debugInfo: { errorCode: result.errorCode, errorMsg: result.errorMsg, endpoint: 'aliexpress.ds.text.search' },
          errorCode: result.errorCode,
          errorMsg: result.errorMsg,
        };
      }

      const innerData = result.data as Record<string, unknown> | undefined;
      const searchData = innerData?.['data'] as Record<string, unknown> | undefined;
      const productsWrapper = searchData?.products as Record<string, unknown> | undefined;
      let rawProducts: unknown[] = (
        (Array.isArray(productsWrapper) ? productsWrapper : null) ??
        (productsWrapper?.selection_search_product as unknown[]) ??
        []
      );
      let totalCount = searchData?.totalCount ?? rawProducts.length;

      // Normalize text search products to match feed product shape
      const normalized = rawProducts.map((p: unknown) => {
        const prod = p as Record<string, unknown>;
        return {
          itemId: String(prod.itemId ?? prod.product_id ?? ''),
          title: prod.title ?? prod.product_title ?? '',
          itemMainPic: prod.itemMainPic ?? prod.product_main_image_url ?? '',
          salePrice: prod.targetSalePrice ?? prod.salePrice ?? '0',
          originalPrice: prod.targetOriginalPrice ?? prod.originalPrice ?? '0',
          targetSalePrice: prod.targetSalePrice ?? prod.salePrice ?? '0',
          targetOriginalPrice: prod.targetOriginalPrice ?? prod.originalPrice ?? '0',
          targetOriginalPriceCurrency: prod.targetOriginalPriceCurrency ?? prod.salePriceCurrency ?? 'USD',
          salePriceCurrency: prod.salePriceCurrency ?? 'USD',
          discount: prod.discount ?? '0%',
          evaluateRate: prod.evaluateRate ?? '0',
          orders: String(prod.orders ?? prod.lastest_volume ?? 0),
          cateId: String(prod.cateId ?? catId ?? ''),
          itemUrl: prod.itemUrl ?? `//www.aliexpress.com/item/${prod.itemId ?? prod.product_id}.html`,
          freightAmount: String(prod.freightAmount ?? '0'),
          skuNumber: prod.skuNumber as string | undefined,
        };
      });

      return {
        products: normalized,
        totalCount,
        rawResponse: result.rawResponse,
        debugInfo: {
          productsCount: normalized.length,
          rawProductsCount: rawProducts.length,
          endpoint: 'aliexpress.ds.text.search',
          innerDataKeys: innerData ? Object.keys(innerData) : [],
          searchDataKeys: searchData ? Object.keys(searchData) : [],
        },
      };
    }

    // ── BRANCH: no keywords → browse via the DS feed (category-filtered, or global bestsellers
    // if no category is selected), falling back to text.search only if the feed comes back empty ──
    if (!hasKeywords) {
      LOG(hasCategoryId ? `Category browse (category ${categoryId}) → feed flow` : 'Global bestseller browse (no category) → feed flow');

      let usedFeed = false;
      let rawProducts: unknown[] = [];
      let products: unknown[] = [];
      let totalCount: number | string = 0;
      let totalPageNo: number = 1;
      let nextSearchId: string | undefined;
      let feedDebugInfo: Record<string, unknown> = {};
      let feedRawResponse: unknown = null;

      // Step 1 — Get available feed names.
      // Response shape (confirmed from AliExpress docs):
      // { aliexpress_ds_feedname_get_response: { resp_result: { result: { promos: { promo: [{promo_name, promo_desc, product_num}] } } } } }
      const feedNamesResult = await dsFeedNameGet(searchCreds);
      const feedRespResult = feedNamesResult?.data as Record<string, unknown> | undefined;
      const feedInnerResult = (feedRespResult?.resp_result as Record<string, unknown> | undefined)?.result as Record<string, unknown> | undefined;
      const promosField = feedInnerResult?.promos as Record<string, unknown> | unknown[] | undefined;
      const promoList: Array<{ promo_name?: string; promo_desc?: string; product_num?: number }> = Array.isArray(promosField)
        ? (promosField as Array<{ promo_name?: string; promo_desc?: string; product_num?: number }>)
        : (Array.isArray((promosField as Record<string, unknown>)?.promo) ? ((promosField as Record<string, unknown>).promo as Array<{ promo_name?: string; promo_desc?: string; product_num?: number }>) : []);

      // Pick a feed: prefer one whose name/desc mentions the selected category, else the largest general pool.
      const categoryLbl = hasCategoryId ? categoryLabel(categoryId) : undefined;
      let chosenFeed: string | undefined;
      if (categoryLbl && promoList.length > 0) {
        const keywords_ = categoryLbl.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
        const match = promoList.find((p) => {
          const text = `${p.promo_name ?? ''} ${p.promo_desc ?? ''}`.toLowerCase();
          return keywords_.some((w) => text.includes(w));
        });
        chosenFeed = match?.promo_name;
      }
      if (!chosenFeed && promoList.length > 0) {
        chosenFeed = [...promoList].sort((a, b) => (b.product_num ?? 0) - (a.product_num ?? 0))[0]?.promo_name;
      }

      LOG('Feed promos available:', promoList.length, '| Chosen feed:', chosenFeed);

      if (!chosenFeed) {
        LOG('No feed names returned — falling back to text.search');
        usedFeed = false;
        feedDebugInfo = {
          feedNamesRawResponse: feedNamesResult?.rawResponse,
          promoCount: promoList.length,
          promoSample: promoList.slice(0, 5),
          chosenFeed: null,
          endpoint: 'aliexpress.ds.feedname.get',
        };
        feedRawResponse = feedNamesResult?.rawResponse;
      } else {
        // Step 2 — Get item IDs from the chosen feed.
        // Response shape: { aliexpress_ds_feed_itemids_get_response: { result: { total, products: { number: [...] }, search_id } } }
        const itemIdsResult = await dsFeedItemIdsGet(searchCreds, chosenFeed, {
          category_id: hasCategoryId ? String(categoryId) : undefined,
          page_size: Math.min(Math.max(pageSize, 1), 200),
          search_id: typeof searchId === 'string' && searchId ? searchId : undefined,
        });
        feedRawResponse = itemIdsResult?.rawResponse;

        const itemIdsData = itemIdsResult?.data as Record<string, unknown> | undefined;
        const feedResultObj = itemIdsData?.result as Record<string, unknown> | undefined;
        const productsField2 = feedResultObj?.products as Record<string, unknown> | unknown[] | undefined;
        const itemIds: Array<number | string> = Array.isArray(productsField2)
          ? (productsField2 as Array<number | string>)
          : (Array.isArray((productsField2 as Record<string, unknown>)?.number) ? ((productsField2 as Record<string, unknown>).number as Array<number | string>) : []);
        nextSearchId = feedResultObj?.search_id as string | undefined;
        const feedTotal = feedResultObj?.total as number | undefined;

        LOG('Feed item IDs count:', itemIds.length, 'from feed:', chosenFeed, '| total:', feedTotal, '| nextSearchId present:', !!nextSearchId);

        if (itemIds.length === 0) {
          LOG('Feed returned 0 item IDs — falling back to text.search');
          usedFeed = false;
          feedDebugInfo = { chosenFeed, itemIdsRawResponse: itemIdsResult?.rawResponse, itemIds, feedTotal };
        } else {
          // Step 3 — Fetch product details for each item ID with limited concurrency
          // (aliexpress.ds.product.get is subject to AliExpress's per-method QPS limit).
          const productResults = await runWithConcurrencyLimit(itemIds, 5, (id) =>
            dsProductGet(searchCreds, String(id), { ship_to_country: 'US', target_currency: 'USD', target_language: 'en' })
          );
          rawProducts = productResults
            .filter((r) => r?.success && (r.data as Record<string, unknown>)?.result)
            .map((r) => (r.data as Record<string, unknown>).result as Record<string, unknown>);

          usedFeed = rawProducts.length > 0;
          LOG('Feed products fetched:', rawProducts.length, '| usedFeed:', usedFeed);

          feedDebugInfo = {
            chosenFeed,
            itemIdsCount: itemIds.length,
            productsCount: rawProducts.length,
            feedTotal,
            nextSearchId: nextSearchId ?? null,
            endpoint: 'dsFeedNameGet + dsFeedItemIdsGet + dsProductGet',
          };

          if (usedFeed) {
            totalCount = feedTotal ?? rawProducts.length;
            totalPageNo = 1; // Feed pagination is cursor-based (search_id), not page-number based
            // Normalize aliexpress.ds.product.get's real response shape into the same product
            // card shape the UI already renders (itemId/title/itemMainPic/salePrice/etc.)
            products = rawProducts.map((prod) => {
              const base = (prod.ae_item_base_info_dto ?? {}) as Record<string, unknown>;
              const media = (prod.ae_multimedia_info_dto ?? {}) as Record<string, unknown>;
              const skus = (prod.ae_item_sku_info_dtos ?? []) as Array<Record<string, unknown>>;
              // image_urls comes back as a single semicolon-delimited string, not an array
              const images = String(media.image_urls ?? '').split(';').map((s) => s.trim()).filter(Boolean);
              // Price lives per-SKU, not on the product root — use the cheapest SKU as the display price
              const cheapestSku = skus.reduce<Record<string, unknown> | null>((min, sku) => {
                const price = parseFloat(String(sku.offer_sale_price ?? sku.sku_price ?? 'Infinity'));
                const minPrice = min ? parseFloat(String(min.offer_sale_price ?? min.sku_price ?? 'Infinity')) : Infinity;
                return price < minPrice ? sku : min;
              }, skus[0] ?? null);
              const salePriceVal = String(cheapestSku?.offer_sale_price ?? cheapestSku?.sku_price ?? '0');
              const originalPriceVal = String(cheapestSku?.sku_price ?? salePriceVal);
              const currency = String((cheapestSku?.currency_code as string) ?? base.currency_code ?? 'USD');
              const productId = String(base.product_id ?? '');
              const skuIds = skus.map((s) => s.sku_id).filter(Boolean) as string[];
              return {
                itemId: productId,
                title: String(base.subject ?? ''),
                itemMainPic: images[0] ?? '',
                salePrice: salePriceVal,
                originalPrice: originalPriceVal,
                targetSalePrice: salePriceVal,
                targetOriginalPrice: originalPriceVal,
                targetOriginalPriceCurrency: currency,
                salePriceCurrency: currency,
                discount: '0%',
                evaluateRate: String(base.avg_evaluation_rating ?? '0'),
                // sales_count comes back as a string like "1000+" — kept as-is, parsed on the frontend
                orders: String(base.sales_count ?? '0'),
                cateId: String(base.category_id ?? categoryId ?? ''),
                itemUrl: productId ? `//www.aliexpress.com/item/${productId}.html` : '',
                freightAmount: '0',
                skuNumber: skuIds.length > 1 ? skuIds.join(',') : skuIds[0],
              };
            });
          } else {
            LOG('All product detail fetches returned empty — falling back to text.search');
          }
        }
      }

      // ── FALLBACK: feed flow returned 0 or failed → use text.search with the category's name as keyword ──
      if (!usedFeed) {
        const fallbackKeyword = categoryLbl ?? 'best sellers trending';
        LOG(`Fallback text.search with keyword: "${fallbackKeyword}", categoryId: ${categoryId ?? '(none)'}`);

        const textResult = await runTextSearch(fallbackKeyword, hasCategoryId ? String(categoryId) : undefined, pageNo);

        if (textResult.errorCode) {
          ERR('Fallback text.search also failed:', textResult.errorCode, textResult.errorMsg);
          const errMsgLower = String(textResult.errorMsg ?? '').toLowerCase();
          const isPermissionError = /permission|no.?privilege|not.?subscri|unauthorized/.test(errMsgLower);
          await writeActivityLog(supabase, user.id, {
            type: 'api',
            status: 'failed',
            title: 'AliExpress Category Browse',
            message: `Browse failed: feed returned 0 products, fallback text search also failed (${textResult.errorCode})`,
            detail: `Feed debug: ${JSON.stringify(feedDebugInfo)} | Text search error: ${textResult.errorMsg} | Category: ${categoryId ?? '(none)'}`,
            source: 'AliExpress DS API',
            products_count: 0,
            error_code: String(textResult.errorCode ?? ''),
            duration: durationStr(),
          });
          return NextResponse.json({
            error: isPermissionError
              ? `AliExpress DS Feed permission not enabled (${textResult.errorCode}). Enable "aliexpress.ds.feed.itemids.get" / "aliexpress.ds.feedname.get" in your AliExpress Open Platform app console and re-authorize in API Connections.`
              : `AliExpress API error (${textResult.errorCode}): ${textResult.errorMsg}`,
            code: textResult.errorCode,
            rawResponse: textResult.rawResponse,
            debugInfo: { ...feedDebugInfo, ...textResult.debugInfo, fallbackKeyword },
          }, { status: 400 });
        }

        products = textResult.products;
        totalCount = textResult.totalCount;
        totalPageNo = Math.ceil(Number(totalCount) / pageSize) || 1;
        feedRawResponse = textResult.rawResponse;
        feedDebugInfo = { ...feedDebugInfo, ...textResult.debugInfo, fallbackKeyword, usedFallback: true };
        LOG(`Fallback text.search returned ${products.length} products`);
      }

      // Apply price filter
      let filtered = [...products];
      const minP = (minPrice !== undefined && minPrice !== '') ? parseFloat(String(minPrice)) : null;
      const maxP = (maxPrice !== undefined && maxPrice !== '') ? parseFloat(String(maxPrice)) : null;
      if (minP !== null || maxP !== null) {
        filtered = filtered.filter((p: unknown) => {
          const prod = p as Record<string, unknown>;
          const price = parseFloat(String(prod.targetSalePrice ?? prod.salePrice ?? '0')) || 0;
          if (minP !== null && price < minP) return false;
          if (maxP !== null && price > maxP) return false;
          return true;
        });
      }

      const logStatus = filtered.length > 0 ? 'completed' : 'failed';
      const categoryLabelForLog = categoryId ?? '(all categories)';
      const logMessage = filtered.length > 0
        ? `Browse (${categoryLabelForLog}): ${filtered.length} products${(feedDebugInfo as Record<string,unknown>).usedFallback ? ' (via text search fallback)' : ' (via DS feed)'}`
        : `Browse (${categoryLabelForLog}) returned 0 products — feed flow returned empty, fallback also returned 0`;

      await writeActivityLog(supabase, user.id, {
        type: 'scan',
        status: logStatus,
        title: 'AliExpress Category Browse',
        message: logMessage,
        detail: `Category: ${categoryLabelForLog} | Page size: ${pageSize} | Total available: ${totalCount} | Used feed: ${usedFeed} | Used fallback: ${!!(feedDebugInfo as Record<string,unknown>).usedFallback}`,
        source: 'AliExpress DS API',
        products_count: filtered.length,
        error_code: filtered.length === 0 ? 'ZERO_RESULTS' : undefined,
        duration: durationStr(),
      });

      return NextResponse.json({
        success: true,
        products: filtered,
        totalCount: Number(totalCount),
        totalPages: Number(totalPageNo),
        pageIndex: pageNo,
        pageSize,
        // Cursor for the next page when browsing via the feed (null once exhausted, or when the
        // text.search fallback was used since that path pages via pageIndex instead)
        searchId: usedFeed ? (nextSearchId ?? null) : null,
        rawResponse: feedRawResponse,
        debugInfo: {
          ...feedDebugInfo,
          productsCount: filtered.length,
          rawProductsCount: products.length,
          usedFeed,
        },
      });
    }

    // ── BRANCH: keyword search (with optional category filter) → text search API ──
    LOG('Keyword search → using aliexpress.ds.text.search');

    const extraParams: Record<string, string> = {
      local: 'en_US',
      countryCode: 'US',
      currency: 'USD',
      pageSize: String(pageSize),
      pageIndex: String(pageNo),
      keyWord: keywords.trim(),
    };

    if (hasCategoryId) extraParams.categoryId = String(categoryId);

    const sortByKey = sortBy ?? 'orders,desc';
    const aliSortBy = TEXT_SORT_MAP[sortByKey] ?? sortByKey;
    if (aliSortBy) extraParams.sortBy = aliSortBy;

    if (minPrice !== undefined && minPrice !== '' && minPrice !== null) extraParams.priceFrom = String(minPrice);
    if (maxPrice !== undefined && maxPrice !== '' && maxPrice !== null) extraParams.priceTo = String(maxPrice);

    LOG('Calling aliexpress.ds.text.search with params:', extraParams);
    const result = await callAliDsApi('aliexpress.ds.text.search', searchCreds, extraParams);
    LOG('result.success:', result.success, 'result.errorCode:', result.errorCode);

    if (!result.success) {
      ERR('API call failed:', result.errorCode, result.errorMsg);
      await writeActivityLog(supabase, user.id, {
        type: 'api',
        status: 'failed',
        title: 'AliExpress Product Search',
        message: `Search failed: ${result.errorCode ?? 'Unknown error'}`,
        detail: result.errorMsg ?? 'API returned an error',
        source: 'AliExpress DS API',
        products_count: 0,
        error_code: String(result.errorCode ?? ''),
        duration: durationStr(),
      });
      return NextResponse.json({
        error: `AliExpress API error (${result.errorCode}): ${result.errorMsg}`,
        code: result.errorCode,
        rawResponse: result.rawResponse,
        debugInfo: { errorCode: result.errorCode, errorMsg: result.errorMsg, rawResponse: result.rawResponse },
      }, { status: 400 });
    }

    const innerData = result.data as Record<string, unknown> | undefined;
    const searchData = innerData?.['data'] as Record<string, unknown> | undefined;
    const productsWrapper = searchData?.products as Record<string, unknown> | undefined;
    let rawProducts = (
      (Array.isArray(productsWrapper) ? productsWrapper : null) ??
      (productsWrapper?.selection_search_product as unknown[]) ??
      []
    );
    let totalCount = searchData?.totalCount ?? '0';

    LOG('Products found:', Array.isArray(rawProducts) ? rawProducts.length : 'not array');

    let products = Array.isArray(rawProducts) ? [...rawProducts] : [];
    const minP = (minPrice !== undefined && minPrice !== '') ? parseFloat(String(minPrice)) : null;
    const maxP = (maxPrice !== undefined && maxPrice !== '') ? parseFloat(String(maxPrice)) : null;
    if (products.length > 0 && (minP !== null || maxP !== null)) {
      products = products.filter((p: unknown) => {
        const prod = p as Record<string, unknown>;
        const price = parseFloat(String(prod.targetSalePrice ?? prod.salePrice ?? '0')) || 0;
        if (minP !== null && price < minP) return false;
        if (maxP !== null && price > maxP) return false;
        return true;
      });
    }

    const searchLabel = `"${keywords.trim()}"${hasCategoryId ? ` in category ${categoryId}` : ''}`;

    // Log as 'failed' if 0 products returned, 'completed' if products found
    const logStatus = products.length > 0 ? 'completed' : 'failed';
    const logMessage = products.length > 0
      ? `Search completed: ${products.length} products for ${searchLabel}`
      : `Search returned 0 products for ${searchLabel} — no matching results from AliExpress`;

    await writeActivityLog(supabase, user.id, {
      type: 'scan',
      status: logStatus,
      title: 'AliExpress Product Search',
      message: logMessage,
      detail: `Keywords: ${keywords.trim()} | Category: ${hasCategoryId ? categoryId : '(all)'} | Sort: ${aliSortBy || 'relevance'} | Page: ${pageNo}/${pageSize} | Total available: ${totalCount} | Returned: ${products.length}`,
      source: 'AliExpress DS API',
      products_count: products.length,
      error_code: products.length === 0 ? 'ZERO_RESULTS' : undefined,
      duration: durationStr(),
    });

    return NextResponse.json({
      success: true,
      products,
      totalCount,
      pageIndex: pageNo,
      pageSize,
      data: result.data,
      rawResponse: result.rawResponse,
      debugInfo: {
        productsCount: products.length,
        rawProductsCount: rawProducts.length,
        endpoint: 'aliexpress.ds.text.search',
        priceFilterApplied: !!(minP !== null || maxP !== null),
        innerDataKeys: innerData ? Object.keys(innerData) : [],
        searchDataKeys: searchData ? Object.keys(searchData) : [],
        rawResponse: result.rawResponse,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AliExpress Search ERROR] Caught exception:', msg, err);
    return NextResponse.json({ error: msg, debugInfo: { exception: msg } }, { status: 500 });
  }
}
