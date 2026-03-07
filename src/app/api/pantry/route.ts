import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeImageForItems } from "@/lib/ai";
import { calculateExpirationDate, estimateExpiration } from "@/lib/expiration";
import { lookupBarcode } from "@/lib/barcode";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {};
    if (location) where.location = location;
    if (category) where.category = category;

    const items = await prisma.pantryItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  // Handle photo upload for AI analysis
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const location = (formData.get("location") as string) || "Pantry";

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Save the image
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}.jpg`;
    await writeFile(path.join(uploadDir, filename), buffer);
    const imageUrl = `/uploads/${filename}`;

    // Analyze with AI (uses best available provider)
    const analyzedItems = await analyzeImageForItems(base64, location);
    const now = new Date();

    // Save items to database with smart expiration estimates
    const createdItems = await Promise.all(
      analyzedItems.map((item) => {
        const opened = item.opened ?? false;

        // Use label-read date if available and confidence is high, otherwise estimate
        let expDate: Date;
        let reason: string;

        if (item.expirationDateFromLabel && item.confidence >= 0.7) {
          expDate = new Date(item.expirationDateFromLabel);
          reason = `Read from label (confidence: ${(item.confidence * 100).toFixed(0)}%)`;
        } else {
          const estimated = calculateExpirationDate(now, item.name, location, item.category, opened);
          expDate = estimated.date;
          reason = estimated.reason;
        }

        return prisma.pantryItem.create({
          data: {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            location,
            opened,
            expirationDate: expDate,
            expiryEstimateReason: reason,
            purchaseDate: now,
            imageUrl,
          },
        });
      })
    );

    const lowConfidence = analyzedItems.filter((i) => i.confidence < 0.7).length;
    const labelDates = analyzedItems.filter((i) => i.expirationDateFromLabel).length;

    let message = `Found and cataloged ${createdItems.length} items`;
    if (labelDates > 0) message += ` (${labelDates} with dates read from labels)`;
    if (lowConfidence > 0) message += ` — ${lowConfidence} low-confidence items may need review`;

    return NextResponse.json({
      message,
      items: createdItems,
      imageUrl,
    });
  }

  // Handle JSON body (manual entry or barcode)
  const body = await request.json();

  // Barcode lookup
  if (body.barcode) {
    try {
      const product = await lookupBarcode(body.barcode);
      if (!product) {
        return NextResponse.json(
          { error: "Product not found. Try adding it manually." },
          { status: 404 }
        );
      }

      const now = new Date();
      const itemLocation = body.location || "Pantry";
      const estimated = calculateExpirationDate(now, product.name, itemLocation, product.category, false);

      const item = await prisma.pantryItem.create({
        data: {
          name: product.brand ? `${product.brand} ${product.name}` : product.name,
          category: product.category,
          quantity: body.quantity || 1,
          unit: body.unit || "item",
          location: itemLocation,
          opened: false,
          expirationDate: estimated.date,
          expiryEstimateReason: estimated.reason,
          purchaseDate: now,
          imageUrl: product.imageUrl,
          notes: product.ingredients ? `Ingredients: ${product.ingredients.slice(0, 200)}` : null,
        },
      });

      return NextResponse.json(item, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to process barcode. Please try again." },
        { status: 500 }
      );
    }
  }

  // Manual item creation
  const itemName = body.name;
  const itemCategory = body.category || "Other";
  const itemLocation = body.location || "Pantry";
  const opened = body.opened ?? false;

  let expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
  let expiryEstimateReason: string | null = null;

  if (!expirationDate) {
    const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : new Date();
    const estimated = calculateExpirationDate(purchaseDate, itemName, itemLocation, itemCategory, opened);
    expirationDate = estimated.date;
    expiryEstimateReason = estimated.reason;
  }

  const item = await prisma.pantryItem.create({
    data: {
      name: itemName,
      category: itemCategory,
      quantity: body.quantity || 1,
      unit: body.unit || "item",
      location: itemLocation,
      opened,
      expirationDate,
      expiryEstimateReason,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
      notes: body.notes,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.expirationDate !== undefined)
    updateData.expirationDate = data.expirationDate
      ? new Date(data.expirationDate)
      : null;
  if (data.purchaseDate !== undefined)
    updateData.purchaseDate = data.purchaseDate
      ? new Date(data.purchaseDate)
      : null;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.needsRestock !== undefined) updateData.needsRestock = data.needsRestock;
  if (data.expiryEstimateReason !== undefined) updateData.expiryEstimateReason = data.expiryEstimateReason;

  // Handle opened status change - recalculate expiration if toggling opened
  if (data.opened !== undefined) {
    updateData.opened = data.opened;

    if (data.recalculateExpiry) {
      const existing = await prisma.pantryItem.findUnique({ where: { id } });
      if (existing) {
        const baseDate = existing.purchaseDate || existing.createdAt;
        const name = (data.name as string) || existing.name;
        const location = (data.location as string) || existing.location;
        const category = (data.category as string) || existing.category;
        const estimate = estimateExpiration(name, location, category, data.opened);
        const newExpDate = new Date(baseDate);
        newExpDate.setDate(newExpDate.getDate() + estimate.days);
        updateData.expirationDate = newExpDate;
        updateData.expiryEstimateReason = estimate.reason;
      }
    }
  }

  const item = await prisma.pantryItem.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(item);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.pantryItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
