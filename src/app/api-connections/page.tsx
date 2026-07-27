'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Eye, EyeOff, CheckCircle2, AlertCircle, Plug, Save, RefreshCw, Key, ExternalLink, Lock
} from 'lucide-react';

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'email';
  hint?: string;
}

interface ApiSection {
  id: string;
  name: string;
  color: string;
  description: string;
  docsUrl?: string;
  fields: FieldDef[];
  testNote?: string;
}

const SECTIONS: ApiSection[] = [
  {
    id: 'aliexpress_ds',
    name: 'AliExpress Dropshipping API',
    color: '#ef4444',
    description: 'Official AliExpress DS API at ds.aliexpress.com. Provides authenticated product search, wholesale pricing, freight calculation, order creation, and order tracking. When credentials are saved, the AliExpress scraper uses this API as the primary data source — eliminating the logged-out vs logged-in price discrepancy.',
    docsUrl: 'https://openservice.aliexpress.com/doc/doc.htm#/?docId=1591',
    testNote: 'Calls aliexpress.ds.member.benefit.get to verify your App Key and App Secret. All 16 DS API endpoints become active once credentials are saved.',
    fields: [
      { key: 'appKey', label: 'App Key', placeholder: 'Your AliExpress DS App Key', type: 'text', hint: 'Found in your AliExpress DS developer console at ds.aliexpress.com/dropshipping-api' },
      { key: 'appSecret', label: 'App Secret', placeholder: 'Your AliExpress DS App Secret', type: 'password', hint: 'Keep this secret — used to sign all API requests with HMAC-SHA256' },
      { key: 'accessToken', label: 'Access Token (optional)', placeholder: 'OAuth access token from your DS account login', type: 'password', hint: 'Required for order creation and authenticated pricing. Obtain by authorizing your app at ds.aliexpress.com.' },
    ],
  },
  {
    id: 'bonanza',
    name: 'Bonanza Marketplace',
    color: '#f97316',
    description: 'Used to import listings, sync inventory, and receive order notifications from your Bonanza seller account.',
    docsUrl: 'https://www.bonanza.com/api_agreement',
    testNote: 'Validates Developer Name + Certification Name format. If an Auth Token is present, it will be verified against the Bonanza API.',
    fields: [
      { key: 'developerId', label: 'Developer Name', placeholder: 'Your Bonanza Developer Name', type: 'text' },
      { key: 'certificateId', label: 'Certification Name', placeholder: 'Your Bonanza Certification Name', type: 'text', hint: 'Found in your Bonanza developer portal under My Account → Developer' },
      { key: 'authToken', label: 'Auth Token', placeholder: 'Your Bonanza Auth Token', type: 'password', hint: 'Paste your OAuth token here, or click "Fetch Token" — this opens the Bonanza login page so you can authorize direct API access' },
    ],
  },
  {
    id: 'dataforseo',
    name: 'DataForSEO',
    color: '#3b82f6',
    description: 'Used to fetch Google Shopping lowest prices for margin comparison and product search volume data.',
    docsUrl: 'https://docs.dataforseo.com',
    testNote: 'Makes a live call to /v3/appendix/user_data using your email + password. Returns your account balance on success.',
    fields: [
      { key: 'email', label: 'Account Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'password', label: 'Account Password', placeholder: 'DataForSEO password', type: 'password' },
      { key: 'apiKey', label: 'API Key (numeric)', placeholder: 'Long numeric key from your DataForSEO dashboard', type: 'password', hint: 'Optional if using email+password auth. The long numeric key from your dashboard.' },
    ],
  },
  {
    id: 'scrapfly',
    name: 'Scrapfly',
    color: '#8b5cf6',
    description: 'Primary scraping infrastructure for AliExpress and Walmart. Includes anti-bot bypass (ASP) and residential proxies.',
    docsUrl: 'https://scrapfly.io/docs',
    testNote: 'Calls the Scrapfly /account endpoint to verify your key and show remaining credits.',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'scp-live-xxxxxxxxxxxxxxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    id: 'scraperapi',
    name: 'ScraperAPI',
    color: '#10b981',
    description: 'Fallback scraping service. Note: Walmart scraping has been switched to Scrapfly due to better anti-bot bypass.',
    docsUrl: 'https://www.scraperapi.com/documentation',
    testNote: 'Calls the ScraperAPI /account endpoint to verify your key and show remaining requests.',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your ScraperAPI key', type: 'password' },
    ],
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    color: '#ef4444',
    description: 'AI-powered web scraper with browser automation (Actions), content monitoring, and structured extraction. Used for: (1) scraping product pages into clean markdown/JSON, (2) automated ordering — logs into cashback sites, navigates product pages, fills and submits order forms using natural-language actions, (3) monitoring source URLs for price/stock changes via webhook at /api/webhooks/firecrawl.',
    docsUrl: 'https://docs.firecrawl.dev',
    testNote: 'Calls POST /v1/scrape on example.com to verify your key. A successful scrape confirms the key is valid and all three capabilities (scraping, browser automation, monitoring) are active.',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'fc-xxxxxxxxxxxxxxxxxxxxxxxx', type: 'password', hint: 'Get your key at firecrawl.dev — keys start with "fc-". Webhook URL for monitoring: https://dropautoai.com/api/webhooks/firecrawl' },
    ],
  },
  {
    id: 'rakuten',
    name: 'Rakuten (Cashback)',
    color: '#f59e0b',
    description: 'Auto-order system logs into your Rakuten account to activate cashback before placing orders.',
    fields: [
      { key: 'username', label: 'Rakuten Username / Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'password', label: 'Rakuten Password', placeholder: 'Your Rakuten account password', type: 'password', hint: 'Used by the auto-order bot to log in and activate cashback before checkout' },
    ],
  },
  {
    id: 'topcashback',
    name: 'TopCashback',
    color: '#059669',
    description: 'Auto-order system routes through TopCashback when it offers the highest cashback for a product.',
    fields: [
      { key: 'username', label: 'TopCashback Username / Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'password', label: 'TopCashback Password', placeholder: 'Your TopCashback password', type: 'password', hint: 'Used by the auto-order bot to log in and activate cashback before checkout' },
    ],
  },
  {
    id: 'befrugal',
    name: 'BeFrugal',
    color: '#6366f1',
    description: 'Auto-order system routes through BeFrugal when it offers the highest cashback for a product.',
    fields: [
      { key: 'username', label: 'BeFrugal Username / Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'password', label: 'BeFrugal Password', placeholder: 'Your BeFrugal password', type: 'password', hint: 'Used by the auto-order bot to log in and activate cashback before checkout' },
    ],
  },
  {
    id: 'swagbucks',
    name: 'Swagbucks',
    color: '#dc2626',
    description: 'Auto-order system routes through Swagbucks shopping portal when it offers the best cashback rate.',
    fields: [
      { key: 'username', label: 'Swagbucks Username / Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'password', label: 'Swagbucks Password', placeholder: 'Your Swagbucks password', type: 'password', hint: 'Used by the auto-order bot to log in and activate cashback before checkout' },
    ],
  },
  {
    id: 'ibotta',
    name: 'Ibotta',
    color: '#0891b2',
    description: 'Auto-order system routes through Ibotta when it offers the highest cashback for a product.',
    fields: [
      { key: 'username', label: 'Ibotta Username / Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'password', label: 'Ibotta Password', placeholder: 'Your Ibotta password', type: 'password', hint: 'Used by the auto-order bot to log in and activate cashback before checkout' },
    ],
  },
];

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'loading';

interface ApiCardProps {
  section: ApiSection;
  userId: string | null;
}

function ApiCard({ section, userId }: ApiCardProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(section.fields.map((f) => [f.key, '']))
  );
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [fetchTokenMsg, setFetchTokenMsg] = useState<string | null>(null);
  const [gettingAliToken, setGettingAliToken] = useState(false);
  const [aliTokenMsg, setAliTokenMsg] = useState<string | null>(null);
  const [aliTokenSuccess, setAliTokenSuccess] = useState<boolean | null>(null);

  // Load saved credentials from Supabase on mount and show masked values in fields
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from('api_credentials')
      .select('credentials, is_connected')
      .eq('user_id', userId)
      .eq('service', section.id)
      .single()
      .then(({ data }) => {
        if (data?.credentials) {
          const creds = data.credentials as Record<string, string>;
          const masked: Record<string, string> = {};
          section.fields.forEach((f) => {
            masked[f.key] = creds[f.key] ? '••••••••' : '';
          });
          setValues(masked);
          setLoadedFromDb(true);
          setStatus(data.is_connected ? 'connected' : 'disconnected');
        }
      });
  }, [userId, section.id, section.fields]);

  // Handle AliExpress OAuth callback result from URL params (only for aliexpress_ds card)
  useEffect(() => {
    if (section.id !== 'aliexpress_ds') return;
    const params = new URLSearchParams(window.location.search);
    const tokenSuccess = params.get('aliexpress_token');
    const tokenError = params.get('aliexpress_error');
    if (tokenSuccess === 'success') {
      setAliTokenSuccess(true);
      setAliTokenMsg('✓ Access Token obtained and saved! The Access Token field is now populated. Click "Test Connection" to verify.');
      // Reload credentials from DB to show the new masked token
      if (userId) {
        const supabase = createClient();
        supabase
          .from('api_credentials')
          .select('credentials, is_connected')
          .eq('user_id', userId)
          .eq('service', 'aliexpress_ds')
          .single()
          .then(({ data }) => {
            if (data) {
              const creds = data.credentials as Record<string, string>;
              const masked: Record<string, string> = {};
              section.fields.forEach((f) => {
                masked[f.key] = creds[f.key] ? '••••••••' : '';
              });
              setValues(masked);
              setLoadedFromDb(true);
              setStatus(data.is_connected ? 'connected' : 'disconnected');
            }
          });
      }
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('aliexpress_token');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => { setAliTokenMsg(null); setAliTokenSuccess(null); }, 12000);
    } else if (tokenError) {
      setAliTokenSuccess(false);
      const decoded = decodeURIComponent(tokenError).replace(/_/g, ' ');
      setAliTokenMsg(`Authorization failed: ${decoded}. Please try again.`);
      const url = new URL(window.location.href);
      url.searchParams.delete('aliexpress_error');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => { setAliTokenMsg(null); setAliTokenSuccess(null); }, 10000);
    }
  }, [section.id, section.fields, userId]);

  const handleSave = async (): Promise<{ ok: boolean; creds: Record<string, string> }> => {
    if (!userId) {
      setSaveError('You must be logged in to save credentials.');
      setTimeout(() => setSaveError(null), 3000);
      return { ok: false, creds: {} };
    }
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const newCreds: Record<string, string> = {};
      section.fields.forEach((f) => {
        const v = values[f.key];
        if (v && v !== '••••••••') {
          newCreds[f.key] = v;
        }
      });

      let mergedCreds = newCreds;

      if (loadedFromDb) {
        const { data: existing } = await supabase
          .from('api_credentials')
          .select('credentials')
          .eq('user_id', userId)
          .eq('service', section.id)
          .single();
        const existingCreds = (existing?.credentials as Record<string, string>) || {};
        mergedCreds = { ...existingCreds, ...newCreds };
      }

      const { error } = await supabase.from('api_credentials').upsert({
        user_id: userId,
        service: section.id,
        credentials: mergedCreds,
        is_connected: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,service' });
      if (error) throw error;

      // Re-populate fields with masked values so they stay visible after saving
      const masked: Record<string, string> = {};
      section.fields.forEach((f) => {
        masked[f.key] = mergedCreds[f.key] ? '••••••••' : '';
      });
      setValues(masked);

      setLoadedFromDb(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return { ok: true, creds: mergedCreds };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      console.error('Save credentials error:', err);
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 4000);
      return { ok: false, creds: {} };
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!userId) {
      setTestMessage('You must be logged in to test the connection.');
      setTestSuccess(false);
      setTimeout(() => { setTestMessage(null); setTestSuccess(null); }, 3000);
      return;
    }

    setTesting(true);
    setTestMessage(null);
    setTestSuccess(null);

    try {
      // Save any new values first (handles unmasked form input)
      const { ok } = await handleSave();
      if (!ok) {
        setTesting(false);
        return;
      }

      // Always read the real (unmasked) credentials from Supabase for the test
      const supabase = createClient();
      const { data: credRow } = await supabase
        .from('api_credentials')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service', section.id)
        .single();

      const realCreds = (credRow?.credentials as Record<string, string>) || {};

      if (Object.keys(realCreds).length === 0) {
        setTestSuccess(false);
        setTestMessage('No credentials found. Please enter and save your credentials first.');
        setTesting(false);
        setTimeout(() => { setTestMessage(null); setTestSuccess(null); }, 5000);
        return;
      }

      // Make real API test call server-side with unmasked credentials
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: section.id, credentials: realCreds }),
      });

      const result = await res.json() as { success: boolean; message: string };
      const isSuccess = result.success === true;

      setTestSuccess(isSuccess);
      setTestMessage(result.message || (isSuccess ? 'Connection successful.' : 'Connection failed.'));
      setStatus(isSuccess ? 'connected' : 'error');

      // Update is_connected in DB
      await supabase.from('api_credentials').update({
        is_connected: isSuccess,
        last_tested_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('service', section.id);

      setTimeout(() => { setTestMessage(null); setTestSuccess(null); }, 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed.';
      console.error('Test connection error:', err);
      setStatus('error');
      setTestSuccess(false);
      setTestMessage(msg);
      setTimeout(() => { setTestMessage(null); setTestSuccess(null); }, 4000);
    } finally {
      setTesting(false);
    }
  };

  // Bonanza-specific: fetch auth token via real Bonanza fetchToken API
  const handleFetchToken = async () => {
    if (!userId) {
      setFetchTokenMsg('You must be logged in to fetch a token.');
      setTimeout(() => setFetchTokenMsg(null), 3000);
      return;
    }

    setFetchingToken(true);
    setFetchTokenMsg('Reading saved credentials…');

    try {
      // Always read the real (unmasked) credentials from Supabase
      const supabase = createClient();
      const { data: credRow } = await supabase
        .from('api_credentials')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service', 'bonanza')
        .single();

      const savedCreds = (credRow?.credentials as Record<string, string>) || {};

      // Also check if the user has typed new (unmasked) values in the form
      const formDevId = values['developerId'] && values['developerId'] !== '••••••••' ? values['developerId'] : null;
      const formCertId = values['certificateId'] && values['certificateId'] !== '••••••••' ? values['certificateId'] : null;

      const devId = formDevId || savedCreds['developerId'] || '';
      const certId = formCertId || savedCreds['certificateId'] || '';

      if (!devId || !certId) {
        setFetchTokenMsg('Enter your Developer Name and Certification Name first, then save — or type them in the fields above.');
        setFetchingToken(false);
        setTimeout(() => setFetchTokenMsg(null), 5000);
        return;
      }

      setFetchTokenMsg('Calling Bonanza fetchToken API…');

      // Save any new form values first
      if (formDevId || formCertId) {
        await handleSave();
      }

      // Call our server-side Bonanza fetch-token route
      const res = await fetch('/api/bonanza/fetch-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerId: devId,
          certificateId: certId,
          validationCompleteURL: window.location.origin + '/api-connections',
        }),
      });

      const result = await res.json() as {
        success: boolean;
        message: string;
        authToken?: string;
        authenticationURL?: string;
        hardExpirationTime?: string;
      };

      if (!result.success) {
        setFetchTokenMsg(result.message || 'Failed to fetch token from Bonanza.');
        setFetchingToken(false);
        setTimeout(() => setFetchTokenMsg(null), 8000);
        return;
      }

      // We got a token — save it to the auth token field and to Supabase
      if (result.authToken) {
        setValues((prev) => ({ ...prev, authToken: result.authToken! }));

        // Merge the new token into saved credentials
        let mergedCreds = { ...savedCreds, authToken: result.authToken };
        if (devId) mergedCreds['developerId'] = devId;
        if (certId) mergedCreds['certificateId'] = certId;

        await supabase.from('api_credentials').upsert({
          user_id: userId,
          service: 'bonanza',
          credentials: mergedCreds,
          is_connected: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,service' });

        setLoadedFromDb(true);
      }

      // Open the authorization URL so the user can activate the token
      if (result.authenticationURL) {
        window.open(result.authenticationURL, '_blank', 'width=640,height=720,scrollbars=yes');
        const expiry = result.hardExpirationTime
          ? ` (expires ${new Date(result.hardExpirationTime).toLocaleDateString()})`
          : '';
        setFetchTokenMsg(
          `✓ Token fetched and saved${expiry}. A Bonanza authorization page has opened — log in there to activate the token. Once authorized, click "Test Connection" to verify.`
        );
      } else {
        setFetchTokenMsg('✓ Token fetched and saved to the Auth Token field. Click "Test Connection" to verify.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFetchTokenMsg('Error fetching token: ' + msg);
    } finally {
      setFetchingToken(false);
      setTimeout(() => setFetchTokenMsg(null), 15000);
    }
  };

  const handleGetAliExpressToken = async () => {
    if (!userId) {
      setAliTokenMsg('You must be logged in to authorize AliExpress.');
      setAliTokenSuccess(false);
      setTimeout(() => { setAliTokenMsg(null); setAliTokenSuccess(null); }, 4000);
      return;
    }

    setGettingAliToken(true);
    setAliTokenMsg(null);
    setAliTokenSuccess(null);

    try {
      // Read real credentials from Supabase (unmasked)
      const supabase = createClient();
      const { data: credRow } = await supabase
        .from('api_credentials')
        .select('credentials')
        .eq('user_id', userId)
        .eq('service', 'aliexpress_ds')
        .single();

      const savedCreds = (credRow?.credentials as Record<string, string>) || {};

      // Also check if user typed new unmasked values
      const formAppKey = values['appKey'] && values['appKey'] !== '••••••••' ? values['appKey'] : null;
      const appKey = formAppKey || savedCreds['appKey'] || '';

      if (!appKey) {
        setAliTokenMsg('Save your App Key first, then click "Get Access Token".');
        setAliTokenSuccess(false);
        setGettingAliToken(false);
        setTimeout(() => { setAliTokenMsg(null); setAliTokenSuccess(null); }, 5000);
        return;
      }

      // Save any unsaved form values first
      if (formAppKey) {
        await handleSave();
      }

      // Always use the production domain — must match exactly what was registered in AliExpress app console
      const callbackUrl = 'https://dropautoai.com/api/auth/aliexpress/callback';

      // Build AliExpress OAuth authorization URL
      const authUrl = new URL('https://api-sg.aliexpress.com/oauth/authorize');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('force_auth', 'true');
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('client_id', appKey);
      authUrl.searchParams.set('state', userId);

      window.open(authUrl.toString(), '_blank', 'width=720,height=800,scrollbars=yes');
      setAliTokenMsg('Authorization page opened in a new tab. Log in to AliExpress and approve the app — the Access Token will be saved automatically when you return.');
      setAliTokenSuccess(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setAliTokenMsg('Error: ' + msg);
      setAliTokenSuccess(false);
    } finally {
      setGettingAliToken(false);
      setTimeout(() => { setAliTokenMsg(null); setAliTokenSuccess(null); }, 20000);
    }
  };

  const statusEl = status === 'connected'
    ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#059669' }}><CheckCircle2 size={13} /> Connected</span>
    : status === 'error'
    ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#dc2626' }}><AlertCircle size={13} /> Error</span>
    : status === 'loading'
    ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#6b7280' }}><RefreshCw size={12} className="animate-spin" /> Loading…</span>
    : <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#6b7280' }}><Plug size={13} /> Not connected</span>;

  const feedbackColor = testSuccess === true || aliTokenSuccess === true
    ? { bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.3)', text: '#059669' }
    : testSuccess === false || aliTokenSuccess === false || saveError || (fetchTokenMsg && fetchTokenMsg.toLowerCase().includes('fail'))
    ? { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.3)', text: '#dc2626' }
    : { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', text: '#c2410c' };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: section.color }}>
            {section.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{section.name}</h3>
              {statusEl}
            </div>
            <p className="text-xs mt-0.5 max-w-lg" style={{ color: 'var(--muted-foreground)' }}>{section.description}</p>
          </div>
        </div>
        {section.docsUrl && (
          <a href={section.docsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs hidden sm:inline-flex gap-1">
            Docs <ExternalLink size={11} />
          </a>
        )}
      </div>

      {section.testNote && (
        <div className="px-5 pt-3">
          <p className="text-[11px] px-3 py-2 rounded-md flex items-start gap-1.5" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: '#1d4ed8' }}>
            <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
            <span><strong>Live test:</strong> {section.testNote}</span>
          </p>
        </div>
      )}

      <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {section.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{field.label}</label>
            <div className="relative">
              <input
                type={field.type === 'password' && !visible[field.key] ? 'password' : 'text'}
                value={values[field.key]}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="input-base text-xs h-9 pr-9"
                autoComplete="off"
              />
              {field.type === 'password' && (
                <button
                  type="button"
                  onClick={() => setVisible({ ...visible, [field.key]: !visible[field.key] })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={visible[field.key] ? 'Hide' : 'Show'}
                >
                  {visible[field.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
            {field.hint && <p className="text-[11px] leading-tight" style={{ color: 'var(--muted-foreground)' }}>{field.hint}</p>}
          </div>
        ))}
      </div>

      {/* Feedback messages */}
      {(saveError || testMessage || fetchTokenMsg || aliTokenMsg) && (
        <div className="px-5 pb-3">
          <p className="text-xs px-3 py-2 rounded-md" style={{
            background: feedbackColor.bg,
            color: feedbackColor.text,
            border: `1px solid ${feedbackColor.border}`,
          }}>
            {saveError || testMessage || fetchTokenMsg || aliTokenMsg}
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
        {section.id === 'aliexpress_ds' && (
          <button
            onClick={handleGetAliExpressToken}
            disabled={gettingAliToken || saving || testing}
            className="btn-secondary text-xs gap-1.5 disabled:opacity-60"
            title="Opens AliExpress OAuth authorization page. Saves Access Token automatically on return."
          >
            <Lock size={12} className={gettingAliToken ? 'animate-pulse' : ''} />
            {gettingAliToken ? 'Opening…' : 'Get Access Token'}
          </button>
        )}
        {section.id === 'bonanza' && (
          <button
            onClick={handleFetchToken}
            disabled={fetchingToken || saving || testing}
            className="btn-secondary text-xs gap-1.5 disabled:opacity-60"
            title="Opens Bonanza OAuth login page in a new tab"
          >
            <Key size={12} className={fetchingToken ? 'animate-pulse' : ''} />
            {fetchingToken ? 'Opening…' : 'Fetch Token'}
          </button>
        )}
        <button onClick={handleTest} disabled={testing || saving} className="btn-secondary text-xs gap-1.5 disabled:opacity-60">
          <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button onClick={() => handleSave()} disabled={saving} className="btn-primary text-xs gap-1.5 disabled:opacity-60">
          {saving ? <><RefreshCw size={12} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={12} /> Saved!</> : <><Save size={12} /> Save Credentials</>}
        </button>
      </div>
    </div>
  );
}

export default function ApiConnectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [connectedCount, setConnectedCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const loadConnectedCount = useCallback(async () => {
    if (!userId) {
      setLoadingCount(false);
      return;
    }
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('api_credentials')
        .select('id')
        .eq('user_id', userId)
        .eq('is_connected', true);
      setConnectedCount(data?.length || 0);
    } catch (err) {
      console.error('Load connected count error:', err);
    } finally {
      setLoadingCount(false);
    }
  }, [userId]);

  useEffect(() => { loadConnectedCount(); }, [loadConnectedCount]);

  const isLoading = authLoading || loadingCount;
  const scraperApis = SECTIONS.filter((s) => ['aliexpress_ds', 'bonanza', 'dataforseo', 'scrapfly', 'scraperapi', 'firecrawl'].includes(s.id));
  const cashbackPortals = SECTIONS.filter((s) => !['bonanza', 'dataforseo', 'scrapfly', 'scraperapi', 'firecrawl'].includes(s.id));

  return (
    <AppLayout title="API Connections" subtitle="Manage credentials for all integrations and cashback portals">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Integrations', value: SECTIONS.length.toString(), color: 'var(--foreground)' },
            { label: 'Connected', value: isLoading ? '…' : connectedCount.toString(), color: 'var(--positive)' },
            { label: 'Cashback Portals', value: cashbackPortals.length.toString(), color: 'var(--primary)' },
            { label: 'Scraping APIs', value: scraperApis.length.toString(), color: 'var(--info)' },
          ].map((stat) => (
            <div key={stat.label} className="card-elevated px-4 py-4">
              <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
              <p className="text-2xl font-bold font-mono-data" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {!authLoading && !userId && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Not logged in.</strong> You must be signed in to save or test API credentials.
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: '#c2410c' }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Cashback portal credentials</strong> are used by the auto-order browser extension to log into your accounts and activate cashback before placing each customer order. The system automatically selects the portal with the highest cashback percentage for each product at order time. Credentials are stored encrypted in your Supabase database.
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>Marketplace &amp; Scraping APIs</h2>
          <div className="space-y-3">
            {scraperApis.map((s) => (
              <ApiCard key={s.id} section={s} userId={userId} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>Cashback Portal Accounts</h2>
          <div className="space-y-3">
            {cashbackPortals.map((s) => (
              <ApiCard key={s.id} section={s} userId={userId} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
