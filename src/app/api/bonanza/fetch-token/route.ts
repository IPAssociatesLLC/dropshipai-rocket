import { NextRequest, NextResponse } from 'next/server';

// POST /api/bonanza/fetch-token
// Calls Bonanza fetchToken API using saved Developer Name + Certification Name
// Returns authToken + authenticationURL per https://api.bonanza.com/docs/reference/fetch_token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { developerId, certificateId, validationCompleteURL } = body as {
      developerId: string;
      certificateId: string;
      validationCompleteURL?: string;
    };

    if (!developerId || !certificateId) {
      return NextResponse.json(
        { success: false, message: 'Developer Name and Certification Name are required.' },
        { status: 400 }
      );
    }

    const devId = developerId.trim();
    const certId = certificateId.trim();

    if (devId.length < 3) {
      return NextResponse.json({ success: false, message: 'Developer Name appears too short.' });
    }
    if (certId.length < 3) {
      return NextResponse.json({ success: false, message: 'Certification Name appears too short.' });
    }

    // Build fetchToken request body per Bonanza docs
    const requestBody: Record<string, unknown> = {
      fetchTokenRequest: {},
    };
    if (validationCompleteURL) {
      (requestBody.fetchTokenRequest as Record<string, unknown>).validationCompleteURL = validationCompleteURL;
    }

    const res = await fetch('https://api.bonanza.com/api_requests/secure_request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BONANZLE-API-DEV-NAME': devId,
        'X-BONANZLE-API-CERT-NAME': certId,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        success: false,
        message: `Bonanza returned unexpected response (HTTP ${res.status}). Check your Developer Name and Certification Name.`,
      });
    }

    if (!res.ok) {
      const errMsg = (data?.errorMessage as Record<string, unknown>)?.error;
      const errText = Array.isArray(errMsg)
        ? (errMsg[0] as Record<string, unknown>)?.message
        : typeof errMsg === 'string'
        ? errMsg
        : `HTTP ${res.status}`;
      return NextResponse.json({
        success: false,
        message: `Bonanza API error: ${errText}. Verify your Developer Name and Certification Name in your Bonanza developer portal.`,
      });
    }

    const tokenResponse = data?.fetchTokenResponse as Record<string, unknown> | undefined;

    if (!tokenResponse) {
      return NextResponse.json({
        success: false,
        message: 'Unexpected response from Bonanza. Check your credentials.',
      });
    }

    // Check for error in response
    const errorMessage = tokenResponse?.errorMessage as Record<string, unknown> | undefined;
    if (errorMessage) {
      const errArr = errorMessage?.error as Array<Record<string, unknown>> | undefined;
      const errText = errArr?.[0]?.message || 'Unknown Bonanza error';
      return NextResponse.json({ success: false, message: `Bonanza error: ${errText}` });
    }

    const authToken = tokenResponse?.authToken as string | undefined;
    const authenticationURL = tokenResponse?.authenticationURL as string | undefined;
    const hardExpirationTime = tokenResponse?.hardExpirationTime as string | undefined;

    if (!authToken || !authenticationURL) {
      return NextResponse.json({
        success: false,
        message: 'Bonanza did not return a token. Check your Developer Name and Certification Name.',
      });
    }

    return NextResponse.json({
      success: true,
      authToken,
      authenticationURL,
      hardExpirationTime,
      message: 'Token fetched successfully. Visit the authorization URL to activate it.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      success: false,
      message: `Failed to reach Bonanza API: ${msg}`,
    });
  }
}
