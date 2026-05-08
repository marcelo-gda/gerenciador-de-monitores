-- Add role_id to team_roles (links a team role slot to a special role)
ALTER TABLE public.team_roles
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

-- Add panel configuration columns to party_settings
ALTER TABLE public.party_settings
  ADD COLUMN IF NOT EXISTS teams_section_title text NOT NULL DEFAULT 'Nossas Equipes',
  ADD COLUMN IF NOT EXISTS teams_visible_to text[] NOT NULL DEFAULT '{}';
