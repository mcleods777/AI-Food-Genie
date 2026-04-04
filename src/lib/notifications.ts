import webpush from "web-push";
import { prisma } from "./db";

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:foodgenie@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  actions?: { action: string; title: string }[];
}

/**
 * Send a push notification to all stored subscriptions.
 * Cleans up expired subscriptions (HTTP 410) automatically.
 */
export async function sendPushNotification(payload: PushPayload): Promise<{ sent: number; cleaned: number }> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log("[notifications] VAPID keys not configured, skipping push");
    return { sent: 0, cleaned: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) {
    console.log("[notifications] No push subscriptions found");
    return { sent: 0, cleaned: 0 };
  }

  let sent = 0;
  let cleaned = 0;

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      sent++;
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired or invalid — clean it up
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        cleaned++;
        console.log(`[notifications] Cleaned stale subscription: ${sub.endpoint.slice(0, 50)}...`);
      } else {
        console.error(`[notifications] Push failed for ${sub.endpoint.slice(0, 50)}:`, error);
      }
    }
  }

  return { sent, cleaned };
}

/**
 * Send notification based on user's preferences.
 * Currently push-only. SMS channel deferred.
 */
export async function notifyUser(title: string, body: string, url?: string): Promise<void> {
  // Get or create default preferences
  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId: "default" },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: { userId: "default", pushEnabled: false },
    });
  }

  if (prefs.pushEnabled) {
    const result = await sendPushNotification({
      title,
      body,
      url: url || "/autopilot",
      actions: [
        { action: "accept", title: "Sounds good" },
        { action: "skip", title: "Not tonight" },
      ],
    });
    console.log(`[notifications] Push: ${result.sent} sent, ${result.cleaned} cleaned`);
  } else {
    console.log("[notifications] Push disabled in preferences, skipping");
  }
}
