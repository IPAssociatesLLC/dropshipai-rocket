-- Sales Dashboard migration
-- Adds seller_fees column to orders table and creates sales_summary view

-- Add seller_fees column to orders if not exists
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS seller_fees numeric DEFAULT 0;

-- Add bonanza_sale_price column if not exists (the actual price sold on Bonanza)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS bonanza_sale_price numeric DEFAULT 0;

-- Index for date-based queries on orders
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created ON public.orders(user_id, created_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
