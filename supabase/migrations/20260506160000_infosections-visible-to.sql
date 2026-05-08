-- Add per-panel visibility control to info_sections
ALTER TABLE public.info_sections
  ADD COLUMN IF NOT EXISTS visible_to text[] NOT NULL DEFAULT '{}';
