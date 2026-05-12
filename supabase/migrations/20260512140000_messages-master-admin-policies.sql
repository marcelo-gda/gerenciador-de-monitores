-- Extend messages RLS policies to cover master_admin role
-- Without this, master_admin users cannot see inbox notifications (recipient_id = NULL),
-- mark messages as read, or send rejection notifications.
-- Depends on: 20260512120000_add-master-admin-role.sql

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'master_admin')
  );

DROP POLICY IF EXISTS "Admins can update messages" ON public.messages;
CREATE POLICY "Admins can update messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'master_admin')
  );

DROP POLICY IF EXISTS "Admins can send messages" ON public.messages;
CREATE POLICY "Admins can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'master_admin')
  );
