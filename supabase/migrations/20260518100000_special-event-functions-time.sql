ALTER TABLE public.special_event_functions
  ADD COLUMN IF NOT EXISTS time_start time,
  ADD COLUMN IF NOT EXISTS time_end time;
