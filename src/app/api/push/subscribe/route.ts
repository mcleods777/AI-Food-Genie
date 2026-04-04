import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Missing subscription data" }, { status: 400 });
    }

    // Upsert: update if endpoint exists, create if not
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { keysP256dh: keys.p256dh, keysAuth: keys.auth },
      create: { endpoint, keysP256dh: keys.p256dh, keysAuth: keys.auth },
    });

    // Enable push in notification preferences
    await prisma.notificationPreference.upsert({
      where: { userId: "default" },
      update: { pushEnabled: true },
      create: { userId: "default", pushEnabled: true },
    });

    return NextResponse.json({ id: subscription.id }, { status: 201 });
  } catch (error) {
    console.error("[push/subscribe] Error:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ message: "Unsubscribed" });
  } catch (error) {
    console.error("[push/unsubscribe] Error:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
