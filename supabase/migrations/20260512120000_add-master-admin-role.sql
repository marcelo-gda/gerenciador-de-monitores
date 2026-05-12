-- Add master_admin to app_role enum
-- This role has all admin privileges plus exclusive access to MasterSettings
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master_admin';
