CREATE TABLE public.special_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.special_event_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  special_event_id uuid REFERENCES public.special_events(id) ON DELETE CASCADE,
  date date NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE public.special_event_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid REFERENCES public.special_event_days(id) ON DELETE CASCADE,
  emoji text DEFAULT '⭐',
  name text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  max_monitors int DEFAULT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE public.special_event_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id uuid REFERENCES public.special_event_functions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'volunteer',
  created_at timestamptz DEFAULT now(),
  UNIQUE(function_id, user_id)
);

-- RLS
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view special events"
  ON public.special_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view special event days"
  ON public.special_event_days FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view special event functions"
  ON public.special_event_functions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view special event assignments"
  ON public.special_event_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage special events"
  ON public.special_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "Admin can manage special event days"
  ON public.special_event_days FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "Admin can manage special event functions"
  ON public.special_event_functions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "Admin can manage special event assignments"
  ON public.special_event_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "Monitor can manage own assignments"
  ON public.special_event_assignments FOR ALL TO authenticated
  USING (auth.uid() = user_id);
