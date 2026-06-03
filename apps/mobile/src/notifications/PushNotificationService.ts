/**
 * PushNotificationService — Handles push notification registration,
 * token storage, and local notification scheduling.
 *
 * - Registers for Expo push tokens
 * - Stores token in Supabase (push_tokens table)
 * - Schedules daily "tonight's sky" local notification at sunset
 * - Handles incoming notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../auth/supabaseClient';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register for push notifications and store the token in Supabase.
 * Call this after the user is authenticated.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  console.log('[Push] Starting registration for user:', userId);

  if (!Device.isDevice) {
    console.log('[Push] Not a physical device — skipping');
    return null;
  }

  // Check/request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[Push] Existing permission status:', existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[Push] Requested permission, got:', status);
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied — cannot register');
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sky-alerts', {
      name: 'Sky Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#d4c5a0',
    });
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId
      ?? '042f458e-668c-449b-b461-635fbd4a6518'; // Fallback: Pie Matrix project ID
    console.log('[Push] Project ID:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;
    console.log('[Push] Got token:', token);

    // Store in Supabase
    const { error } = await supabase.from('push_tokens').upsert({
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' });

    if (error) {
      console.warn('[Push] Failed to save token to DB:', error.message);
    } else {
      console.log('[Push] Token saved to DB successfully');
    }

    return token;
  } catch (e: any) {
    console.warn('[Push] Token registration failed:', e.message, e.code ?? '', JSON.stringify(e).slice(0, 200));
    return null;
  }
}

/**
 * Schedule a daily local notification for "tonight's sky" at a given hour.
 * This runs locally on the device — no server needed.
 */
export async function scheduleDailySkyNotification(hour: number = 19, minute: number = 0) {
  // Cancel existing daily notification (keep event reminders)
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'daily-sky') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  // Schedule daily at the specified time
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tonight\'s Sky',
      body: 'Check what\'s visible tonight — planets, stars, and more await.',
      data: { screen: 'skywatch', type: 'daily-sky' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * Schedule event reminder notifications for upcoming sky events.
 * Schedules a notification 1 hour before each event's date (at sunset - 1hr).
 * Call this periodically (e.g., daily) to keep reminders fresh.
 */
export async function scheduleEventReminders(events: Array<{ id: string; date: string; title: string; type: string }>) {
  // Cancel existing event reminders
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'event-reminder') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  const now = Date.now();

  for (const event of events) {
    // Parse event date and set reminder to 1 hour before sunset (6 PM)
    const eventDate = new Date(event.date);
    eventDate.setHours(18, 0, 0, 0); // Assume sunset ~6 PM
    const reminderTime = eventDate.getTime() - 60 * 60 * 1000; // 1 hour before = 5 PM

    // Only schedule future reminders
    if (reminderTime <= now) continue;

    // Determine notification body based on event type
    const bodies: Record<string, string> = {
      planet: `${event.title} — Look up in about an hour for the best view.`,
      meteor: `${event.title} — Meteor shower peaks tonight. Find a dark spot!`,
      eclipse: `${event.title} — Don't miss this rare event starting soon.`,
      conjunction: `${event.title} — Planets align tonight. Step outside in an hour.`,
      comet: `${event.title} — A comet is visible tonight. Grab your binoculars!`,
      iss: `${event.title} — The ISS passes over soon. Look up!`,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sky Event Reminder',
        body: bodies[event.type] ?? `${event.title} — happening tonight. Don't miss it!`,
        data: { screen: 'calendar', eventId: event.id, type: 'event-reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderTime),
      },
    });
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the count of scheduled notifications (for debugging).
 */
export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
