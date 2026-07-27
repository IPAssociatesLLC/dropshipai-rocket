-- DropSync Full Schema Migration
-- Timestamp: 20260723003631

-- ============================================================
-- TYPES
-- ============================================================
DROP TYPE IF EXISTS public.product_source CASCADE;
CREATE TYPE public.product_source AS ENUM ('aliexpress', 'walmart', 'rakuten', 'topcashback', 'befrugal', 'swagbucks', 'ibotta', 'other');

DROP TYPE IF EXISTS public.product_status CASCADE;
CREATE TYPE public.product_status AS ENUM ('pending_review', 'approved', 'rejected', 'listed', 'delisted');

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM ('cashback-routing', 'ordering', 'shipped', 'delivered', 'completed', 'exception');

DROP TYPE IF EXISTS public.campaign_status CASCADE;
CREATE TYPE public.campaign_status AS ENUM ('active', 'paused', 'completed', 'error');

DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

DROP TYPE IF EXISTS public.plan_type CASCADE;
CREATE TYPE public.plan_type AS ENUM ('trial', 'starter', 'pro', 'enterprise');

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.user_role DEFAULT 'user'::public.user_role,
  plan public.plan_type DEFAULT 'trial'::public.plan_type,
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source public.product_source NOT NULL,
  source_url TEXT NOT NULL,
  source_price NUMERIC(10,2) NOT NULL,
  google_lowest_price NUMERIC(10,2),
  margin_pct NUMERIC(5,2),
  category TEXT,
  brand TEXT,
  upc TEXT,
  sku TEXT,
  image_url TEXT,
  rating NUMERIC(3,1),
  free_shipping BOOLEAN DEFAULT false,
  gift_receipt BOOLEAN DEFAULT false,
  shipping_days INTEGER,
  stock INTEGER DEFAULT 0,
  has_variants BOOLEAN DEFAULT false,
  status public.product_status DEFAULT 'pending_review'::public.product_status,
  bonanza_listing_id TEXT,
  bonanza_listing_url TEXT,
  cashback_site TEXT,
  cashback_pct NUMERIC(5,2),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  bonanza_order_id TEXT NOT NULL,
  buyer TEXT NOT NULL,
  buyer_address TEXT,
  product_title TEXT NOT NULL,
  source public.product_source NOT NULL,
  source_url TEXT,
  buy_price NUMERIC(10,2) NOT NULL,
  sell_price NUMERIC(10,2) NOT NULL,
  margin NUMERIC(10,2),
  cashback_site TEXT,
  cashback_pct NUMERIC(5,2),
  cashback_earned NUMERIC(10,2),
  status public.order_status DEFAULT 'cashback-routing'::public.order_status,
  tracking_number TEXT DEFAULT '',
  carrier TEXT DEFAULT '',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.scrape_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source public.product_source NOT NULL,
  keywords TEXT,
  urls TEXT,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  min_rating NUMERIC(3,1) DEFAULT 4.0,
  free_shipping BOOLEAN DEFAULT false,
  max_shipping_days INTEGER,
  gift_receipt BOOLEAN DEFAULT false,
  include_variants BOOLEAN DEFAULT true,
  min_stock INTEGER DEFAULT 1,
  brand TEXT,
  require_upc BOOLEAN DEFAULT false,
  require_sku BOOLEAN DEFAULT false,
  min_margin NUMERIC(5,2) DEFAULT 30.0,
  status public.campaign_status DEFAULT 'active'::public.campaign_status,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  products_found INTEGER DEFAULT 0,
  products_profitable INTEGER DEFAULT 0,
  run_count INTEGER DEFAULT 0,
  schedule_interval TEXT DEFAULT 'daily',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  old_value NUMERIC(10,2),
  new_value NUMERIC(10,2),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.cashback_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  site TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  is_connected BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_source ON public.products(source);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.scrape_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON public.price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_product_id ON public.price_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_cashback_user_id ON public.cashback_earnings(user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'user'::public.user_role),
    'trial'::public.plan_type
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid()
  AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin')
)
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- user_profiles
DROP POLICY IF EXISTS "users_manage_own_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_profiles" ON public.user_profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.user_profiles;
CREATE POLICY "admin_view_all_profiles" ON public.user_profiles
FOR SELECT TO authenticated USING (public.is_admin_user());

