import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeImageForItems } from "@/lib/ai";
import { calculateExpirationDate } from "@/lib/expiration";
import { lookupBarcode } from "@/lib/barcode";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const items = await prisma.pantryItem.findMany({
      where: { purchaseDate: { not: null } },
      orderBy: { purchaseDate: "desc" },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
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
        const opened = item.opened ?? false;
        const location = ["Dairy", "Meat", "Produce"].includes(item.category)
          ? "Refrigerator"
          : item.category === "Frozen"
            ? "Freezer"
            : "Pantry";

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
            purchaseDate: now,
            expirationDate: expDate,
            expiryEstimateReason: reason,
            imageUrl,
          },
        });
      })
    );

    const labelDates = analyzedItems.filter((i) => i.expirationDateFromLabel).length;
    let message = `Cataloged ${createdItems.length} grocery items with smart expiration estimates`;
    if (labelDates > 0) message += ` (${labelDates} dates read from labels)`;

    return NextResponse.json({ message, items: createdItems, imageUrl });
  }

  // JSON body: manual entry or barcode
  const body = await request.json();

  // Barcode lookup
  if (body.barcode) {
    const product = await lookupBarcode(body.barcode);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found. Try adding it manually." },
        { status: 404 }
      );
    }

    const now = new Date();
    const location = ["Dairy", "Meat", "Produce"].includes(product.category)
      ? "Refrigerator"
      : product.category === "Frozen"
        ? "Freezer"
        : "Pantry";

    const estimated = calculateExpirationDate(now, product.name, location, product.category, false);

    try {
      const item = await prisma.pantryItem.create({
        data: {
          name: product.brand ? `${product.brand} ${product.name}` : product.name,
          category: product.category,
          quantity: body.quantity || 1,
          unit: body.unit || "item",
          location,
          opened: false,
          purchaseDate: now,
          expirationDate: estimated.date,
          expiryEstimateReason: estimated.reason,
          imageUrl: product.imageUrl,
          barcode: body.barcode,
          brand: product.brand,
          ingredients: product.ingredients,
          nutriScore: product.nutriScore,
          novaGroup: product.novaGroup,
        },
      });

      return NextResponse.json(item, { status: 201 });
    } catch (err) {
      console.error("Failed to save barcode product to database:", err);
      return NextResponse.json(
        { error: "Failed to save product. Please try again." },
        { status: 500 }
      );
    }
  }

  // Manual grocery item entry
  const itemName = body.name;
  const itemCategory = body.category || "Other";
  const itemLocation = body.location || "Pantry";
  const now = new Date();

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
