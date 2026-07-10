import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GRADE_RANK, MEAT_CUTS, STORES } from "@/lib/meat-prices";

// GET /api/prices — latest price batch + settings + catalog metadata
export async function GET() {
  try {
    const latest = await prisma.meatPrice.findFirst({
      orderBy: { fetchedAt: "desc" },
    });

    const prices = latest
      ? await prisma.meatPrice.findMany({
          where: { batchId: latest.batchId },
          orderBy: [{ cut: "asc" }, { pricePerLb: "asc" }],
        })
      : [];

    const setting = await prisma.priceSetting.findUnique({
      where: { userId: "default" },
    });

    return NextResponse.json({
      prices,
      lastFetched: latest?.fetchedAt ?? null,
      zipCode: setting?.zipCode ?? null,
      cuts: MEAT_CUTS,
      stores: STORES,
      gradeRank: GRADE_RANK,
    });
  } catch (error) {
    console.error("[prices] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