-- products
DROP POLICY IF EXISTS "users_manage_own_products" ON public.products;
CREATE POLICY "users_manage_own_products" ON public.products
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_all_products" ON public.products;
CREATE POLICY "admin_manage_all_products" ON public.products
FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- orders
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
CREATE POLICY "users_manage_own_orders" ON public.orders
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_all_orders" ON public.orders;
CREATE POLICY "admin_manage_all_orders" ON public.orders
FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- scrape_campaigns
DROP POLICY IF EXISTS "users_manage_own_campaigns" ON public.scrape_campaigns;
CREATE POLICY "users_manage_own_campaigns" ON public.scrape_campaigns
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- price_alerts
DROP POLICY IF EXISTS "users_manage_own_alerts" ON public.price_alerts;
CREATE POLICY "users_manage_own_alerts" ON public.price_alerts
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cashback_earnings
DROP POLICY IF EXISTS "users_manage_own_cashback" ON public.cashback_earnings;
CREATE POLICY "users_manage_own_cashback" ON public.cashback_earnings
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- platform_settings (admin only)
DROP POLICY IF EXISTS "admin_manage_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_manage_platform_settings" ON public.platform_settings
FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- api_credentials
DROP POLICY IF EXISTS "users_manage_own_credentials" ON public.api_credentials;
CREATE POLICY "users_manage_own_credentials" ON public.api_credentials
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.scrape_campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.scrape_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- MOCK DATA
-- ============================================================
DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  user_uuid UUID := gen_random_uuid();
  p1 UUID := gen_random_uuid();
  p2 UUID := gen_random_uuid();
  p3 UUID := gen_random_uuid();
  p4 UUID := gen_random_uuid();
  p5 UUID := gen_random_uuid();
  o1 UUID := gen_random_uuid();
  o2 UUID := gen_random_uuid();
  o3 UUID := gen_random_uuid();
  c1 UUID := gen_random_uuid();
  c2 UUID := gen_random_uuid();
