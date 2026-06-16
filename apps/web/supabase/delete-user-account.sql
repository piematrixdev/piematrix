-- delete_user_account() — Called by the mobile app when the user
-- initiates account deletion from Profile → Delete Account.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL).
-- The function executes with SECURITY DEFINER so it has the elevated
-- permissions needed to delete from auth.users, but is only callable
-- by the authenticated user (via auth.uid() check).

DROP FUNCTION IF EXISTS public.delete_user_account();

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete the auth user. If you have tables with user_id foreign keys,
  -- either set them to ON DELETE CASCADE or add explicit DELETE statements
  -- here before the auth.users deletion:
  --   DELETE FROM public.favorites WHERE user_id = auth.uid();
  --   DELETE FROM public.profiles WHERE id = auth.uid();

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon, public;
