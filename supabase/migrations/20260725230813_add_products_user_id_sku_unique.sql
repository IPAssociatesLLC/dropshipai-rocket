-- Add unique constraint on (user_id, sku) to support upsert in handleAddToQueue
ALTER TABLE public.products
ADD CONSTRAINT products_user_id_sku_unique UNIQUE (user_id, sku);
