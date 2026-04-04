import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: "default" },
    });

    if (!prefs) {
      return NextResponse.json({
        pushEnabled: false,
        smsEnabled: false,
        smsPhone: null,
        mealTime: "16:00",
        checkinTime: "09:00",
      });
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[notifications/preferences] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { pushEnabled, smsEnabled, smsPhone, mealTime, checkinTime } = body;

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: "default" },
      update: {
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(smsEnabled !== undefined && { smsEnabled }),
        ...(smsPhone !== undefined && { smsPhone }),
        ...(mealTime !== undefined && { mealTime }),
        ...(checkinTime !== undefined && { checkinTime }),
      },
      create: {
        userId: "default",
        pushEnabled: pushEnabled ?? false,
        smsEnabled: smsEnabled ?? false,
        smsPhone: smsPhone ?? null,
        mealTime: mealTime ?? "16:00",
        checkinTime: checkinTime ?? "09:00",
      },
    });

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("[notifications/preferences] PUT error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
