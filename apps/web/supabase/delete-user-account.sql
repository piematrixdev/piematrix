-- delete_user_account() — Called by the mobile app when the user
-- initiates account deletion from Profile → Delete Account.
--
-- This function:
--   1. Deletes user-owned rows from all public tables
--   2. Deletes the auth.users row (requires service_role or superuser)
--
-- Run this migration once in the Supabase SQL Editor (Dashboard → SQL).
-- The function executes with SECURITY DEFINER so it has the elevated
-- permissions needed to delete from auth.users, but is only callable
-- by the authenticated user (via RLS + auth.uid() check).

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user data from app tables (add your tables here)
  DELETE FROM public.favorites WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  -- Add more table deletions as needed:
  -- DELETE FROM public.user_preferences WHERE user_id = uid;
  -- DELETE FROM public.push_tokens WHERE user_id = uid;

  -- Finally, delete the auth user (requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon, public;
