
-- Add team number to events (1 or 2)
ALTER TABLE public.events ADD COLUMN team smallint DEFAULT NULL;

-- Add bonus tags to event_monitors (e.g. protagonista, midia, cronista, sentinela, transporte)
ALTER TABLE public.event_monitors ADD COLUMN bonus_tags text[] DEFAULT '{}';
