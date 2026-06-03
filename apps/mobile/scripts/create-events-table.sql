-- Events/Activities table — admin-managed events users can RSVP to
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  location_url TEXT,
  image_url TEXT,
  type TEXT DEFAULT 'stargazing' CHECK (type IN ('stargazing', 'workshop', 'webinar', 'meetup', 'launch', 'observation', 'other')),
  max_capacity INTEGER,
  price DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  is_online BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event RSVPs / registrations
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waitlisted')),
  pass_code TEXT DEFAULT encode(gen_random_bytes(6), 'hex'),  -- unique pass code
  registered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Events: public read, admin write
DROP POLICY IF EXISTS "Public can read active events" ON public.events;
CREATE POLICY "Public can read active events" ON public.events
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- RSVPs: users can read/create/cancel their own
DROP POLICY IF EXISTS "Users can read own RSVPs" ON public.event_rsvps;
CREATE POLICY "Users can read own RSVPs" ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can RSVP" ON public.event_rsvps;
CREATE POLICY "Users can RSVP" ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can cancel RSVP" ON public.event_rsvps;
CREATE POLICY "Users can cancel RSVP" ON public.event_rsvps
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can see all RSVPs (for managing events)
DROP POLICY IF EXISTS "Admins can read all RSVPs" ON public.event_rsvps;
CREATE POLICY "Admins can read all RSVPs" ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_active ON public.events(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.event_rsvps(user_id);

CREATE OR REPLACE FUNCTION public.event_rsvp_count(event_row public.events)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::integer FROM public.event_rsvps
  WHERE event_id = event_row.id AND status = 'confirmed';
$$;
