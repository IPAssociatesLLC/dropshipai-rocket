-- Fix platform_settings RLS: allow all authenticated users to read settings
-- Admins retain full write access via existing policy

-- Drop the existing all-operations admin policy
DROP POLICY IF EXISTS "admin_manage_platform_settings" ON public.platform_settings;

-- Allow all authenticated users to SELECT platform settings
DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON public.platform_settings;
CREATE POLICY "authenticated_read_platform_settings" ON public.platform_settings
FOR SELECT TO authenticated USING (true);

-- Only admins can INSERT, UPDATE, DELETE platform settings
DROP POLICY IF EXISTS "admin_write_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_write_platform_settings" ON public.platform_settings
FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
