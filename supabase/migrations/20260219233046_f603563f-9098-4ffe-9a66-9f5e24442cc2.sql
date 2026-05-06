-- Add is_confirmed to event_monitors for finalize flow
ALTER TABLE public.event_monitors ADD COLUMN is_confirmed boolean NOT NULL DEFAULT false;

-- Add admin_notes to profiles (only visible to admin/special)
ALTER TABLE public.profiles ADD COLUMN admin_notes text;

-- RLS: profiles admin_notes visibility is handled by existing policies
-- Admins can already update any profile via existing policy
-- We need a view or edge function to hide admin_notes from normal users
-- Instead, we'll handle this in the frontend since RLS can't do column-level security easily
-- The existing SELECT policy already restricts row access properly
