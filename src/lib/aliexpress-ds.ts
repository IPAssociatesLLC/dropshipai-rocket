/**
 * AliExpress Dropshipping API Utility
 * Official docs: https://openservice.aliexpress.com/doc/doc.htm#/?docId=1368
 *
 * Signing algorithm (for /sync endpoint):
 * 1. Collect ALL params (system + business), exclude "sign"
 * 2. Sort by key name in ASCII order
 * 3. Concatenate as key+value (no separator, no prefix)
 * 4. HMAC-SHA256 with appSecret as key, result in UPPERCASE hex
 *
 * Gateway: https://api-sg.aliexpress.com/sync
 * Timestamp: 13-digit Unix milliseconds
 * Token param: "access_token" (not "session")
 */

export interface AliDsCredentials {
  appKey: string;
  appSecret: string;
  accessToken?: string;
}

export interface AliDsApiParams {
  [key: string]: string | number | boolean | undefined;
}

export interface AliDsApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errorCode?: string | number;
  errorMsg?: string;
  rawResponse?: Record<string, unknown>;
}

// ─── Signing ────────────────────────────────────────────────────────────────

/**
 * Official IOP signing for /sync endpoint:
 * Sort all params (excluding 'sign') by key ASCII order,
 * concatenate key+value with NO separator and NO prefix,
 * HMAC-SHA256 with appSecret, output UPPERCASE hex.
 */
async function signParams(
  params: Record<string, string>,
  appSecret: string,
): Promise<string> {
  const sortedStr = Object.entries(params)
    .filter(([k]) => k !== 'sign')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join('');

  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const msgData = encoder.encode(sortedStr);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function buildBaseParams(
  method: string,
  creds: AliDsCredentials,
  extra: Record<string, string>,
): Record<string, string> {
  const base: Record<string, string> = {
    method,
    app_key: creds.appKey,
    // 13-digit Unix milliseconds timestamp
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    format: 'json',
    v: '2.0',
    ...extra,
  };
  // access_token is the correct param name (not "session")
  if (creds.accessToken) base.access_token = creds.accessToken;
  return base;
}

export async function callAliDsApi<T = unknown>(
  method: string,
  creds: AliDsCredentials,
  extraParams: Record<string, string> = {},
): Promise<AliDsApiResponse<T>> {
  const params = buildBaseParams(method, creds, extraParams);
  // Sign WITHOUT any prefix — just sorted key+value concatenation
  params.sign = await signParams(params, creds.appSecret);

  const body = new URLSearchParams(params).toString();

  console.log(`[callAliDsApi] Calling method: ${method}`);
  console.log(`[callAliDsApi] Gateway: https://api-sg.aliexpress.com/sync`);
  console.log(`[callAliDsApi] Params (excluding secret):`, Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'sign' && k !== 'app_key')
  ));

  let res: Response;
  try {
    res = await fetch('https://api-sg.aliexpress.com/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch (fetchErr) {
    console.error(`[callAliDsApi] Fetch failed:`, fetchErr);
    throw fetchErr;
  }

  console.log(`[callAliDsApi] HTTP status: ${res.status}`);

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch (parseErr) {
    console.error(`[callAliDsApi] Failed to parse JSON response:`, parseErr);
    throw new Error('AliExpress API returned non-JSON response');
  }

  console.log(`[callAliDsApi] Raw JSON response:`, JSON.stringify(json, null, 2));

  // Check for top-level error_response (hard API errors)
  const errorResponse = json?.error_response as Record<string, unknown> | undefined;
  if (errorResponse) {
    console.error(`[callAliDsApi] error_response:`, errorResponse);
    return {
      success: false,
      errorCode: errorResponse.code as string | number,
      errorMsg: (errorResponse.sub_msg || errorResponse.msg || 'Unknown error') as string,
      rawResponse: json,
    };
  }

  // Check for ISV/ISP error at top level — only when there is NO method response key present
  // (i.e. the API returned an error envelope instead of a real response)
  const responseKey = method.replace(/\./g, '_') + '_response';
  const hasResponseKey = responseKey in json;

  if (!hasResponseKey && json?.type && json?.code && json?.code !== '0' && json?.code !== 0) {
    console.error(`[callAliDsApi] Top-level error (no response key):`, json);
    return {
      success: false,
      errorCode: json.code as string | number,
      errorMsg: (json.message || json.msg || 'API error') as string,
      rawResponse: json,
    };
  }

  const data = (json[responseKey] ?? json) as T;
  console.log(`[callAliDsApi] Extracted data (key: ${responseKey}):`, JSON.stringify(data, null, 2));

  // Check inner response code — AliExpress wraps errors inside the response key too
  // e.g. { aliexpress_ds_text_search_response: { code: "EXCEPTION_TEXT_SEARCH_FOR_DS", ... } }
  const innerData = data as Record<string, unknown>;
  const innerCode = innerData?.code;
  // AliExpress uses "0" OR "00" as success codes — treat both as success
  const isSuccessCode = innerCode === undefined || innerCode === '0' || innerCode === 0 || innerCode === '00';
  if (!isSuccessCode) {
    const innerMsg = (innerData?.msg || innerData?.message || innerData?.rsp_msg || 'API error') as string;
    console.error(`[callAliDsApi] Inner error code: ${innerCode}, msg: ${innerMsg}`);
    return {
      success: false,
      errorCode: innerCode as string | number,
      errorMsg: innerMsg,
      rawResponse: json,
    };
  }

  return { success: true, data, rawResponse: json };
}

