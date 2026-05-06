
-- Add google_event_id to events table for linking with Google Calendar
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS google_event_id text UNIQUE;

-- Create sync log table
CREATE TABLE public.google_calendar_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  events_created integer NOT NULL DEFAULT 0,
  events_updated integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text
);

-- Enable RLS
ALTER TABLE public.google_calendar_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
ON public.google_calendar_sync_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert (edge function)
CREATE POLICY "Service role can insert sync logs"
ON public.google_calendar_sync_log
FOR INSERT
WITH CHECK (true);
