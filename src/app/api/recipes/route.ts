import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractRecipeFromUrl } from "@/lib/ai";

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(recipes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // If a URL is provided, extract recipe using AI
  if (body.url) {
    const extracted = await extractRecipeFromUrl(body.url);
    if (!extracted) {
      return NextResponse.json(
        { error: "Failed to extract recipe from URL" },
        { status: 400 }
      );
    }

    const recipe = await prisma.recipe.create({
      data: {
        title: extracted.title,
        description: extracted.description,
        sourceUrl: body.url,
        servings: extracted.servings,
        prepTime: extracted.prepTime,
        cookTime: extracted.cookTime,
        instructions: JSON.stringify(extracted.instructions),
        tags: extracted.tags.join(","),
        ingredients: {
          create: extracted.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        },
      },
      include: { ingredients: true },
    });

    return NextResponse.json(recipe, { status: 201 });
  }

  // Manual recipe creation
  const recipe = await prisma.recipe.create({
    data: {
      title: body.title,
      description: body.description,
      servings: body.servings || 4,
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      instructions: body.instructions
        ? JSON.stringify(body.instructions)
        : null,
      tags: body.tags,
      ingredients: body.ingredients
        ? {
            create: body.ingredients.map(
              (ing: { name: string; quantity?: number; unit?: string }) => ({
                name: ing.name,
                quantity: ing.quantity || 1,
                unit: ing.unit || "item",
              })
            ),
          }
        : undefined,
    },
    include: { ingredients: true },
  });

  return NextResponse.json(recipe, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
