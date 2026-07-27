-- Fix: Grant table-level privileges on api_credentials to authenticated role
-- Error: permission denied for table api_credentials (code 42501)

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_credentials TO authenticated;
