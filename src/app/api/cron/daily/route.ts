import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyAssignment, getFallbackMeal } from "@/lib/ai";
import { notifyUser } from "@/lib/notifications";

export const maxDuration = 60; // Hobby plan allows up to 60s

export async function GET(request: Request) {
  // Verify cron secret (Vercel auto-sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if assignment already exists for today (idempotency)
    const existing = await prisma.dailyAssignment.findUnique({
      where: { date: today },
    });
    if (existing) {
      return NextResponse.json({ message: "Assignment already exists for today", assignment: existing });
    }

    // 1. Query expiring pantry items (within 3 days)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const allItems = await prisma.pantryItem.findMany();
    const expiringItems = allItems
      .filter(item => {
        if (!item.expirationDate) return false;
        const expDate = new Date(item.expirationDate);
        return expDate >= now && expDate <= threeDaysFromNow;
      })
      .map(item => ({
        name: item.name,
        daysLeft: Math.ceil((new Date(item.expirationDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));

    // 2. Query recent assignments for dedup
    const recentAssignments = await prisma.dailyAssignment.findMany({
      orderBy: { date: "desc" },
      take: 7,
    });
    const recentMealNames = recentAssignments.map(a => a.mealName);

    // 3. Query household config
    const household = await prisma.householdConfig.findFirst({
      where: { isDefault: true },
    });
    const scenario = household?.scenario || "solo";
    const headcount = household?.headcount || 1;

    // 4. Generate meal assignment
    const allItemNames = allItems.map(i => i.name);
    let meal;
    try {
      meal = await generateDailyAssignment(expiringItems, allItemNames, recentMealNames, scenario, headcount);
    } catch {
      meal = getFallbackMeal(recentMealNames);
    }

    // 5. Create DailyAssignment record
    const assignment = await prisma.dailyAssignment.create({
      data: {
        date: today,
        mealName: meal.mealName,
        ingredients: meal.ingredients,
        steps: meal.steps,
        prepMinutes: meal.prepMinutes,
        usesExpiring: meal.usesExpiring,
        reason: meal.reason,
        status: "pending",
      },
    });

    // 6. Send push notification
    const expiringNote = meal.usesExpiring.length > 0
      ? ` Uses your ${meal.usesExpiring[0]} before it expires.`
      : "";
    await notifyUser(
      `Tonight: ${meal.mealName}`,
      `${meal.prepMinutes} min · ${meal.ingredients.length} ingredients.${expiringNote}`
    );

    // 7. Update urgencyNotifiedAt for expiring items
    if (expiringItems.length > 0) {
      const expiringNames = expiringItems.map(i => i.name);
      await prisma.pantryItem.updateMany({
        where: { name: { in: expiringNames } },
        data: { urgencyNotifiedAt: now },
      });
    }

    return NextResponse.json({
      message: "Assignment created",
      assignment,
      expiringItems: expiringItems.length,
      notificationSent: true,
    });
  } catch (error) {
    console.error("[cron/daily] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
