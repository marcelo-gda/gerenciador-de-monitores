
-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'special_user', 'normal_user');

-- 2. Create enum for user status
CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');

-- 3. Create enum for event type
CREATE TYPE public.event_type AS ENUM ('sun', 'moon', 'camp');

-- 4. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  status public.user_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create user_roles table (roles MUST be separate per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT NOT NULL DEFAULT '☀️',
  type public.event_type NOT NULL DEFAULT 'sun',
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  address TEXT NOT NULL,
  total_slots INT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 7. Create event_monitors junction table
CREATE TABLE public.event_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_monitors ENABLE ROW LEVEL SECURITY;

-- 8. Security definer helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 9. Security definer helper: is_approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND status = 'approved'
  )
$$;

-- 10. Security definer helper: get_monitor_count
CREATE OR REPLACE FUNCTION public.get_monitor_count(_event_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.event_monitors WHERE event_id = _event_id
$$;

-- 11. Security definer helper: get_total_slots
CREATE OR REPLACE FUNCTION public.get_total_slots(_event_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT total_slots FROM public.events WHERE id = _event_id
$$;

-- 12. Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  -- Default role: normal_user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'normal_user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. RLS Policies for profiles
-- Everyone authenticated can see approved profiles
CREATE POLICY "Anyone can view approved profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (status = 'approved' OR id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No direct insert needed (trigger handles it)

-- Admin can delete profiles
CREATE POLICY "Admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 15. RLS Policies for user_roles
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 16. RLS Policies for events
-- Approved users can see all events
CREATE POLICY "Approved users can view events"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Admin and special_user can create events
CREATE POLICY "Admin and special can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'special_user')
  );

-- Admin can update any event, special_user own events
CREATE POLICY "Admin or creator can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR created_by = auth.uid()
  );

-- Only admin can delete events
CREATE POLICY "Admin can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 17. RLS Policies for event_monitors
-- Approved users can view monitors for events
CREATE POLICY "Approved users can view event monitors"
  ON public.event_monitors FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Approved users can join events (if not locked)
CREATE POLICY "Approved users can join events"
  ON public.event_monitors FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'special_user')
      OR (user_id = auth.uid() AND public.is_approved(auth.uid()))
    )
  );

-- Admin or self can remove from event
CREATE POLICY "Admin or self can leave events"
  ON public.event_monitors FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
  );

-- Enable realtime for events and event_monitors
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_monitors;