// ─── 1. Product Search (text search) ────────────────────────────────────────

export interface DsTextSearchParams {
  keyWord: string;
  local?: string;          // e.g. "en_US"
  countryCode?: string;    // e.g. "US"
  currency?: string;       // e.g. "USD"
  categoryId?: number;
  sortBy?: string;         // e.g. "orders,desc"
  pageSize?: number;
  pageIndex?: number;
  selectionName?: string;
}

export async function dsTextSearch(creds: AliDsCredentials, p: DsTextSearchParams) {
  const extra: Record<string, string> = {
    keyWord: p.keyWord,
    local: p.local ?? 'en_US',
    countryCode: p.countryCode ?? 'US',
    currency: p.currency ?? 'USD',
  };
  if (p.categoryId !== undefined) extra.categoryId = String(p.categoryId);
  if (p.sortBy) extra.sortBy = p.sortBy;
  if (p.pageSize !== undefined) extra.pageSize = String(p.pageSize);
  if (p.pageIndex !== undefined) extra.pageIndex = String(p.pageIndex);
  if (p.selectionName) extra.selectionName = p.selectionName;
  return callAliDsApi('aliexpress.ds.text.search', creds, extra);
}

// ─── 2. Product Detail ───────────────────────────────────────────────────────

export async function dsProductGet(
  creds: AliDsCredentials,
  productId: string,
  options: { ship_to_country?: string; target_currency?: string; target_language?: string } = {},
) {
  return callAliDsApi('aliexpress.ds.product.get', creds, {
    product_id: productId,
    ship_to_country: options.ship_to_country ?? 'US',
    target_currency: options.target_currency ?? 'USD',
    target_language: options.target_language ?? 'EN',
  });
}

// ─── 3. Wholesale Product Info ───────────────────────────────────────────────

export async function dsProductWholesaleGet(
  creds: AliDsCredentials,
  productId: string,
  options: { ship_to_country?: string; target_currency?: string; target_language?: string } = {},
) {
  return callAliDsApi('aliexpress.ds.product.wholesale.get', creds, {
    product_id: productId,
    ship_to_country: options.ship_to_country ?? 'US',
    target_currency: options.target_currency ?? 'USD',
    target_language: options.target_language ?? 'EN',
  });
}

// ─── 4. Product Special Info (certifications) ───────────────────────────────

export async function dsProductSpecialInfoGet(
  creds: AliDsCredentials,
  productId: string,
) {
  return callAliDsApi('aliexpress.ds.product.specialinfo.get', creds, {
    product_id: productId,
  });
}

// ─── 5. Category Tree ────────────────────────────────────────────────────────

export async function dsCategoryTreeGet(
  creds: AliDsCredentials,
  options: { parent_category_id?: string; language?: string } = {},
) {
  const extra: Record<string, string> = {};
  if (options.parent_category_id) extra.parent_category_id = options.parent_category_id;
  if (options.language) extra.language = options.language;
  return callAliDsApi('aliexpress.ds.category.tree.get', creds, extra);
}

// ─── 6. Category Get (ID + Name) ─────────────────────────────────────────────

export async function dsCategoryGet(
  creds: AliDsCredentials,
  options: { parent_category_id?: string; language?: string } = {},
) {
  const extra: Record<string, string> = {};
  if (options.parent_category_id) extra.parent_category_id = options.parent_category_id;
  if (options.language) extra.language = options.language;
  return callAliDsApi('aliexpress.ds.category.get', creds, extra);
}

// ─── 7. Freight Query (DS) ───────────────────────────────────────────────────

export interface DsFreightQueryParams {
  product_id: string;
  product_num: number;
  ship_to_country: string;
  send_goods_country_code?: string;
  price_currency?: string;
}

export async function dsFreightQuery(creds: AliDsCredentials, p: DsFreightQueryParams) {
  return callAliDsApi('aliexpress.ds.freight.query', creds, {
    product_id: p.product_id,
    product_num: String(p.product_num),
    ship_to_country: p.ship_to_country,
    send_goods_country_code: p.send_goods_country_code ?? 'CN',
    price_currency: p.price_currency ?? 'USD',
  });
}

// ─── 8. Freight Calculate (Buyer) ────────────────────────────────────────────

export interface FreightCalculateParams {
  product_id: string;
  product_num: number;
  country_code: string;
  province_code?: string;
  city_code?: string;
  send_goods_country_code?: string;
  price_currency?: string;
}

