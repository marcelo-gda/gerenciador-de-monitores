-- Allow admins to update event_monitors (e.g., set is_confirmed)
CREATE POLICY "Admin can update event monitors"
ON public.event_monitors
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));