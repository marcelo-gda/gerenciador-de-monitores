
-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Service role can insert sync logs" ON public.google_calendar_sync_log;

-- No INSERT policy needed since edge function uses service_role key which bypasses RLS
-- This removes the security warning while maintaining functionality
