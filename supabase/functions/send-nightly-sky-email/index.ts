/**
 * Supabase Edge Function: send-nightly-sky-email
 *
 * Sends a branded "Tonight's Sky" email to all users who have
 * email_notifications enabled. Triggered daily via pg_cron or
 * manual invocation from the admin panel.
 *
 * Deploy:
 *   supabase functions deploy send-nightly-sky-email --no-verify-jwt
 *
 * Set secrets:
 *   supabase secrets set RESEND_API_KEY=re_xxxxx
 *
 * Test:
 *   supabase functions invoke send-nightly-sky-email
 *
 * Schedule (run in SQL Editor):
 *   SELECT cron.schedule(
 *     'nightly-sky-email',
 *     '0 13 * * *',  -- 1 PM UTC = ~6:30 PM IST (before sunset)
 *     $$SELECT net.http_post(
 *       url := 'https://gmsylfwpftqdlzoboqqr.supabase.co/functions/v1/send-nightly-sky-email',
 *       headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
 *       body := '{}'::jsonb
 *     );$$
 *   );
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
const FROM_EMAIL = 'Pie Matrix <sky@thepiematrix.com>';

interface UserRow {
  id: string;
  display_name: string | null;
  email_notifications: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const testEmail = body?.test_email;

    // Use service role to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // If test_email is provided, send only to that address
    if (testEmail) {
      const testSubject = `[TEST] Tonight's Sky — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
      const html = generateEmailHtml('Stargazer', null);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: testEmail,
          subject: testSubject,
          html,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        await supabase.from('email_logs').insert({ type: 'test', recipient_email: testEmail, subject: testSubject, status: 'failed', error_message: err });
        return new Response(JSON.stringify({ error: err }), { status: 500, headers: corsHeaders });
      }
      await supabase.from('email_logs').insert({ type: 'test', recipient_email: testEmail, subject: testSubject, status: 'sent' });
      return new Response(JSON.stringify({ message: `Test sent to ${testEmail}`, sent: 1 }), { status: 200, headers: corsHeaders });
    }

    // Get all users with email notifications enabled
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, display_name, email_notifications')
      .eq('email_notifications', true);

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: corsHeaders });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscribers', sent: 0 }), { status: 200, headers: corsHeaders });
    }

    // Get user emails from auth.users (service role required)
    const userIds = profiles.map((p: UserRow) => p.id);
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        if (u.email && userIds.includes(u.id)) {
          emailMap.set(u.id, u.email);
        }
      }
    }

    // Get tonight's sky events (if any)
    const today = new Date().toISOString().split('T')[0];
    const { data: events } = await supabase
      .from('sky_events')
      .select('title, description, type')
      .eq('date', today)
      .limit(3);

    // Build email content
    const eventSection = events && events.length > 0
      ? events.map((e: any) => `• ${e.title}${e.description ? ' — ' + e.description.slice(0, 80) : ''}`).join('\n')
      : null;

    let sent = 0;
    const errors: string[] = [];

    // Send emails in batches
    for (const profile of profiles as UserRow[]) {
      const email = emailMap.get(profile.id);
      if (!email) continue;

      const firstName = profile.display_name?.split(' ')[0] ?? 'Stargazer';

      const htmlBody = generateEmailHtml(firstName, eventSection);

      const emailSubject = `Tonight's Sky — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: emailSubject,
          html: htmlBody,
        }),
      });

      if (res.ok) {
        sent++;
        // Log success
        await supabase.from('email_logs').insert({
          type: 'nightly-sky', recipient_email: email, subject: emailSubject,
          status: 'sent', metadata: { user_id: profile.id },
        });
      } else {
        const err = await res.text();
        errors.push(`${email}: ${err}`);
        // Log failure
        await supabase.from('email_logs').insert({
          type: 'nightly-sky', recipient_email: email, subject: emailSubject,
          status: 'failed', error_message: err, metadata: { user_id: profile.id },
        });
      }

      // Rate limit: 2 emails per second (Resend free tier)
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sent} emails`, sent, errors: errors.slice(0, 5) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

function generateEmailHtml(firstName: string, eventSection: string | null): string {
  const year = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>Tonight's Sky - Pie Matrix</title>
  <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f4f4f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Preheader text (hidden, shows in inbox preview) -->
  <div style="display:none;font-size:1px;color:#f4f4f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your evening sky briefing — see what's visible tonight from your location.
  </div>

  <!-- Wrapper table for full-width background -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1a1a2e;">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Main content table -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background-color:#0d0d1a;border-radius:16px;overflow:hidden;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:36px 24px 20px;">
              <img src="https://gmsylfwpftqdlzoboqqr.supabase.co/storage/v1/object/public/app-assets/pie-matrix-logo.png" alt="Pie Matrix" width="48" height="48" style="display:block;border:0;border-radius:12px;" />
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding:0 24px 8px;">
              <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Tonight's Sky</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px;">
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#8a8a9a;">${dateStr}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:0 28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <tr>
                  <td style="padding:22px 20px;">
                    <p style="margin:0 0 12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#e0e0e0;">Hey ${firstName},</p>
                    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#a0a0b0;line-height:1.7;">Step outside tonight and look up. The sky has something for you — whether it's a bright planet, a familiar constellation, or just the quiet beauty of the stars.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${eventSection ? `
          <!-- Tonight's Highlights -->
          <tr>
            <td style="padding:0 28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:rgba(212,197,160,0.06);border:1px solid rgba(212,197,160,0.12);border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#d4c5a0;letter-spacing:1px;text-transform:uppercase;">Tonight's Highlights</p>
                    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#c0c0d0;line-height:1.9;white-space:pre-line;">${eventSection}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:8px 28px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#d4c5a0;border-radius:10px;">
                    <a href="https://thepiematrix.com/app" style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0d0d1a;text-decoration:none;border-radius:10px;">Open Sky View</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 28px;">
              <div style="height:1px;background-color:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 28px 32px;">
              <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#6a6a7a;">
                Pie Matrix Innovations Pvt. Ltd.<br />
                Bangalore, India
              </p>
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#4a4a5a;">
                You're receiving this because you enabled sky notifications in the Pie Matrix app.<br />
                <a href="https://thepiematrix.com/unsubscribe" style="color:#8a8a9a;text-decoration:underline;">Unsubscribe</a> · <a href="https://thepiematrix.com/privacy" style="color:#8a8a9a;text-decoration:underline;">Privacy Policy</a>
              </p>
              <p style="margin:12px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:#3a3a4a;">
                &copy; ${year} Pie Matrix. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- End main content -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}
