ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS force_available boolean NOT NULL DEFAULT false;
