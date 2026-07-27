-- Fix: Grant permissions and add RLS policies for scrape_campaigns
-- Also create pricing_rules and bonanza_listings tables

-- Grant table-level privileges for scrape_campaigns
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrape_campaigns TO authenticated;

-- Enable RLS on scrape_campaigns if not already enabled
ALTER TABLE public.scrape_campaigns ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for scrape_campaigns
DROP POLICY IF EXISTS "users_manage_own_scrape_campaigns" ON public.scrape_campaigns;
CREATE POLICY "users_manage_own_scrape_campaigns"
ON public.scrape_campaigns
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Pricing Rules Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'percentage',
  markup_value NUMERIC(10,2) NOT NULL DEFAULT 30,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  flat_markup NUMERIC(10,2) DEFAULT 0,
  low_price_threshold NUMERIC(10,2),
  low_price_flat_add NUMERIC(10,2),
  round_to_99 BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_user_id ON public.pricing_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_source ON public.pricing_rules(source);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;

DROP POLICY IF EXISTS "users_manage_own_pricing_rules" ON public.pricing_rules;
CREATE POLICY "users_manage_own_pricing_rules"
ON public.pricing_rules
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Bonanza Listings Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonanza_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bonanza_item_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  cost NUMERIC(10,2),
  margin_pct NUMERIC(5,2),
  source TEXT,
  source_url TEXT,
  image_url TEXT,
  category TEXT,
  sku TEXT,
  upc TEXT,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  google_shopping_status TEXT DEFAULT 'not_submitted',
  google_shopping_id TEXT,
  bonanza_url TEXT,
  views INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bonanza_listings_user_id ON public.bonanza_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_bonanza_listings_status ON public.bonanza_listings(status);
CREATE INDEX IF NOT EXISTS idx_bonanza_listings_source ON public.bonanza_listings(source);

ALTER TABLE public.bonanza_listings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonanza_listings TO authenticated;

DROP POLICY IF EXISTS "users_manage_own_bonanza_listings" ON public.bonanza_listings;
CREATE POLICY "users_manage_own_bonanza_listings"
ON public.bonanza_listings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
