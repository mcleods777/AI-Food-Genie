import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshMeatPrices } from "@/lib/meat-prices";

export const maxDuration = 60; // Hobby plan allows up to 60s

// Daily meat price refresh, scheduled in vercel.json
export async function GET(request: Request) {
  // Verify cron secret (Vercel auto-sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Idempotency: skip if we already fetched prices today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await prisma.meatPrice.findFirst({
      where: { fetchedAt: { gte: startOfDay } },
    });
    if (existing) {
      return NextResponse.json({ message: "Prices already fetched today", batchId: existing.batchId });
    }

    const result = await refreshMeatPrices();
    return NextResponse.json({ message: "Prices refreshed", ...result });
  } catch (error) {
    console.error("[cron/prices] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
