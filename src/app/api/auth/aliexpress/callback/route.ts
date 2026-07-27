import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// AliExpress token exchange endpoint (GOP protocol — system API)
// System APIs use: https://api-sg.aliexpress.com/rest + API path
// Signing for GOP: prepend API path before sorted key+value pairs
const ALIEXPRESS_REST_URL = 'https://api-sg.aliexpress.com/rest';
const TOKEN_API_PATH = '/auth/token/create';

/**
 * Sign a request for the AliExpress REST (GOP) system endpoint.
 * GOP signing: apiPath + sorted(key+value) — HMAC-SHA256, UPPERCASE hex.
 * This is DIFFERENT from /sync business API signing (which has no prefix).
 */
async function signGopParams(
  params: Record<string, string>,
  appSecret: string,
  apiPath: string,
): Promise<string> {
  const sorted = Object.entries(params)
    .filter(([k]) => k !== 'sign')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join('');

  // GOP signing prepends the API path (e.g. /auth/token/create)
  const toSign = apiPath + sorted;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(toSign));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // contains user_id

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4028');

  if (!code) {
    return NextResponse.redirect(
      `${siteUrl}/api-connections?aliexpress_error=no_code`
    );
  }

  try {
    const supabase = await createClient();

    // Resolve user: prefer state param (user_id), fallback to session
    let userId: string | null = state || null;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.redirect(
        `${siteUrl}/api-connections?aliexpress_error=not_authenticated`
      );
    }

    // Fetch saved App Key and App Secret from Supabase
    const { data: credRow } = await supabase
      .from('api_credentials')
      .select('credentials')
      .eq('user_id', userId)
      .eq('service', 'aliexpress_ds')
      .single();

    const savedCreds = (credRow?.credentials as Record<string, string>) || {};
    const appKey = savedCreds['appKey'];
    const appSecret = savedCreds['appSecret'];

    if (!appKey || !appSecret) {
      return NextResponse.redirect(
        `${siteUrl}/api-connections?aliexpress_error=missing_credentials`
      );
    }

    // Build signed params for token exchange using GOP signing
    const timestamp = String(Date.now()); // 13-digit milliseconds
    const tokenParams: Record<string, string> = {
      app_key: appKey,
      timestamp,
      sign_method: 'sha256',
      code,
    };

    // GOP signing: prepend the API path before sorted params
    const sign = await signGopParams(tokenParams, appSecret, TOKEN_API_PATH);
    tokenParams.sign = sign;

    // POST to the REST endpoint with form-encoded body
    const formBody = new URLSearchParams(tokenParams).toString();
    const tokenRes = await fetch(`${ALIEXPRESS_REST_URL}${TOKEN_API_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formBody,
      signal: AbortSignal.timeout(15000),
    });

    const tokenJson = await tokenRes.json() as Record<string, unknown>;

    // AliExpress GOP response wraps the actual data in gopResponseBody (a JSON string)
    if (tokenJson?.success === false || (tokenJson?.gopErrorCode && tokenJson.gopErrorCode !== '0')) {
      const errMsg = encodeURIComponent(String(tokenJson?.gopErrorCode || 'Token exchange failed'));
      return NextResponse.redirect(`${siteUrl}/api-connections?aliexpress_error=${errMsg}`);
    }

    // Parse the nested gopResponseBody
    let parsedBody: Record<string, unknown> = {};
    if (typeof tokenJson?.gopResponseBody === 'string') {
      try {
        parsedBody = JSON.parse(tokenJson.gopResponseBody) as Record<string, unknown>;
      } catch {
        // fall through to check top-level
      }
    } else if (typeof tokenJson === 'object') {
      parsedBody = tokenJson;
    }

    // Check for error_response inside parsed body
    const errorResponse = parsedBody?.error_response as Record<string, unknown> | undefined;
    if (errorResponse) {
      const errMsg = encodeURIComponent(
        String(errorResponse.sub_msg || errorResponse.msg || 'Token exchange failed')
      );
      return NextResponse.redirect(`${siteUrl}/api-connections?aliexpress_error=${errMsg}`);
    }

    // Check for error code in parsed body (code !== "0" means error)
    if (parsedBody?.code && parsedBody.code !== '0') {
      const errMsg = encodeURIComponent(String(parsedBody.msg || parsedBody.code || 'Token exchange failed'));
      return NextResponse.redirect(`${siteUrl}/api-connections?aliexpress_error=${errMsg}`);
    }

    const accessToken = (parsedBody?.access_token || tokenJson?.access_token) as string | undefined;
    if (!accessToken) {
      return NextResponse.redirect(
        `${siteUrl}/api-connections?aliexpress_error=no_access_token`
      );
    }

    // Save the access token back into the aliexpress_ds credentials
    const updatedCreds = { ...savedCreds, accessToken };
    await supabase.from('api_credentials').upsert({
      user_id: userId,
      service: 'aliexpress_ds',
      credentials: updatedCreds,
      is_connected: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,service' });

    return NextResponse.redirect(
      `${siteUrl}/api-connections?aliexpress_token=success`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.redirect(
      `${siteUrl}/api-connections?aliexpress_error=${msg}`
    );
  }
}