BEGIN
  -- Auth users (no 'status' column — removed for Supabase compatibility)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@dropsync.com', crypt('admin123', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Jake Kowalski', 'role', 'admin'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (user_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'user@dropsync.com', crypt('user123', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Sarah Chen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Products
  INSERT INTO public.products (id, user_id, title, source, source_url, source_price, google_lowest_price, margin_pct, category, brand, image_url, rating, free_shipping, gift_receipt, stock, status, cashback_site, cashback_pct)
  VALUES
    (p1, admin_uuid, 'Wireless Earbuds Pro X200', 'aliexpress'::public.product_source, 'https://aliexpress.com/item/earbuds', 12.50, 45.99, 72.8, 'Electronics', 'SoundMax', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', 4.6, true, false, 250, 'pending_review'::public.product_status, 'rakuten', 8.0),
    (p2, admin_uuid, 'Smart LED Strip Lights 5M', 'walmart'::public.product_source, 'https://walmart.com/ip/led-strip', 8.99, 34.99, 74.3, 'Smart Home', 'LightTech', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 4.4, true, true, 180, 'pending_review'::public.product_status, 'topcashback', 6.0),
    (p3, admin_uuid, 'Portable Phone Stand Adjustable', 'aliexpress'::public.product_source, 'https://aliexpress.com/item/stand', 3.20, 18.99, 83.1, 'Electronics', null, 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400', 4.2, true, false, 500, 'listed'::public.product_status, 'rakuten', 5.0),
    (p4, admin_uuid, 'Car Phone Mount Magnetic', 'walmart'::public.product_source, 'https://walmart.com/ip/car-mount', 5.50, 24.99, 78.0, 'Automotive', 'GripPro', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400', 4.5, true, true, 320, 'listed'::public.product_status, 'befrugal', 7.5),
    (p5, admin_uuid, 'Resistance Bands Set 5-Pack', 'rakuten'::public.product_source, 'https://rakuten.com/shop/bands', 6.80, 29.99, 77.3, 'Health', 'FitBand', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', 4.7, true, false, 150, 'pending_review'::public.product_status, 'rakuten', 10.0)
  ON CONFLICT (id) DO NOTHING;

  -- Orders
  INSERT INTO public.orders (id, user_id, product_id, bonanza_order_id, buyer, product_title, source, source_url, buy_price, sell_price, margin, cashback_site, cashback_pct, cashback_earned, status, tracking_number, carrier)
  VALUES
    (o1, admin_uuid, p3, 'BNZ-2024-001', 'Michael Torres', 'Portable Phone Stand Adjustable', 'aliexpress'::public.product_source, 'https://aliexpress.com/item/stand', 3.20, 18.99, 15.79, 'rakuten', 5.0, 0.16, 'shipped'::public.order_status, '1Z999AA10123456784', 'UPS'),
    (o2, admin_uuid, p4, 'BNZ-2024-002', 'Jennifer Walsh', 'Car Phone Mount Magnetic', 'walmart'::public.product_source, 'https://walmart.com/ip/car-mount', 5.50, 24.99, 19.49, 'befrugal', 7.5, 0.41, 'cashback-routing'::public.order_status, '', ''),
    (o3, admin_uuid, p3, 'BNZ-2024-003', 'David Kim', 'Portable Phone Stand Adjustable', 'aliexpress'::public.product_source, 'https://aliexpress.com/item/stand', 3.20, 18.99, 15.79, 'rakuten', 5.0, 0.16, 'delivered'::public.order_status, '9400111899223397658', 'USPS')
  ON CONFLICT (id) DO NOTHING;

  -- Campaigns
  INSERT INTO public.scrape_campaigns (id, user_id, name, source, keywords, min_price, max_price, min_rating, free_shipping, gift_receipt, min_margin, status, last_run_at, products_found, products_profitable, run_count, schedule_interval)
  VALUES
    (c1, admin_uuid, 'AliExpress Electronics Daily', 'aliexpress'::public.product_source, 'wireless earbuds, phone stand, led lights', 5.00, 50.00, 4.0, true, false, 30.0, 'active'::public.campaign_status, now() - interval '2 hours', 312, 14, 47, 'daily'),
    (c2, admin_uuid, 'Walmart Flash Deals', 'walmart'::public.product_source, 'smart home, automotive, kitchen', 3.00, 80.00, 4.2, true, true, 35.0, 'active'::public.campaign_status, now() - interval '6 hours', 87, 6, 12, 'every_6_hours')
  ON CONFLICT (id) DO NOTHING;

  -- Cashback earnings
  INSERT INTO public.cashback_earnings (user_id, order_id, site, amount, status)
  VALUES
    (admin_uuid, o1, 'Rakuten', 0.16, 'confirmed'),
    (admin_uuid, o3, 'Rakuten', 0.16, 'pending'),
    (admin_uuid, null, 'TopCashback', 45.20, 'confirmed'),
    (admin_uuid, null, 'BeFrugal', 32.80, 'confirmed')
  ON CONFLICT (id) DO NOTHING;

  -- Price alerts
  INSERT INTO public.price_alerts (user_id, product_id, alert_type, old_value, new_value, message, is_read)
  VALUES
    (admin_uuid, p1, 'price_change', 12.50, 14.99, 'AliExpress price increased for Wireless Earbuds Pro X200', false),
    (admin_uuid, p2, 'stock_low', 180, 12, 'Low stock alert: Smart LED Strip Lights 5M at Walmart', false),
    (admin_uuid, p3, 'price_change', 3.20, 2.80, 'Price dropped at AliExpress for Portable Phone Stand', false)
  ON CONFLICT (id) DO NOTHING;

  -- Platform settings
  INSERT INTO public.platform_settings (key, value, description)
  VALUES
    ('min_margin_threshold', '30', 'Minimum margin percentage to qualify for review queue'),
    ('auto_list_threshold', '50', 'Margin percentage to auto-approve and list without review'),
    ('price_check_interval', '60', 'How often to check source prices in minutes'),
    ('max_concurrent_scrapers', '5', 'Maximum number of concurrent scraper instances'),
    ('cashback_routing_enabled', 'true', 'Route orders through cashback sites automatically'),
    ('bonanza_auto_sync', 'true', 'Automatically sync price/stock changes to Bonanza listings')
  ON CONFLICT (key) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data error: %', SQLERRM;
END $$;
