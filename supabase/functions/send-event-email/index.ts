/**
 * Supabase Edge Function: send-event-email
 *
 * Sends event-related emails:
 * - RSVP confirmation with pass code
 * - Event reminder (1 day before)
 * - Event updates/cancellations
 *
 * Deploy:
 *   supabase functions deploy send-event-email --no-verify-jwt
 *
 * Invoke with body:
 *   { "type": "rsvp-confirmation", "event_id": "...", "user_id": "..." }
 *   { "type": "event-reminder", "event_id": "..." }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = 'Pie Matrix <events@thepiematrix.com>';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, event_id, user_id } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (type === 'rsvp-confirmation' && event_id && user_id) {
      return await sendRsvpConfirmation(supabase, event_id, user_id);
    }

    if (type === 'event-reminder' && event_id) {
      return await sendEventReminder(supabase, event_id);
    }

    return new Response(JSON.stringify({ error: 'Invalid type or missing params' }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

async function sendRsvpConfirmation(supabase: any, eventId: string, userId: string) {
  // Get event details
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });

  // Get RSVP with pass code
  const { data: rsvp } = await supabase
    .from('event_rsvps')
    .select('pass_code')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();
  if (!rsvp) return new Response(JSON.stringify({ error: 'RSVP not found' }), { status: 404, headers: corsHeaders });

  // Get user email
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  if (!user?.email) return new Response(JSON.stringify({ error: 'User email not found' }), { status: 404, headers: corsHeaders });

  // Get user name
  const { data: profile } = await supabase.from('user_profiles').select('display_name').eq('id', userId).single();
  const firstName = profile?.display_name?.split(' ')[0] ?? 'Stargazer';

  const eventDate = new Date(event.event_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const eventTime = new Date(event.event_date).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030308;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#d4c5a0,#b89f72);margin:0 auto 16px;"></div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">You're In!</h1>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:20px;">
      <p style="color:rgba(255,255,255,0.8);font-size:15px;margin:0 0 16px;">Hey ${firstName},</p>
      <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0;">
        You're registered for <strong style="color:#fff;">${event.title}</strong>. Here are your details:
      </p>
    </div>

    <div style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:16px;padding:24px;margin-bottom:20px;">
      <div style="text-align:center;">
        <p style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Your Pass Code</p>
        <p style="color:#4ade80;font-size:28px;font-weight:700;letter-spacing:3px;margin:0;">${rsvp.pass_code.toUpperCase()}</p>
        <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:8px 0 0;">Show this at the event for entry</p>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Date</td><td style="color:#fff;font-size:13px;text-align:right;padding:6px 0;">${eventDate}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Time</td><td style="color:#fff;font-size:13px;text-align:right;padding:6px 0;">${eventTime}</td></tr>
        <tr><td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Location</td><td style="color:#fff;font-size:13px;text-align:right;padding:6px 0;">${event.is_online ? 'Online' : event.location ?? 'TBD'}</td></tr>
        ${event.price > 0 ? `<tr><td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;">Price</td><td style="color:#d4c5a0;font-size:13px;font-weight:700;text-align:right;padding:6px 0;">${event.currency} ${event.price}</td></tr>` : ''}
      </table>
    </div>

    <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">Pie Matrix · Your window to the cosmos</p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: user.email,
      subject: `You're registered: ${event.title}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ message: 'Confirmation sent', email: user.email }), { status: 200, headers: corsHeaders });
}

async function sendEventReminder(supabase: any, eventId: string) {
  // Get event
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: corsHeaders });

  // Get all confirmed RSVPs
  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select('user_id, pass_code')
    .eq('event_id', eventId)
    .eq('status', 'confirmed');

  if (!rsvps || rsvps.length === 0) {
    return new Response(JSON.stringify({ message: 'No RSVPs to remind', sent: 0 }), { status: 200, headers: corsHeaders });
  }

  // Get all user emails
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  if (authUsers?.users) {
    for (const u of authUsers.users) {
      if (u.email) emailMap.set(u.id, u.email);
    }
  }

  const eventDate = new Date(event.event_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  const eventTime = new Date(event.event_date).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });

  let sent = 0;
  for (const rsvp of rsvps) {
    const email = emailMap.get(rsvp.user_id);
    if (!email) continue;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: `Tomorrow: ${event.title}`,
        html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#030308;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#ffffff;font-size:20px;margin:0;">Reminder: ${event.title}</h1>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:8px 0 0;">${eventDate} at ${eventTime}</p>
    </div>
    <div style="background:rgba(212,197,160,0.08);border:1px solid rgba(212,197,160,0.2);border-radius:14px;padding:20px;text-align:center;">
      <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 12px;">Your pass code:</p>
      <p style="color:#d4c5a0;font-size:24px;font-weight:700;letter-spacing:3px;margin:0;">${rsvp.pass_code.toUpperCase()}</p>
    </div>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin-top:20px;">
      ${event.is_online ? 'Join link will be shared before the event.' : `Location: ${event.location ?? 'TBD'}`}
    </p>
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">Pie Matrix</p>
    </div>
  </div>
</body></html>`,
      }),
    });

    if (res.ok) sent++;
    await new Promise((r) => setTimeout(r, 500));
  }

  return new Response(JSON.stringify({ message: `Sent ${sent} reminders`, sent }), { status: 200, headers: corsHeaders });
}
