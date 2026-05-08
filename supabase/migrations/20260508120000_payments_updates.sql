-- Idempotent supplement: ensures monitor_confirmed column exists
-- (already included in 20260508110000_payments.sql, this is a safety net)
ALTER TABLE public.monitor_payments
  ADD COLUMN IF NOT EXISTS monitor_confirmed boolean NOT NULL DEFAULT false;
