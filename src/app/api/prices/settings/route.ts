import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUT /api/prices/settings — save zip code for store-accurate pricing
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : "";

    if (zipCode && !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: "Zip code must be 5 digits" },
        { status: 400 }
      );
    }

    const setting = await prisma.priceSetting.upsert({
      where: { userId: "default" },
      update: { zipCode: zipCode || null },
      create: { userId: "default", zipCode: zipCode || null },
    });

    return NextResponse.json({ zipCode: setting.zipCode });
  } catch (error) {
    console.error("[prices/settings] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
