// Barcode lookup via Open Food Facts API
// Free, open-source database with 4M+ products across 150+ countries

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  quantity: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  nutriScore: string | null;
  novaGroup: number | null;
}

// Map Open Food Facts categories to our app categories
function mapCategory(offCategories: string): string {
  const lower = offCategories.toLowerCase();
  if (lower.includes("dairy") || lower.includes("milk") || lower.includes("cheese") || lower.includes("yogurt")) return "Dairy";
  if (lower.includes("meat") || lower.includes("poultry") || lower.includes("beef") || lower.includes("pork") || lower.includes("chicken")) return "Meat";
  if (lower.includes("fruit") || lower.includes("vegetable") || lower.includes("produce") || lower.includes("salad")) return "Produce";
  if (lower.includes("grain") || lower.includes("cereal") || lower.includes("bread") || lower.includes("pasta") || lower.includes("rice") || lower.includes("flour")) return "Grain";
  if (lower.includes("spice") || lower.includes("herb") || lower.includes("seasoning")) return "Spice";
  if (lower.includes("canned") || lower.includes("preserved")) return "Canned";
  if (lower.includes("frozen")) return "Frozen";
  if (lower.includes("beverage") || lower.includes("drink") || lower.includes("juice") || lower.includes("water") || lower.includes("soda") || lower.includes("coffee") || lower.includes("tea")) return "Beverage";
  if (lower.includes("snack") || lower.includes("chip") || lower.includes("cookie") || lower.includes("candy") || lower.includes("chocolate")) return "Snack";
  if (lower.includes("sauce") || lower.includes("condiment") || lower.includes("oil") || lower.includes("vinegar") || lower.includes("dressing") || lower.includes("ketchup") || lower.includes("mustard")) return "Condiment";
  return "Other";
}

/**
 * Fetch a single barcode from Open Food Facts.
 * Returns the parsed product or null.
 */
async function fetchBarcode(code: string): Promise<BarcodeProduct | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
    {
      headers: {
        "User-Agent": "AI-Food-Genie/1.0 (food-inventory-app)",
      },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) return null;

  const data = await res.json();

  if (data.status !== 1 || !data.product) return null;

  const product = data.product;
  const categories = product.categories || product.categories_tags?.join(", ") || "";

  return {
    barcode: code,
    name: product.product_name || product.product_name_en || "Unknown Product",
    brand: product.brands || null,
    category: mapCategory(categories),
    quantity: product.quantity || null,
    imageUrl: product.image_front_url || product.image_url || null,
    ingredients: product.ingredients_text || product.ingredients_text_en || null,
    nutriScore: product.nutriscore_grade || null,
    novaGroup: product.nova_group || null,
  };
}

/**
 * Generate barcode variants to try.
 * UPC-A (12 digits) is often stored as EAN-13 (leading 0) in Open Food Facts,
 * and vice-versa. Also handles leading-zero stripped barcodes.
 */
function barcodeVariants(barcode: string): string[] {
  const trimmed = barcode.trim();
  const variants = [trimmed];

  // 12-digit UPC-A → try as 13-digit EAN-13 (prepend 0)
  if (trimmed.length === 12 && /^\d+$/.test(trimmed)) {
    variants.push("0" + trimmed);
  }

  // 13-digit EAN starting with 0 → try as 12-digit UPC-A (strip leading 0)
  if (trimmed.length === 13 && trimmed.startsWith("0") && /^\d+$/.test(trimmed)) {
    variants.push(trimmed.slice(1));
  }

  return variants;
}

/**
 * Look up a product by barcode using the Open Food Facts API.
 * Tries UPC-A ↔ EAN-13 variants and retries once on timeout.
 * Returns null if the product is not found.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  const variants = barcodeVariants(barcode);

  for (const code of variants) {
    try {
      const result = await fetchBarcode(code);
      if (result) return result;
    } catch (err) {
      // Retry once on timeout / network error
      console.warn(`Barcode lookup failed for ${code}, retrying:`, err instanceof Error ? err.message : err);
      try {
        const result = await fetchBarcode(code);
        if (result) return result;
      } catch (retryErr) {
        console.warn(`Barcode retry failed for ${code}:`, retryErr instanceof Error ? retryErr.message : retryErr);
      }
    }
  }

  console.log(`Barcode not found in Open Food Facts: ${barcode} (tried variants: ${variants.join(", ")})`);
  return null;
}

/**
 * Search Open Food Facts by product name.
 * Returns up to `limit` results.
 */
export async function searchProducts(query: string, limit: number = 5): Promise<BarcodeProduct[]> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}`,
      {
        headers: {
          "User-Agent": "AI-Food-Genie/1.0 (food-inventory-app)",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();

    return (data.products || []).map((product: Record<string, unknown>) => {
      const categories = (product.categories as string) || "";
      return {
        barcode: product.code as string || "",
        name: (product.product_name as string) || (product.product_name_en as string) || "Unknown",
        brand: (product.brands as string) || null,
        category: mapCategory(categories),
        quantity: (product.quantity as string) || null,
        imageUrl: (product.image_front_url as string) || null,
        ingredients: (product.ingredients_text as string) || null,
        nutriScore: (product.nutriscore_grade as string) || null,
        novaGroup: (product.nova_group as number) || null,
      };
    });
  } catch {
    return [];
  }
}
