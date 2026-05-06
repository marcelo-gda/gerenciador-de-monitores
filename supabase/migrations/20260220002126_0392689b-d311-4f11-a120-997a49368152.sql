
-- 1. Enum for monitor levels
CREATE TYPE public.monitor_level AS ENUM ('mestre', 'pleno', 'junior', 'trainee');

-- 2. Add level column to event_monitors
ALTER TABLE public.event_monitors ADD COLUMN level public.monitor_level DEFAULT NULL;

-- 3. Add description column to events
ALTER TABLE public.events ADD COLUMN description text DEFAULT NULL;

-- 4. Messages table (user → admin inbox)
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can insert their own messages
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND is_approved(auth.uid()));

-- Users can view their own messages
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (sender_id = auth.uid());

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update messages (mark read)
CREATE POLICY "Admins can update messages"
  ON public.messages FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- 5. Event comments table
CREATE TABLE public.event_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

-- Approved users can view comments
CREATE POLICY "Approved users can view comments"
  ON public.event_comments FOR SELECT
  USING (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Approved users can add comments
CREATE POLICY "Approved users can add comments"
  ON public.event_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_approved(auth.uid()));

-- Users can delete own comments, admins can delete any
CREATE POLICY "Users can delete own comments"
  ON public.event_comments FOR DELETE
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
