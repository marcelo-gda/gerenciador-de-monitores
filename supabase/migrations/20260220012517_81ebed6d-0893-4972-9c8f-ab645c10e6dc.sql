
-- Add recipient_id to messages for bidirectional messaging
ALTER TABLE public.messages ADD COLUMN recipient_id uuid DEFAULT NULL;

-- Allow admins to insert messages (for rejection notifications)
CREATE POLICY "Admins can send messages"
ON public.messages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow users to view messages sent TO them
CREATE POLICY "Users can view received messages"
ON public.messages
FOR SELECT
USING (recipient_id = auth.uid());

-- Allow users to update their received messages (mark as read)
CREATE POLICY "Users can update received messages"
ON public.messages
FOR UPDATE
USING (recipient_id = auth.uid());
