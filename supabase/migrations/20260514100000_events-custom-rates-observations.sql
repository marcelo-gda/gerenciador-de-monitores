ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS custom_rates jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS observations text;
