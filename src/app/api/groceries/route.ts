import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeImageForItems } from "@/lib/ai";
import { calculateExpirationDate } from "@/lib/expiration";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const items = await prisma.pantryItem.findMany({
    where: { purchaseDate: { not: null } },
    orderBy: { purchaseDate: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}.jpg`;
    await writeFile(path.join(uploadDir, filename), buffer);
    const imageUrl = `/uploads/${filename}`;

    const analyzedItems = await analyzeImageForItems(base64, "Grocery Purchase");
    const now = new Date();

    const createdItems = await Promise.all(
      analyzedItems.map((item) => {
        // Grocery purchases are sealed by default (just bought)
        const opened = item.opened ?? false;
        // Default storage location for new groceries: refrigerate perishables, pantry for shelf-stable
        const location = ["Dairy", "Meat", "Produce"].includes(item.category)
          ? "Refrigerator"
          : item.category === "Frozen"
            ? "Freezer"
            : "Pantry";

        const { date: expDate, reason } = calculateExpirationDate(
          now,
          item.name,
          location,
          item.category,
          opened
        );

        return prisma.pantryItem.create({
          data: {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            location,
            opened,
            purchaseDate: now,
            expirationDate: expDate,
            expiryEstimateReason: reason,
            imageUrl,
          },
        });
      })
    );

    return NextResponse.json({
      message: `Cataloged ${createdItems.length} grocery items with smart expiration estimates`,
      items: createdItems,
      imageUrl,
    });
  }

  // Manual grocery item entry
  const body = await request.json();
  const itemName = body.name;
  const itemCategory = body.category || "Other";
  const itemLocation = body.location || "Pantry";
  const now = new Date();

  // Auto-estimate expiration if not provided
  let expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
  let expiryEstimateReason: string | null = null;

  if (!expirationDate) {
    const estimated = calculateExpirationDate(now, itemName, itemLocation, itemCategory, false);
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
      opened: false,
      purchaseDate: now,
      expirationDate,
      expiryEstimateReason,
      notes: body.notes,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
