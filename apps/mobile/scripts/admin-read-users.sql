-- Allow admins to read all user profiles (for the admin Users panel)
-- Run in Supabase SQL Editor

DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
CREATE POLICY "Admins can read all profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (public.is_app_admin());
