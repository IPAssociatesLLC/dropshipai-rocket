-- Google Shopping Feed Migration
-- Adds google_shopping_fields to products table and creates compliance view

-- Add Google Shopping fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS gs_brand TEXT,
ADD COLUMN IF NOT EXISTS gs_upc TEXT,
ADD COLUMN IF NOT EXISTS gs_mpn TEXT,
ADD COLUMN IF NOT EXISTS gs_identifier_exists BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gs_condition TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS gs_google_product_category TEXT,
ADD COLUMN IF NOT EXISTS gs_compliant BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gs_compliance_checked_at TIMESTAMPTZ;

-- Index for compliance queries
CREATE INDEX IF NOT EXISTS idx_products_gs_compliant ON public.products(gs_compliant);
CREATE INDEX IF NOT EXISTS idx_products_user_gs ON public.products(user_id, gs_compliant);

-- Function to auto-fill Google Shopping fields for a product
CREATE OR REPLACE FUNCTION public.compute_gs_compliance(
  p_brand TEXT,
  p_upc TEXT,
  p_mpn TEXT,
  p_image_url TEXT,
  p_category TEXT
)
RETURNS TABLE(
  out_brand TEXT,
  out_upc TEXT,
  out_mpn TEXT,
  out_identifier_exists BOOLEAN,
  out_condition TEXT,
  out_google_product_category TEXT,
  out_compliant BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand TEXT;
  v_upc TEXT;
  v_mpn TEXT;
  v_identifier_exists BOOLEAN;
  v_compliant BOOLEAN;
BEGIN
  -- Brand: use provided or fallback
  v_brand := CASE WHEN p_brand IS NOT NULL AND trim(p_brand) <> '' THEN trim(p_brand) ELSE 'brand not available' END;
  -- UPC: use provided or fallback
  v_upc := CASE WHEN p_upc IS NOT NULL AND trim(p_upc) <> '' THEN trim(p_upc) ELSE 'brand not available' END;
  -- MPN: use provided or NULL
  v_mpn := CASE WHEN p_mpn IS NOT NULL AND trim(p_mpn) <> '' THEN trim(p_mpn) ELSE NULL END;
  -- identifier_exists: false when both UPC and MPN are missing/fallback
  v_identifier_exists := NOT (v_upc = 'brand not available' AND v_mpn IS NULL);
  -- compliant: brand filled, upc filled, condition set, image present, category set
  v_compliant := (
    v_brand IS NOT NULL AND
    v_upc IS NOT NULL AND
    p_image_url IS NOT NULL AND trim(p_image_url) <> '' AND
    p_category IS NOT NULL AND trim(p_category) <> ''
  );

  RETURN QUERY SELECT
    v_brand,
    v_upc,
    v_mpn,
    v_identifier_exists,
    'new'::TEXT,
    COALESCE(p_category, 'Uncategorized'),
    v_compliant;
END;
$$;

-- Backfill existing products with Google Shopping fields
DO $$
DECLARE
  r RECORD;
  v_brand TEXT;
  v_upc TEXT;
  v_mpn TEXT;
  v_identifier_exists BOOLEAN;
  v_compliant BOOLEAN;
BEGIN
  FOR r IN SELECT id, brand, upc, sku, image_url, category FROM public.products LOOP
    v_brand := CASE WHEN r.brand IS NOT NULL AND trim(r.brand) <> '' THEN trim(r.brand) ELSE 'brand not available' END;
    v_upc := CASE WHEN r.upc IS NOT NULL AND trim(r.upc) <> '' THEN trim(r.upc) ELSE 'brand not available' END;
    v_mpn := CASE WHEN r.sku IS NOT NULL AND trim(r.sku) <> '' THEN 'MPN-' || trim(r.sku) ELSE NULL END;
    v_identifier_exists := NOT (v_upc = 'brand not available' AND v_mpn IS NULL);
    v_compliant := (
      r.image_url IS NOT NULL AND trim(r.image_url) <> '' AND
      r.category IS NOT NULL AND trim(r.category) <> ''
    );

    UPDATE public.products SET
      gs_brand = v_brand,
      gs_upc = v_upc,
      gs_mpn = v_mpn,
      gs_identifier_exists = v_identifier_exists,
      gs_condition = 'new',
      gs_google_product_category = COALESCE(r.category, 'Uncategorized'),
      gs_compliant = v_compliant,
      gs_compliance_checked_at = now()
    WHERE id = r.id;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Backfill failed: %', SQLERRM;
END $$;
