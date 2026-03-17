import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readExpirationDate } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;
  const itemId = formData.get("itemId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  if (!itemId) {
    return NextResponse.json({ error: "No item ID provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");

  const result = await readExpirationDate(base64);

  if (!result.date) {
    return NextResponse.json({
      success: false,
      message: "Could not read an expiration date from the photo. Try again or enter manually.",
      confidence: result.confidence,
      rawText: result.rawText,
    });
  }

  // Update the item's expiration date
  await prisma.pantryItem.update({
    where: { id: itemId },
    data: {
      expirationDate: new Date(result.date),
      expiryEstimateReason: `Read from label photo${result.rawText ? ` ("${result.rawText}")` : ""} — confidence: ${(result.confidence * 100).toFixed(0)}%`,
    },
  });

  return NextResponse.json({
    success: true,
    date: result.date,
    confidence: result.confidence,
    rawText: result.rawText,
  });
}
