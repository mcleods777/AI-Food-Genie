import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateMealPlanSuggestions } from "@/lib/ai";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");

  let dateFilter = {};
  if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    dateFilter = { date: { gte: start, lt: end } };
  }

  const entries = await prisma.mealPlanEntry.findMany({
    where: dateFilter,
    include: { recipe: true },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  });

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Generate AI suggestions
  if (body.action === "suggest") {
    const pantryItems = await prisma.pantryItem.findMany({
      select: { name: true },
    });
    const suggestions = await generateMealPlanSuggestions(
      pantryItems.map((i) => i.name),
      body.scenario || "solo",
      body.headcount || 1
    );
    return NextResponse.json({ suggestions });
  }

  // Create a meal plan entry
  const entry = await prisma.mealPlanEntry.create({
    data: {
      date: new Date(body.date),
      mealType: body.mealType,
      recipeId: body.recipeId || null,
      customMeal: body.customMeal || null,
      servings: body.servings || 2,
      notes: body.notes,
    },
    include: { recipe: true },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.mealPlanEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
