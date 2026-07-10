import { NextResponse } from "next/server";
import { refreshMeatPrices } from "@/lib/meat-prices";

export const maxDuration = 60; // Two grounded Gemini calls can take ~30-45s

// POST /api/prices/refresh — manual refresh from the Prices page
export async function POST() {
  try {
    const result = await refreshMeatPrices();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[prices/refresh] Error:", error);
    return NextResponse.json({ error: "Price refresh failed" }, { status: 500 });
  }
}
