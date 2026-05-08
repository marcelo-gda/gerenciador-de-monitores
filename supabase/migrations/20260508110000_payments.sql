-- Transport fields on event_monitors
ALTER TABLE public.event_monitors
  ADD COLUMN IF NOT EXISTS transport_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_transport boolean NOT NULL DEFAULT false;

-- PIX key on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_key text;

-- Monthly payment records per monitor
CREATE TABLE IF NOT EXISTS public.monitor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  calculated_amount numeric(10,2) NOT NULL DEFAULT 0,
  admin_amount numeric(10,2),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  paid_at timestamptz,
  monitor_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Monitors can view own payments"
  ON public.monitor_payments FOR SELECT TO authenticated
  USING (monitor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage payments"
  ON public.monitor_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Monitor can confirm own payment"
  ON public.monitor_payments FOR UPDATE TO authenticated
  USING (monitor_id = auth.uid())
  WITH CHECK (monitor_id = auth.uid());
