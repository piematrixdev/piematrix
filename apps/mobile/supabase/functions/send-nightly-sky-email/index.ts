/**
 * Supabase Edge Function: send-nightly-sky-email
 * 
 * Sends a daily "Tonight's Sky" email to opted-in users via Resend.
 * Triggered by a cron job (Supabase pg_cron) or manual invocation.
 * 
 * Environment variables needed:
 *   RESEND_API_KEY — your Resend API key
 *   SUPABASE_URL — auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided
 * 
 * Deploy: supabase functions deploy send-nightly-sky-email
 * Cron: SELECT cron.schedule('nightly-sky-email', '0 17 * * *', $$SELECT net.http_post(...)$$);
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_EMAIL = 'Pie Matrix <sky@piematrix.com>';

// Simplified planet visibility for email (no heavy astronomy lib needed)
function getPlanetsTonight(): string[] {
  const month = new Date().getMonth();
  // Rough visibility by season — good enough for email highlights
  const always = ['Jupiter', 'Saturn'];
  if (month >= 2 && month <= 7) return [...always, 'Venus', 'Mars'];
  if (month >= 8 && month <= 10) return [...always, 'Mars'];
  return [...always, 'Venus'];
}

function getMoonPhase(): { name: string; emoji: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  // Simplified moon phase calculation
  const c = Math.floor(365.25 * year) + Math.floor(30.6 * month) + day - 694039.09;
  const phase = (c / 29.53) % 1;
  if (phase < 0.03 || phase > 0.97) return { name: 'New Moon', emoji: '🌑' };
  if (phase < 0.22) return { name: 'Waxing Crescent', emoji: '🌒' };
  if (phase < 0.28) return { name: 'First Quarter', emoji: '🌓' };
  if (phase < 0.47) return { name: 'Waxing Gibbous', emoji: '🌔' };
  if (phase < 0.53) return { name: 'Full Moon', emoji: '🌕' };
  if (phase < 0.72) return { name: 'Waning Gibbous', emoji: '🌖' };
  if (phase < 0.78) return { name: 'Last Quarter', emoji: '🌗' };
  return { name: 'Waning Crescent', emoji: '🌘' };
}

function buildEmailHtml(userName: string): string {
  const planets = getPlanetsTonight();
  const moon = getMoonPhase();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isDarkMoon = moon.name.includes('New') || moon.name.includes('Crescent');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#030308;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:28px;margin:0;">Tonight's Sky</h1>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:8px 0 0;">${dateStr}</p>
    </div>

    <!-- Greeting -->
    <p style="color:rgba(255,255,255,0.8);font-size:16px;line-height:1.5;">
      Hey ${userName} 👋
    </p>
    <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
      Here's what's visible in your sky tonight. ${isDarkMoon ? 'Dark skies tonight — perfect for deep sky objects!' : ''}
    </p>

    <!-- Moon Phase -->
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin:24px 0;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:36px;">${moon.emoji}</span>
        <div>
          <p style="color:#fff;font-size:16px;font-weight:700;margin:0;">${moon.name}</p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:4px 0 0;">
            ${isDarkMoon ? 'Excellent conditions for stargazing' : 'Moonlight may wash out faint objects'}
          </p>
        </div>
      </div>
    </div>

    <!-- Planets -->
    <h2 style="color:#d4c5a0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:28px 0 12px;">Visible Planets</h2>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${planets.map(p => `
        <span style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:8px 16px;color:#4ade80;font-size:13px;font-weight:600;">
          🪐 ${p}
        </span>
      `).join('')}
    </div>

    <!-- Tips -->
    <div style="background:rgba(212,197,160,0.08);border:1px solid rgba(212,197,160,0.15);border-radius:16px;padding:20px;margin:28px 0;">
      <p style="color:#d4c5a0;font-size:13px;font-weight:700;margin:0 0 8px;">💡 Tonight's Tip</p>
      <p style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.5;margin:0;">
        ${isDarkMoon 
          ? 'With minimal moonlight, try spotting the Milky Way band. Look south after 10 PM for the best view.'
          : `The ${moon.name.toLowerCase()} rises in the east. Use it as a reference point to find nearby planets.`
        }
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://thepiematrix.com" style="display:inline-block;background:#d4c5a0;color:#030308;font-size:14px;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;">
        Open Pie Matrix
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">
        Pie Matrix Innovations Pvt Ltd · Delhi, India
      </p>
      <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:8px 0 0;">
        You're receiving this because you enabled sky notifications.
        <a href="https://thepiematrix.com/unsubscribe" style="color:rgba(255,255,255,0.3);">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

async function sendEmail(to: string, userName: string): Promise<boolean> {
  const html = buildEmailHtml(userName);
  const now = new Date();
  const subject = `🌌 Tonight's Sky — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  return res.ok;
}

serve(async (req) => {
  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch users who opted in for email notifications
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('email_notifications', true);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscribers', sent: 0 }));
    }

    // Get emails from auth.users
    const userIds = profiles.map(p => p.id);
    const { data: users } = await supabase.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    for (const u of users?.users ?? []) {
      if (u.email && userIds.includes(u.id)) {
        emailMap.set(u.id, u.email);
      }
    }

    let sent = 0;
    let failed = 0;

    for (const profile of profiles) {
      const email = emailMap.get(profile.id);
      if (!email) continue;

      const success = await sendEmail(email, profile.display_name ?? 'Stargazer');
      if (success) sent++;
      else failed++;

      // Rate limit: 2 emails per second (Resend free tier)
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ sent, failed, total: profiles.length }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
