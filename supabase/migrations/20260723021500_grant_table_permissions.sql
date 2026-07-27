-- Fix: Grant table-level privileges on products, orders, and price_alerts to authenticated role
-- Resolves: permission denied for table products / orders / price_alerts (code 42501)

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
