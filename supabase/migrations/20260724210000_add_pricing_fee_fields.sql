-- Add fee fields to pricing_rules table and review_count to products table
-- These fields are used by the Product Review page to calculate real sell prices and margins

-- Add fee/profit fields to pricing_rules
ALTER TABLE public.pricing_rules
ADD COLUMN IF NOT EXISTS marketplace_fee_type TEXT DEFAULT 'percent',
ADD COLUMN IF NOT EXISTS marketplace_fee NUMERIC DEFAULT 3.5,
ADD COLUMN IF NOT EXISTS paypal_fee_type TEXT DEFAULT 'percent',
ADD COLUMN IF NOT EXISTS paypal_fee NUMERIC DEFAULT 2.9,
ADD COLUMN IF NOT EXISTS shipping_fee_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_profit_type TEXT DEFAULT 'percent',
ADD COLUMN IF NOT EXISTS min_profit NUMERIC DEFAULT 15,
ADD COLUMN IF NOT EXISTS max_profit_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS max_profit NUMERIC;

-- Add review_count (orders count from AliExpress) to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
