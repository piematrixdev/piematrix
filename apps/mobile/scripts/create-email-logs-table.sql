-- Email logs table for tracking all sent emails
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,                -- 'nightly-sky', 'event-rsvp', 'event-reminder', 'test'
  recipient_email TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  metadata JSONB DEFAULT '{}',       -- extra info (event_id, user_id, etc.)
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
DROP POLICY IF EXISTS "Admins can read email logs" ON public.email_logs;
CREATE POLICY "Admins can read email logs" ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- Service role inserts (Edge Functions use service role)
DROP POLICY IF EXISTS "Service can insert logs" ON public.email_logs;
CREATE POLICY "Service can insert logs" ON public.email_logs
  FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
