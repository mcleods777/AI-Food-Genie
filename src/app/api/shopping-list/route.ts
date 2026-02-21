import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.shoppingListItem.findMany({
    include: { pantryItem: true },
    orderBy: [{ checked: "asc" }, { category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Generate from meal plan
  if (body.action === "generate_from_meal_plan") {
    const weekStart = new Date(body.weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const mealPlanEntries = await prisma.mealPlanEntry.findMany({
      where: {
        date: { gte: weekStart, lt: weekEnd },
        recipeId: { not: null },
      },
      include: {
        recipe: { include: { ingredients: true } },
      },
    });

    const pantryItems = await prisma.pantryItem.findMany();
    const pantryMap = new Map(
      pantryItems.map((item) => [item.name.toLowerCase(), item])
    );

    // Aggregate ingredients across all meals
    const neededIngredients = new Map<
      string,
      { quantity: number; unit: string; category: string }
    >();

    for (const entry of mealPlanEntries) {
      if (!entry.recipe) continue;
      for (const ingredient of entry.recipe.ingredients) {
        const key = ingredient.name.toLowerCase();
        const existing = neededIngredients.get(key);
        if (existing) {
          existing.quantity += ingredient.quantity * (entry.servings / (entry.recipe.servings || 4));
        } else {
          neededIngredients.set(key, {
            quantity: ingredient.quantity * (entry.servings / (entry.recipe.servings || 4)),
            unit: ingredient.unit,
            category: "Other",
          });
        }
      }
    }

    // Filter out items already in pantry with sufficient quantity
    const shoppingItems = [];
    for (const [name, info] of neededIngredients) {
      const inPantry = pantryMap.get(name);
      if (!inPantry || inPantry.quantity < info.quantity) {
        const neededQty = inPantry
          ? info.quantity - inPantry.quantity
          : info.quantity;
        shoppingItems.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          quantity: Math.ceil(neededQty * 10) / 10,
          unit: info.unit,
          category: inPantry?.category || info.category,
        });
      }
    }

    // Clear existing unchecked items and add new ones
    await prisma.shoppingListItem.deleteMany({ where: { checked: false } });
    const created = await Promise.all(
      shoppingItems.map((item) =>
        prisma.shoppingListItem.create({ data: item })
      )
    );

    return NextResponse.json({
      message: `Generated ${created.length} shopping items`,
      items: created,
    });
  }

  // Add a single item
  const item = await prisma.shoppingListItem.create({
    data: {
      name: body.name,
      quantity: body.quantity || 1,
      unit: body.unit || "item",
      category: body.category || "Other",
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

  const item = await prisma.shoppingListItem.update({
    where: { id },
    data,
  });

  return NextResponse.json(item);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const clearChecked = searchParams.get("clearChecked");

  if (clearChecked === "true") {
    await prisma.shoppingListItem.deleteMany({ where: { checked: true } });
    return NextResponse.json({ success: true });
  }

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.shoppingListItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
