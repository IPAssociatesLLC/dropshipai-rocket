import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Firecrawl action types
interface FirecrawlAction {
  type: 'click' | 'write' | 'press' | 'wait' | 'scroll' | 'screenshot' | 'scrape' | 'executeJavascript';
  selector?: string;
  text?: string;
  key?: string;
  milliseconds?: number;
  direction?: 'up' | 'down';
  script?: string;
  fullPage?: boolean;
  all?: boolean;
}

interface AutoOrderRequest {
  // The cashback portal to log into first (optional — skip if already logged in via profile)
  cashbackSite?: string;
  cashbackUsername?: string;
  cashbackPassword?: string;
  // The product page URL on the source site (AliExpress, Walmart, etc.)
  productUrl: string;
  // Natural-language instruction for what to do on the product page
  instruction?: string;
  // Explicit action sequence (overrides instruction if provided)
  actions?: FirecrawlAction[];
  // Buyer shipping address fields
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  // Firecrawl profile name — keeps cookies/session across calls
  profileName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AutoOrderRequest;
    const { productUrl, actions, cashbackSite, cashbackUsername, cashbackPassword, profileName } = body;

    if (!productUrl) {
      return NextResponse.json({ success: false, message: 'productUrl is required.' }, { status: 400 });
    }

    // Fetch the Firecrawl API key from Supabase api_credentials
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const { data: credRow } = await supabase
      .from('api_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('service', 'firecrawl')
      .single();

    const apiKey = (credRow?.credentials as Record<string, string>)?.apiKey;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'Firecrawl API key not configured. Add it in API Connections → Firecrawl.' }, { status: 400 });
    }

    // Build the action sequence
    let actionSequence: FirecrawlAction[] = [];

    // If explicit actions provided, use them directly
    if (actions && actions.length > 0) {
      actionSequence = actions;
    } else {
      // Default: navigate to product page and take a screenshot to confirm state
      actionSequence = [
        { type: 'wait', milliseconds: 2000 },
        { type: 'screenshot' },
        { type: 'scrape' },
      ];
    }

    // Build the scrape request body
    const scrapeBody: Record<string, unknown> = {
      url: productUrl,
      formats: ['markdown', 'links'],
      actions: actionSequence,
      onlyMainContent: false,
      timeout: 120000,
      blockAds: true,
    };

    // Use a persistent profile to maintain login state across calls
    if (profileName) {
      scrapeBody.profile = { name: profileName, saveChanges: true };
    }

    // If cashback login is requested, prepend login actions
    // Note: cashback login should be done as a separate call first to establish the session
    if (cashbackSite && cashbackUsername && cashbackPassword) {
      const loginUrl = getCashbackLoginUrl(cashbackSite);
      if (loginUrl) {
        // First call: log into cashback site to establish session
        const loginActions: FirecrawlAction[] = [
          { type: 'wait', milliseconds: 1500 },
          { type: 'click', selector: 'input[type="email"], input[name="email"], input[name="username"], #email, #username' },
          { type: 'write', text: cashbackUsername },
          { type: 'press', key: 'Tab' },
          { type: 'write', text: cashbackPassword },
          { type: 'click', selector: 'button[type="submit"], input[type="submit"], .login-btn, #login-btn, button.btn-primary' },
          { type: 'wait', milliseconds: 3000 },
          { type: 'screenshot' },
        ];

        const loginBody: Record<string, unknown> = {
          url: loginUrl,
          formats: ['markdown'],
          actions: loginActions,
          timeout: 60000,
          blockAds: true,
        };

        if (profileName) {
          loginBody.profile = { name: profileName, saveChanges: true };
        }

        const loginRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loginBody),
          signal: AbortSignal.timeout(70000),
        });

        if (!loginRes.ok) {
          const errData = await loginRes.json().catch(() => ({})) as Record<string, unknown>;
          return NextResponse.json({
            success: false,
            message: `Cashback login failed (HTTP ${loginRes.status}): ${errData?.error || 'Unknown error'}`,
          });
        }

        const loginData = await loginRes.json() as Record<string, unknown>;
        const loginScreenshots = ((loginData?.data as Record<string, unknown>)?.actions as Record<string, unknown>)?.screenshots as string[] | undefined;

        // Now proceed to the product URL with the established session
        const productRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(scrapeBody),
          signal: AbortSignal.timeout(130000),
        });

        if (!productRes.ok) {
          const errData = await productRes.json().catch(() => ({})) as Record<string, unknown>;
          return NextResponse.json({
            success: false,
            message: `Product page automation failed (HTTP ${productRes.status}): ${errData?.error || 'Unknown error'}`,
          });
        }

        const productData = await productRes.json() as Record<string, unknown>;
        const productActions = ((productData?.data as Record<string, unknown>)?.actions as Record<string, unknown>);

        return NextResponse.json({
          success: true,
          message: 'Browser automation completed.',
          loginScreenshots: loginScreenshots || [],
          productScreenshots: (productActions?.screenshots as string[]) || [],
          productScrapes: (productActions?.scrapes as unknown[]) || [],
          markdown: (productData?.data as Record<string, unknown>)?.markdown,
          metadata: (productData?.data as Record<string, unknown>)?.metadata,
        });
      }
    }

    // Direct product page automation (no cashback login)
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scrapeBody),
      signal: AbortSignal.timeout(130000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as Record<string, unknown>;
      const errMsg = (errData as Record<string, unknown>)?.error || `HTTP ${res.status}`;
      return NextResponse.json({ success: false, message: `Firecrawl automation error: ${errMsg}` });
    }

    const data = await res.json() as Record<string, unknown>;
    const actionsResult = ((data?.data as Record<string, unknown>)?.actions as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      message: 'Browser automation completed successfully.',
      screenshots: (actionsResult?.screenshots as string[]) || [],
      scrapes: (actionsResult?.scrapes as unknown[]) || [],
      javascriptReturns: (actionsResult?.javascriptReturns as unknown[]) || [],
      markdown: (data?.data as Record<string, unknown>)?.markdown,
      metadata: (data?.data as Record<string, unknown>)?.metadata,
      links: (data?.data as Record<string, unknown>)?.links,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Firecrawl actions error:', err);
    return NextResponse.json({ success: false, message: `Server error: ${message}` }, { status: 500 });
  }
}

function getCashbackLoginUrl(site: string): string | null {
  const loginUrls: Record<string, string> = {
    rakuten: 'https://www.rakuten.com/login',
    topcashback: 'https://www.topcashback.com/login',
    befrugal: 'https://www.befrugal.com/login',
    swagbucks: 'https://www.swagbucks.com/login',
    ibotta: 'https://home.ibotta.com/login',
  };
  return loginUrls[site.toLowerCase()] ?? null;
}
