-- Add message_type and related_user_id to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS related_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Updated handle_new_user trigger: create profile + notify admin inbox
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
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'normal_user');

  -- Notify admins: recipient_id = NULL → general admin inbox
  INSERT INTO public.messages (sender_id, recipient_id, content, message_type, related_user_id)
  VALUES (
    NEW.id,
    NULL,
    '🆕 Nova solicitação de cadastro de ' || COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    'pending_approval',
    NEW.id
  );

  RETURN NEW;
END;
$$;
