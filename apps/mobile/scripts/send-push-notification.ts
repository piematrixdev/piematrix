/**
 * Example: Send push notification to all active users.
 * Deploy as a Supabase Edge Function or run as a cron job.
 *
 * Usage (from Supabase Edge Function):
 *   supabase functions deploy send-sky-notification
 *   supabase functions invoke send-sky-notification
 *
 * Or call the Expo Push API directly from any server.
 */

// This is a reference implementation — deploy as a Supabase Edge Function
// or use it as a template for your notification server.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
}

/**
 * Send push notifications via Expo's push API.
 * Handles batching (Expo accepts up to 100 per request).
 */
async function sendPushNotifications(messages: PushMessage[]) {
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
  }
}

/**
 * Example: Send "Tonight's Sky" notification to all users with active tokens.
 * Call this from a daily cron job at sunset time.
 */
export async function sendNightlySkyNotification(supabaseClient: any) {
  // Get all active push tokens
  const { data: tokens } = await supabaseClient
    .from('push_tokens')
    .select('token')
    .eq('active', true);

  if (!tokens || tokens.length === 0) return;

  const messages: PushMessage[] = tokens.map((t: any) => ({
    to: t.token,
    title: "Tonight's Sky",
    body: 'Clear skies ahead — check what planets and stars are visible tonight.',
    data: { screen: 'skywatch' },
    sound: 'default',
  }));

  await sendPushNotifications(messages);
}
