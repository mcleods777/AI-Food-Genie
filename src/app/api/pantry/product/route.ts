import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode");

  if (!barcode) {
    return NextResponse.json({ error: "Barcode required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      {
        headers: {
          "User-Agent": "AI-Food-Genie/1.0 (food-inventory-app)",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const p = data.product;

    return NextResponse.json({
      barcode,
      name: p.product_name || p.product_name_en || "Unknown Product",
      brand: p.brands || null,
      category: p.categories || null,
      imageUrl: p.image_front_url || p.image_url || null,
      ingredients: p.ingredients_text || p.ingredients_text_en || null,
      nutriScore: p.nutriscore_grade || null,
      novaGroup: p.nova_group || null,
      quantity: p.quantity || null,
      allergens: p.allergens_tags?.map((a: string) => a.replace("en:", "")) || [],
      nutriments: p.nutriments
        ? {
            energy_kcal: p.nutriments["energy-kcal_100g"] ?? null,
            fat: p.nutriments.fat_100g ?? null,
            saturatedFat: p.nutriments["saturated-fat_100g"] ?? null,
            carbs: p.nutriments.carbohydrates_100g ?? null,
            sugars: p.nutriments.sugars_100g ?? null,
            fiber: p.nutriments.fiber_100g ?? null,
            protein: p.nutriments.proteins_100g ?? null,
            salt: p.nutriments.salt_100g ?? null,
            sodium: p.nutriments.sodium_100g ?? null,
          }
        : null,
      labels: p.labels || null,
      origins: p.origins || null,
      stores: p.stores || null,
      url: `https://world.openfoodfacts.org/product/${barcode}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch product details" }, { status: 500 });
  }
}
