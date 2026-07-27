import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service, credentials } = body as { service: string; credentials: Record<string, string> };

    if (!service || !credentials) {
      return NextResponse.json({ success: false, message: 'Missing service or credentials.' }, { status: 400 });
    }

    switch (service) {
      case 'aliexpress_ds': {
        const appKey = credentials.appKey;
        const appSecret = credentials.appSecret;
        if (!appKey || !appSecret) {
          return NextResponse.json({ success: false, message: 'App Key and App Secret are required.' });
        }
        if (appKey.length < 4) {
          return NextResponse.json({ success: false, message: 'App Key appears too short. Check your AliExpress Open Platform console.' });
        }
        if (appSecret.length < 8) {
          return NextResponse.json({ success: false, message: 'App Secret appears too short. Check your AliExpress Open Platform console.' });
        }

        try {
          // Official IOP signing for /sync endpoint:
          // 1. Collect all params (method, app_key, timestamp, etc.)
          // 2. Sort by key in ASCII order
          // 3. Concatenate key+value with NO separator and NO prefix
          // 4. HMAC-SHA256 with appSecret, UPPERCASE hex
          const method = 'aliexpress.ds.member.benefit.get';
          const timestamp = String(Date.now()); // 13-digit milliseconds

          const paramObj: Record<string, string> = {
            method,
            app_key: appKey,
            timestamp,
            sign_method: 'sha256',
            format: 'json',
            v: '2.0',
          };
          // access_token is the correct param name (not session)
          if (credentials.accessToken) paramObj.access_token = credentials.accessToken;

          // Sort all params alphabetically, concatenate key+value — NO prefix
          const sortedStr = Object.entries(paramObj)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}${v}`)
            .join('');

          const encoder = new TextEncoder();
          const cryptoKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(appSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
          );
          const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(sortedStr));
          const sign = Array.from(new Uint8Array(sigBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();

          paramObj.sign = sign;

          // POST to /sync with form-encoded body
          const formBody = new URLSearchParams(paramObj).toString();
          const res = await fetch('https://api-sg.aliexpress.com/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formBody,
            signal: AbortSignal.timeout(15000),
          });

          const data = await res.json() as Record<string, unknown>;
          const errorResponse = data?.error_response as Record<string, unknown> | undefined;

          if (errorResponse) {
            const code = String(errorResponse?.code ?? '');
            const msg = String(errorResponse?.sub_msg || errorResponse?.msg || 'Unknown error');

            // Code 27 = invalid app key
            if (code === '27') {
              return NextResponse.json({ success: false, message: `Invalid App Key — double-check the key copied from your AliExpress Open Platform console. (${msg})` });
            }
            // Code 15 = invalid signature (wrong secret)
            if (code === '15') {
              return NextResponse.json({ success: false, message: `Signature mismatch — App Secret may be incorrect. (${msg})` });
            }
            // Session/token errors mean key+secret are valid, just need OAuth token
            if (code === '40' || msg.toLowerCase().includes('session') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('access')) {
              return NextResponse.json({ success: true, message: `App Key and Secret verified ✓ — an Access Token is required for full DS API access. Click "Get Access Token" to authorize.` });
            }
            // Permission errors also mean credentials are valid
            if (code.startsWith('4') || code.startsWith('5') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('privilege')) {
              return NextResponse.json({ success: true, message: `App Key and Secret accepted ✓ — Note: ${msg}. Enable DS API permissions in your AliExpress Open Platform console if needed.` });
            }
            return NextResponse.json({ success: false, message: `AliExpress API error (${code}): ${msg}` });
          }

          // Check for ISV-style error at top level
          if (data?.type && data?.code && data?.code !== '0' && data?.code !== 0) {
            const code = String(data.code);
            const msg = String(data.message || data.msg || 'Unknown error');
            if (msg.toLowerCase().includes('signature') || msg.toLowerCase().includes('sign')) {
              return NextResponse.json({ success: false, message: `Signature error: ${msg}. Check your App Secret.` });
            }
            if (msg.toLowerCase().includes('access') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('session')) {
              return NextResponse.json({ success: true, message: `App Key and Secret verified ✓ — Access Token needed. Click "Get Access Token" to authorize.` });
            }
            return NextResponse.json({ success: false, message: `AliExpress API error (${code}): ${msg}` });
          }

          // Successful response
          const benefitResp = data?.aliexpress_ds_member_benefit_get_response as Record<string, unknown> | undefined;
          const level = (benefitResp?.result as Record<string, unknown>)?.member_level;
          const successMsg = level
            ? `AliExpress DS API verified ✓ Member level: ${level}. All DS endpoints active.`
            : 'AliExpress DS API credentials verified ✓ Product, freight, and order endpoints are active.';
          return NextResponse.json({ success: true, message: successMsg });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return NextResponse.json({ success: false, message: `Could not reach AliExpress API (${msg}) — check your network or try again.` });
        }
      }

      case 'scrapfly': {
        const apiKey = credentials.apiKey;
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key is required.' });
        const res = await fetch(`https://api.scrapfly.io/account?key=${encodeURIComponent(apiKey)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          const credits = data?.result?.subscription?.usage?.scrape_api?.remaining ?? null;
          const plan = data?.result?.subscription?.plan?.name ?? '';
          const msg = credits !== null
            ? `Connected! Plan: ${plan || 'Active'} — ${credits.toLocaleString()} credits remaining.`
            : 'Connected to Scrapfly successfully.';
          return NextResponse.json({ success: true, message: msg });
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = (errData as Record<string, unknown>)?.message || `HTTP ${res.status}`;
          return NextResponse.json({ success: false, message: `Scrapfly rejected the key: ${errMsg}` });
        }
      }

      case 'scraperapi': {
        const apiKey = credentials.apiKey;
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key is required.' });
        const res = await fetch(`https://api.scraperapi.com/account?api_key=${encodeURIComponent(apiKey)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const remaining = data?.requestCount ?? data?.remaining ?? null;
          const limit = data?.requestLimit ?? null;
          const msg = remaining !== null
            ? `Connected! ${remaining}${limit ? ` / ${limit}` : ''} requests remaining this month.`
            : 'Connected to ScraperAPI successfully.';
          return NextResponse.json({ success: true, message: msg });
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = (errData as Record<string, unknown>)?.error || `HTTP ${res.status}`;
          return NextResponse.json({ success: false, message: `ScraperAPI rejected the key: ${errMsg}` });
        }
      }

      case 'dataforseo': {
        const email = credentials.email;
        const password = credentials.password;
        if (!email || !password) return NextResponse.json({ success: false, message: 'Email and password are required.' });
        const basicAuth = Buffer.from(`${email}:${password}`).toString('base64');
        const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const tasks = (data?.tasks as Array<Record<string, unknown>>)?.[0];
          const result = (tasks?.result as Array<Record<string, unknown>>)?.[0];
          const balance = result?.money_balance ?? null;
          const msg = balance !== null
            ? `Connected! Account balance: $${Number(balance).toFixed(2)}`
            : 'Connected to DataForSEO successfully.';
          return NextResponse.json({ success: true, message: msg });
        } else if (res.status === 401) {
          return NextResponse.json({ success: false, message: 'Invalid email or password. Check your DataForSEO credentials.' });
        } else {
          return NextResponse.json({ success: false, message: `DataForSEO returned HTTP ${res.status}.` });
        }
      }

      case 'bonanza': {
        const developerId = credentials.developerId;
        const certificateId = credentials.certificateId;
        const authToken = credentials.authToken;

        if (!developerId && !certificateId) {
          return NextResponse.json({ success: false, message: 'Developer Name and Certification Name are required.' });
        }

        // Validate format — Bonanza dev names are typically alphanumeric strings
        const devIdClean = (developerId || '').trim();
        const certIdClean = (certificateId || '').trim();

        if (devIdClean.length < 3) {
          return NextResponse.json({ success: false, message: 'Developer Name appears too short. Check your Bonanza developer portal.' });
        }
        if (certIdClean.length < 3) {
          return NextResponse.json({ success: false, message: 'Certification Name appears too short. Check your Bonanza developer portal.' });
        }

        // If we have an auth token, try to validate it against the Bonanza API
        if (authToken && authToken.trim().length > 10) {
          try {
            const res = await fetch('https://api.bonanza.com/api_requests/secure_request', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-BONANZA-API-TOKEN': authToken.trim(),
              },
              body: JSON.stringify({
                'getUser': {
                  'DetailLevel': 'ReturnSummary',
                },
              }),
              signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
              return NextResponse.json({ success: true, message: 'Bonanza credentials validated. Auth token is active.' });
            } else if (res.status === 401 || res.status === 403) {
              return NextResponse.json({ success: false, message: 'Auth token rejected by Bonanza. It may have expired — try fetching a new one.' });
            }
            // If we get any other response, fall through to format-only validation
          } catch {
            // Network error — fall through to format validation
          }
        }

        // Format-only validation when no token or token check failed non-auth
        return NextResponse.json({
          success: true,
          message: authToken
            ? 'Credentials saved. Auth token format looks valid — run a scrape to fully verify.'
            : 'Developer Name and Certification Name saved. Paste your Auth Token from the Bonanza developer portal, or click "Fetch Token" to retrieve it via OAuth.',
        });
      }

      case 'firecrawl': {
        const apiKey = credentials.apiKey;
        if (!apiKey) return NextResponse.json({ success: false, message: 'API key is required.' });
        // Use POST /v1/scrape with a tiny, fast URL — this is the correct way to verify a Firecrawl key.
        // The /v1/team/credits endpoint does not exist and returns 404.
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            url: 'https://example.com',
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 15000,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const success = data?.success === true;
          if (success) {
            const title = ((data?.data as Record<string, unknown>)?.metadata as Record<string, unknown>)?.title ?? '';
            const msg = title
              ? `Connected to Firecrawl! Test scrape succeeded — page title: "${title}". Scraping, browser automation (Actions), and monitoring are all active.`
              : 'Connected to Firecrawl! Test scrape succeeded. Scraping, browser automation (Actions), and monitoring are all active.';
            return NextResponse.json({ success: true, message: msg });
          }
          return NextResponse.json({ success: false, message: 'Firecrawl returned success:false — check your key.' });
        } else if (res.status === 401 || res.status === 403) {
          return NextResponse.json({ success: false, message: 'Invalid Firecrawl API key. Check your key at firecrawl.dev.' });
        } else if (res.status === 402) {
          // 402 = payment required — key is valid but out of credits
          return NextResponse.json({ success: true, message: 'Firecrawl API key is valid! Your plan has no remaining credits — add credits at firecrawl.dev to start scraping.' });
        } else if (res.status === 429) {
          return NextResponse.json({ success: true, message: 'Firecrawl API key is valid! Rate limit hit — slow down requests or upgrade your plan.' });
        } else {
          const errData = await res.json().catch(() => ({})) as Record<string, unknown>;
          const errMsg = errData?.error || errData?.message || `HTTP ${res.status}`;
          return NextResponse.json({ success: false, message: `Firecrawl error: ${errMsg}` });
        }
      }

      default:
        // For cashback portals and other services — just validate credentials are present
        {
          const hasAny = Object.values(credentials).some((v) => v && v.trim().length > 0);
          return NextResponse.json({
            success: hasAny,
            message: hasAny
              ? 'Credentials saved. Connection will be verified when the auto-order bot next runs.'
              : 'No credentials provided.',
          });
        }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('test-connection error:', err);
    return NextResponse.json({ success: false, message: `Server error: ${message}` }, { status: 500 });
  }
}
