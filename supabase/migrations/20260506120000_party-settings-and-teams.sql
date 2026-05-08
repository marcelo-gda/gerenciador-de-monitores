
-- party_settings: single-row global configuration
CREATE TABLE public.party_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_emoji text NOT NULL DEFAULT '💰',
  cache_value numeric(10,2) NOT NULL DEFAULT 0,
  incentive_message text NOT NULL DEFAULT '',
  duration_min integer NOT NULL DEFAULT 3,
  duration_max integer NOT NULL DEFAULT 6,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed one default row
INSERT INTO public.party_settings (cache_emoji, cache_value, incentive_message, duration_min, duration_max)
VALUES ('💰', 0, '', 3, 6);

-- teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- team_roles
CREATE TABLE public.team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '👤',
  name text NOT NULL,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.party_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "Authenticated can view party_settings"
  ON public.party_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view teams"
  ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view team_roles"
  ON public.team_roles FOR SELECT TO authenticated USING (true);

-- Write: admin only
CREATE POLICY "Admin can manage party_settings"
  ON public.party_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage teams"
  ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage team_roles"
  ON public.team_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
