import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeImageForItems } from "@/lib/ai";
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

    const createdItems = await Promise.all(
      analyzedItems.map((item) =>
        prisma.pantryItem.create({
          data: {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            location: "Pantry", // default location; user can move them
            purchaseDate: new Date(),
            expirationDate: item.estimatedExpiration
              ? new Date(item.estimatedExpiration)
              : null,
            imageUrl,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Cataloged ${createdItems.length} grocery items`,
      items: createdItems,
      imageUrl,
    });
  }

  // Manual grocery item entry
  const body = await request.json();
  const item = await prisma.pantryItem.create({
    data: {
      name: body.name,
      category: body.category || "Other",
      quantity: body.quantity || 1,
      unit: body.unit || "item",
      location: body.location || "Pantry",
      purchaseDate: new Date(),
      expirationDate: body.expirationDate
        ? new Date(body.expirationDate)
        : null,
      notes: body.notes,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
