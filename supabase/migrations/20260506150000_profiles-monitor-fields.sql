-- Add multi-value profile fields (replacing single FK references)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS identity text,
  ADD COLUMN IF NOT EXISTS hierarchy_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS role_ids uuid[] NOT NULL DEFAULT '{}';

-- Remove old single-value FK columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS hierarchy_id,
  DROP COLUMN IF EXISTS role_id;

-- Admin-only RPC to read auth user emails
CREATE OR REPLACE FUNCTION public.get_profile_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT id::uuid, email::text FROM auth.users;
END;
$$;
