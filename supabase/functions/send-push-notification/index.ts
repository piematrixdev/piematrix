/**
 * Supabase Edge Function: send-push-notification
 *
 * Sends push notifications to all users or specific users via Expo Push API.
 * Called from the admin panel.
 *
 * Deploy:
 *   supabase functions deploy send-push-notification --no-verify-jwt
 *
 * Body:
 *   { "title": "...", "body": "...", "data": { "screen": "skywatch" } }
 *   { "title": "...", "body": "...", "user_ids": ["uuid1", "uuid2"] }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, body, data, user_ids } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get push tokens — either all active or filtered by user_ids
    let query = supabase.from('push_tokens').select('token, user_id').eq('active', true);
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    }
    const { data: tokens, error: tokenError } = await query;

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: tokenError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found', sent: 0 }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Build Expo push messages
    const messages = tokens.map((t: any) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
      data: data ?? { screen: 'home' },
    }));

    // Send in chunks of 100
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        const result = await res.json();
        // Check individual ticket statuses
        if (result.data) {
          for (let j = 0; j < result.data.length; j++) {
            const ticket = result.data[j];
            if (ticket.status === 'ok') {
              sent++;
            } else {
              failed++;
              // Mark invalid tokens for cleanup
              if (ticket.details?.error === 'DeviceNotRegistered') {
                invalidTokens.push(chunk[j].to);
              }
            }
          }
        }
      } else {
        failed += chunk.length;
      }
    }

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
      await supabase
        .from('push_tokens')
        .update({ active: false })
        .in('token', invalidTokens);
    }

    // Log the broadcast
    await supabase.from('email_logs').insert({
      type: 'push-broadcast',
      recipient_email: `${tokens.length} devices`,
      subject: title,
      status: failed === 0 ? 'sent' : 'partial',
      error_message: failed > 0 ? `${failed} failed, ${invalidTokens.length} invalid tokens removed` : null,
      metadata: { body, data, sent, failed, total_tokens: tokens.length },
    });

    return new Response(
      JSON.stringify({
        message: `Push sent to ${sent} devices`,
        sent,
        failed,
        total_tokens: tokens.length,
        invalid_removed: invalidTokens.length,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