export async function freightCalculate(creds: AliDsCredentials, p: FreightCalculateParams) {
  const extra: Record<string, string> = {
    product_id: p.product_id,
    product_num: String(p.product_num),
    country_code: p.country_code,
    send_goods_country_code: p.send_goods_country_code ?? 'CN',
    price_currency: p.price_currency ?? 'USD',
  };
  if (p.province_code) extra.province_code = p.province_code;
  if (p.city_code) extra.city_code = p.city_code;
  return callAliDsApi('aliexpress.logistics.buyer.freight.calculate', creds, extra);
}

// ─── 9. Order Create ─────────────────────────────────────────────────────────

export interface DsOrderCreateParams {
  product_items: Array<{
    product_id: string;
    product_count: number;
    sku_attr?: string;
    logistics_service_name?: string;
  }>;
  logistics_address: {
    contact_person: string;
    address: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    mobile_no?: string;
    phone_country?: string;
  };
  out_order_id?: string;
}

export async function dsOrderCreate(creds: AliDsCredentials, p: DsOrderCreateParams) {
  return callAliDsApi('aliexpress.ds.order.create', creds, {
    param_place_order_request4_open_api_d_t_o: JSON.stringify({
      product_items: p.product_items,
      logistics_address: p.logistics_address,
      out_order_id: p.out_order_id ?? '',
    }),
  });
}

// ─── 10. Order After Pay ─────────────────────────────────────────────────────

export async function dsOrderAfterPay(creds: AliDsCredentials, orderId: string) {
  return callAliDsApi('aliexpress.ds.order.afterpay', creds, {
    order_id: orderId,
  });
}

// ─── 11. Order Tracking ──────────────────────────────────────────────────────

export async function dsOrderTrackingGet(creds: AliDsCredentials, orderId: string) {
  return callAliDsApi('aliexpress.ds.order.tracking.get', creds, {
    order_id: orderId,
  });
}

// ─── 12. Order Details (buyer query) ─────────────────────────────────────────

export async function tradeOrderGet(creds: AliDsCredentials, orderId: string) {
  return callAliDsApi('aliexpress.trade.ds.order.get', creds, {
    order_id: orderId,
  });
}

// ─── 13. Image Search ────────────────────────────────────────────────────────

export async function dsImageSearchV2(
  creds: AliDsCredentials,
  imageBase64: string,
  options: { page_no?: number; page_size?: number; target_currency?: string; target_language?: string } = {},
) {
  return callAliDsApi('aliexpress.ds.image.searchV2', creds, {
    image_file_bytes: imageBase64,
    page_no: String(options.page_no ?? 1),
    page_size: String(options.page_size ?? 20),
    target_currency: options.target_currency ?? 'USD',
    target_language: options.target_language ?? 'EN',
  });
}

// ─── 14. Feed Items ──────────────────────────────────────────────────────────
// NOTE: aliexpress.ds.feed.itemids.get paginates via a short-lived `search_id` cursor
// (not page numbers) — omit search_id on the first call, then pass back the search_id
// returned in the previous response to get the next page. category_id filters the feed
// down to a specific AliExpress category (omit for "All Categories").
export async function dsFeedItemIdsGet(
  creds: AliDsCredentials,
  feedName: string,
  options: { category_id?: string; page_size?: number; search_id?: string } = {},
) {
  const extra: Record<string, string> = {
    feed_name: feedName,
    page_size: String(options.page_size ?? 20),
  };
  if (options.category_id) extra.category_id = String(options.category_id);
  if (options.search_id) extra.search_id = options.search_id;
  return callAliDsApi('aliexpress.ds.feed.itemids.get', creds, extra);
}

/**
 * Run async tasks with a max concurrency limit instead of firing them all at once
 * (aliexpress.ds.product.get is subject to AliExpress's per-method QPS limits, so
 * fanning out 20-60 parallel calls per browse risks throttling).
 */
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    results[index] = await worker(items[index]);
    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

// ─── 15. Member Benefit ──────────────────────────────────────────────────────

export async function dsMemberBenefitGet(creds: AliDsCredentials) {
  return callAliDsApi('aliexpress.ds.member.benefit.get', creds, {});
}

// ─── 16. Search Event Report ─────────────────────────────────────────────────

export async function dsSearchEventReport(
  creds: AliDsCredentials,
  params: { search_id: string; click_item_id?: string; event_type?: string },
) {
  const extra: Record<string, string> = { search_id: params.search_id };
  if (params.click_item_id) extra.click_item_id = params.click_item_id;
  if (params.event_type) extra.event_type = params.event_type;
  return callAliDsApi('aliexpress.ds.search.event.report', creds, extra);
}

// ─── 17. Feed Name Get ───────────────────────────────────────────────────────

export async function dsFeedNameGet(creds: AliDsCredentials) {
  return callAliDsApi('aliexpress.ds.feedname.get', creds, {});
}
