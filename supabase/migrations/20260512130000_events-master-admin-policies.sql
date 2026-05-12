-- Extend events RLS policies to cover master_admin role
-- Depends on: 20260512120000_add-master-admin-role.sql (master_admin enum value)

DROP POLICY IF EXISTS "Approved users can view events" ON public.events;
CREATE POLICY "Approved users can view events"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    public.is_approved(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'master_admin')
  );

DROP POLICY IF EXISTS "Admin and special can create events" ON public.events;
CREATE POLICY "Admin and special can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'master_admin')
    OR public.has_role(auth.uid(), 'special_user')
  );

DROP POLICY IF EXISTS "Admin or creator can update events" ON public.events;
CREATE POLICY "Admin or creator can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'master_admin')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'master_admin')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admin can delete events" ON public.events;
CREATE POLICY "Admin can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'master_admin')
  );
