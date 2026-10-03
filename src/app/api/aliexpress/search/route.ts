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
    const { mode = 'search', keywords, categoryId, minPrice, maxPrice, pageNo = 1, pageSize = 20, sortBy, searchId } = body;
    LOG('Search request:', { mode, keywords, categoryId, minPrice, maxPrice, pageNo, pageSize, sortBy, hasSearchId: !!searchId });

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

    const allNormalized: any[] = [];
    let totalCount = 0;
    let rawResponse = null;
    let debugInfo = {};
    let errorCode = null;
    let errorMsg = null;
    const sortByKey = sortBy ?? 'orders,desc';
    const minP = (minPrice !== undefined && minPrice !== '') ? parseFloat(String(minPrice)) : null;
    const maxP = (maxPrice !== undefined && maxPrice !== '') ? parseFloat(String(maxPrice)) : null;

    if (mode === 'browse') {
      // BROWSE MODE: Use feed API with hot-search feed per user request
      LOG(`[Browse Mode] Fetching hot-search feed items for category ${categoryId || 'ALL'}`);
      
      const feedResult = await dsFeedItemIdsGet(searchCreds, 'hot-search', {
        category_id: categoryId,
        page_size: pageSize,
        search_id: undefined,
      });

      if (!feedResult.success) {
        errorCode = feedResult.errorCode;
        errorMsg = feedResult.errorMsg;
        rawResponse = feedResult.rawResponse;
      } else {
        rawResponse = feedResult.rawResponse;
        debugInfo = { endpoint: 'aliexpress.ds.feed.itemids.get', searchId: (feedResult.data as any)?.search_id, feedName: 'hot-search' };
        
        const feedData = feedResult.data as any;
        const productsList = feedData?.products || [];
        totalCount = parseInt(String(feedData?.total ?? productsList.length));
        
        // Feed returns array of objects with item_id, need to fetch details
        const idsToFetch = productsList.map((p: any) => p.item_id).filter(Boolean);
        LOG(`[Browse Mode] Found ${idsToFetch.length} items in hot-search feed. Fetching details...`);
        
        // Fetch details concurrently with limit 5 to avoid rate limits
        const detailedProducts = await runWithConcurrencyLimit(idsToFetch, 5, async (id: string) => {
          try {
             const [pRes, fRes] = await Promise.all([
               dsProductGet(searchCreds, id, { target_currency: 'USD', ship_to_country: 'US' }),
               freightCalculate(searchCreds, { product_id: id, product_num: 1, country_code: 'US', price_currency: 'USD' }).catch(() => ({ success: false, data: null }))
             ]);
             
             let shippingFee = '0';
             if (fRes && fRes.success) {
               const opts = (fRes.data as any)?.delivery_options;
               if (opts && opts.length > 0) {
                 shippingFee = String(opts[0].shipping_fee_cent || '0');
               }
             }
             
             if (pRes.success) return { detail: pRes.data, shippingFee };
          } catch(e) {}
          return null;
        });

        for (const item of detailedProducts) {
          if (!item || !item.detail) continue;
          const { detail, shippingFee } = item;
          // Product detail has slightly different structure, normalize it
          const actualDetail = (detail as any)?.result || detail;
          const baseInfo = actualDetail?.ae_item_base_info_dto || actualDetail;
          
          // Handle nested arrays from AliExpress API (sometimes wrapped in the plural key)
          let skuInfoList = actualDetail?.ae_item_sku_info_dtos;
          if (skuInfoList && !Array.isArray(skuInfoList) && skuInfoList.ae_item_sku_info_dto) {
            skuInfoList = skuInfoList.ae_item_sku_info_dto;
          }
          if (!Array.isArray(skuInfoList)) skuInfoList = [];
          
          const defaultSku = skuInfoList[0] || {};
          
          const mappedProd = {
            product_id: baseInfo.product_id,
            product_title: baseInfo.subject,
            product_main_image_url: (actualDetail?.ae_multimedia_info_dto?.image_urls?.split(';')?.[0]) || '',
            target_sale_price: defaultSku.offer_sale_price || '0',
            target_original_price: defaultSku.sku_price || '0',
            discount: defaultSku.wholesale_price_tiers?.[0]?.discount || '0%',
            evaluate_rate: baseInfo.avg_evaluation_rating || '0',
            lastest_volume: baseInfo.sales_count?.replace(/[^0-9]/g, '') || 0,
            category_id: baseInfo.category_id || categoryId,
            itemUrl: `//www.aliexpress.com/item/${baseInfo.product_id}.html`,
            freightAmount: shippingFee
          };
          
          const norm = normalizeProduct(mappedProd, categoryId);
          const price = parseFloat(norm.targetSalePrice) || 0;
          if (minP !== null && price < minP) continue;
          if (maxP !== null && price > maxP) continue;
          allNormalized.push(norm);
        }
      }


    } else {
      // SEARCH MODE: Use text.search API
      const searchKeyword = keywords || '';
      const extraParams: Record<string, string> = {
        local: 'en_US',
        countryCode: 'US',
        currency: 'USD',
        pageSize: String(pageSize),
        pageIndex: String(pageNo),
      };
      
      if (searchKeyword) extraParams.keyWord = searchKeyword;
      if (hasCategoryId) extraParams.categoryId = String(categoryId);
      
      const aliSortBy = TEXT_SORT_MAP[sortByKey] ?? sortByKey;
      if (aliSortBy) extraParams.sortBy = aliSortBy;

      LOG(`Calling aliexpress.ds.text.search with params:`, extraParams);
      const result = await callAliDsApi('aliexpress.ds.text.search', searchCreds, extraParams);
      
      if (!result.success) {
        errorCode = result.errorCode;
        errorMsg = result.errorMsg;
        rawResponse = result.rawResponse;
      } else {
        rawResponse = result.rawResponse;
        debugInfo = { endpoint: 'aliexpress.ds.text.search' };
        
        const innerData = result.data as any;
        const searchData = innerData?.['data'];
        
        // Handle both search_product and selection_search_product
        const productsWrapper = searchData?.products;
        let rawProducts: any[] = [];
        if (Array.isArray(productsWrapper)) {
          rawProducts = productsWrapper;
        } else if (productsWrapper?.search_product) {
          rawProducts = productsWrapper.search_product;
        } else if (productsWrapper?.selection_search_product) {
          rawProducts = productsWrapper.selection_search_product;
        }
        
        totalCount = searchData?.totalCount ?? rawProducts.length;

        // Fetch rich details and freight for the text search results
        const idsToFetch = rawProducts.map((p: any) => p.product_id || p.itemId).filter(Boolean);
        LOG(`[Search Mode] Found ${idsToFetch.length} items. Fetching rich details...`);
        
        const detailedProducts = await runWithConcurrencyLimit(idsToFetch, 5, async (id: string) => {
          try {
             const [pRes, fRes] = await Promise.all([
               dsProductGet(searchCreds, id, { target_currency: 'USD', ship_to_country: 'US' }),
               freightCalculate(searchCreds, { product_id: id, product_num: 1, country_code: 'US', price_currency: 'USD' }).catch(() => ({ success: false, data: null }))
             ]);
             
             let shippingFee = '0';
             if (fRes && fRes.success) {
               const opts = (fRes.data as any)?.delivery_options;
               if (opts && opts.length > 0) {
                 shippingFee = String(opts[0].shipping_fee_cent || '0');
               }
             }
             
             if (pRes.success) return { detail: pRes.data, shippingFee };
          } catch(e) {}
          return null;
        });

        for (const item of detailedProducts) {
          if (!item || !item.detail) continue;
          const { detail, shippingFee } = item;
          const actualDetail = (detail as any)?.result || detail;
          const baseInfo = actualDetail?.ae_item_base_info_dto || actualDetail;
          
          let skuInfoList = actualDetail?.ae_item_sku_info_dtos;
          if (skuInfoList && !Array.isArray(skuInfoList) && skuInfoList.ae_item_sku_info_dto) {
            skuInfoList = skuInfoList.ae_item_sku_info_dto;
          }
          if (!Array.isArray(skuInfoList)) skuInfoList = [];
          
          const defaultSku = skuInfoList[0] || {};
          
          const mappedProd = {
            product_id: baseInfo.product_id,
            product_title: baseInfo.subject,
            product_main_image_url: (actualDetail?.ae_multimedia_info_dto?.image_urls?.split(';')?.[0]) || '',
            target_sale_price: defaultSku.offer_sale_price || '0',
            target_original_price: defaultSku.sku_price || '0',
            discount: defaultSku.wholesale_price_tiers?.[0]?.discount || '0%',
            evaluate_rate: baseInfo.avg_evaluation_rating || '0',
            lastest_volume: baseInfo.sales_count?.replace(/[^0-9]/g, '') || 0,
            category_id: baseInfo.category_id || categoryId,
            itemUrl: `//www.aliexpress.com/item/${baseInfo.product_id}.html`,
            freightAmount: shippingFee
          };
          
          const norm = normalizeProduct(mappedProd, categoryId);
          const price = parseFloat(norm.targetSalePrice) || 0;
          if (minP !== null && price < minP) continue;
          if (maxP !== null && price > maxP) continue;
          allNormalized.push(norm);
        }
      }
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

    const searchLabel = hasKeywords
      ? `"${keywords.trim()}"${hasCategoryId ? ` in category ${categoryId}` : ''}`
      : `Browse category ${categoryId ?? '(all)'}`;

    const logStatus = finalProducts.length > 0 ? 'completed' : 'failed';
    const logMessage = finalProducts.length > 0
      ? `Search completed: ${finalProducts.length} products for ${searchLabel}`
      : `Search returned 0 products for ${searchLabel} — no matching results from AliExpress`;

    await writeActivityLog(supabase, user.id, {
      type: 'scan',
      status: logStatus,
      title: 'AliExpress Product Discovery',
      message: logMessage,
      detail: `Keywords: ${keywords?.trim() || '(none)'} | Category: ${hasCategoryId ? categoryId : '(all)'} | Sort: ${sortBy || 'relevance'} | Price: ${minPrice || '*'}-${maxPrice || '*'} | Returned: ${finalProducts.length}`,
      source: 'AliExpress DS API',
      products_count: finalProducts.length,
      error_code: finalProducts.length === 0 ? 'ZERO_RESULTS' : undefined,
      duration: durationStr(),
    });

    return NextResponse.json({
      success: true,
      products: finalProducts,
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