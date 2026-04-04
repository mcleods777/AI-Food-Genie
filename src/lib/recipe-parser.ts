// JSON-LD recipe extraction + ingredient parsing + ISO 8601 duration parsing
//
// Data flow:
//   HTML page → extract <script type="application/ld+json"> → find @type: "Recipe"
//   → map schema.org fields → parseIngredientString() each → parseISO8601Duration()
//   → return ExtractedRecipe or null

export interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface ExtractedRecipe {
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  instructions: string[];
  ingredients: ParsedIngredient[];
  tags: string[];
  imageUrl: string | null;
}

/**
 * Extract a schema.org/Recipe from JSON-LD embedded in HTML.
 * Returns null if no valid Recipe is found.
 */
export function extractJsonLdRecipe(html: string): ExtractedRecipe | null {
  // Find all <script type="application/ld+json"> blocks
  const ldJsonRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const jsonBlocks: string[] = [];

  while ((match = ldJsonRegex.exec(html)) !== null) {
    jsonBlocks.push(match[1]);
  }

  if (jsonBlocks.length === 0) return null;

  // Search each block for a Recipe object
  for (const block of jsonBlocks) {
    try {
      const data = JSON.parse(block);
      const recipe = findRecipeObject(data);
      if (recipe) return mapSchemaOrgToRecipe(recipe);
    } catch {
      // Malformed JSON, skip this block
      continue;
    }
  }

  return null;
}

/**
 * Recursively search a JSON-LD object for @type: "Recipe".
 * Handles @graph arrays, nested objects, and @type as string or array.
 */
function findRecipeObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeObject(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check @type
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
    return obj;
  }

  // Check @graph
  if (Array.isArray(obj["@graph"])) {
    return findRecipeObject(obj["@graph"]);
  }

  return null;
}

/**
 * Map a schema.org Recipe object to our ExtractedRecipe interface.
 */
function mapSchemaOrgToRecipe(recipe: Record<string, unknown>): ExtractedRecipe {
  const title = String(recipe.name || "Untitled Recipe");
  const description = recipe.description ? String(recipe.description) : null;

  // Servings: parse number from string like "4 servings" or "4"
  let servings = 4;
  if (recipe.recipeYield) {
    const yieldStr = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
    const num = parseInt(String(yieldStr));
    if (!isNaN(num) && num > 0) servings = num;
  }

  // Times
  const prepTime = parseISO8601Duration(recipe.prepTime as string | null | undefined);
  const cookTime = parseISO8601Duration(recipe.cookTime as string | null | undefined);

  // Instructions: handle string[], HowToStep[], or single string
  const instructions = parseInstructions(recipe.recipeInstructions);

  // Ingredients
  const rawIngredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
  const ingredients = rawIngredients.map((s: unknown) => parseIngredientString(String(s)));

  // Tags: merge keywords + recipeCategory, deduplicate, lowercase
  const tags = parseTags(recipe.keywords, recipe.recipeCategory);

  // Image: handle string, array, or ImageObject
  const imageUrl = parseImage(recipe.image);

  return { title, description, servings, prepTime, cookTime, instructions, ingredients, tags, imageUrl };
}

/**
 * Parse schema.org recipeInstructions into a string array.
 * Handles: string, string[], HowToStep[], HowToSection[]
 */
function parseInstructions(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") return raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(raw)) return [];

  const steps: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      steps.push(item.trim());
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.text) {
        steps.push(String(obj.text).trim());
      } else if (obj.name) {
        steps.push(String(obj.name).trim());
      }
      // HowToSection: has itemListElement
      if (Array.isArray(obj.itemListElement)) {
        for (const sub of obj.itemListElement) {
          if (typeof sub === "string") steps.push(sub.trim());
          else if (sub && typeof sub === "object" && (sub as Record<string, unknown>).text) {
            steps.push(String((sub as Record<string, unknown>).text).trim());
          }
        }
      }
    }
  }
  return steps.filter(Boolean);
}

/**
 * Parse a recipe ingredient string into quantity, unit, and name.
 * "2 cups all-purpose flour" → {quantity: 2, unit: "cup", name: "all-purpose flour"}
 */
export function parseIngredientString(s: string): ParsedIngredient {
  if (!s || !s.trim()) return { name: "", quantity: 1, unit: "item" };

  let input = s.trim();

  // Strip parenthetical notes: "1 cup sugar (plus extra for dusting)" → "1 cup sugar"
  input = input.replace(/\s*\([^)]*\)\s*/g, " ").trim();

  // Unicode fraction map
  const fractions: Record<string, number> = {
    "½": 0.5, "⅓": 0.333, "⅔": 0.667, "¼": 0.25, "¾": 0.75,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
  };

  // Replace unicode fractions
  for (const [char, val] of Object.entries(fractions)) {
    if (input.includes(char)) {
      input = input.replace(char, String(val));
    }
  }

  // Common unit patterns
  const units = [
    "cups?", "tablespoons?", "tbsp?", "teaspoons?", "tsp?",
    "ounces?", "oz", "pounds?", "lbs?", "grams?", "g",
    "kilograms?", "kg", "milliliters?", "ml", "liters?", "l",
    "pinch(?:es)?", "dash(?:es)?", "cloves?", "slices?",
    "pieces?", "cans?", "packages?", "bags?", "bunches?",
    "stalks?", "heads?", "sprigs?",
  ];
  const unitPattern = units.join("|");

  // Pattern: "2 cups flour" or "2-3 cups flour" (take first number)
  const fullPattern = new RegExp(
    `^(\\d+(?:\\.\\d+)?(?:\\s*[-–]\\s*\\d+(?:\\.\\d+)?)?)\\s+(${unitPattern})\\.?\\s+(.+)$`,
    "i"
  );
  const fullMatch = input.match(fullPattern);
  if (fullMatch) {
    const qty = parseFloat(fullMatch[1]);
    const unit = normalizeUnit(fullMatch[2]);
    const name = fullMatch[3].trim();
    if (!isNaN(qty) && name) return { quantity: qty, unit, name };
  }

  // Pattern: "2 large eggs" (number + adjective + noun, no unit)
  const noUnitPattern = /^(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s+(.+)$/;
  const noUnitMatch = input.match(noUnitPattern);
  if (noUnitMatch) {
    const qty = parseFloat(noUnitMatch[1]);
    const name = noUnitMatch[2].trim();
    if (!isNaN(qty) && name) return { quantity: qty, unit: "item", name };
  }

  // Pattern: "1/2 tsp salt" (fraction)
  const fractionPattern = new RegExp(
    `^(\\d+)\\s*/\\s*(\\d+)\\s+(${unitPattern})\\.?\\s+(.+)$`,
    "i"
  );
  const fractionMatch = input.match(fractionPattern);
  if (fractionMatch) {
    const qty = parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
    const unit = normalizeUnit(fractionMatch[3]);
    const name = fractionMatch[4].trim();
    if (!isNaN(qty) && name) return { quantity: qty, unit, name };
  }

  // Pattern: "1/2 salt" (fraction without unit)
  const fractionNoUnitPattern = /^(\d+)\s*\/\s*(\d+)\s+(.+)$/;
  const fractionNoUnitMatch = input.match(fractionNoUnitPattern);
  if (fractionNoUnitMatch) {
    const qty = parseInt(fractionNoUnitMatch[1]) / parseInt(fractionNoUnitMatch[2]);
    const name = fractionNoUnitMatch[3].trim();
    if (!isNaN(qty) && name) return { quantity: qty, unit: "item", name };
  }

  // Fallback: return the whole string as name
  return { name: input, quantity: 1, unit: "item" };
}

/**
 * Normalize unit strings to a consistent short form.
 */
function normalizeUnit(raw: string): string {
  const s = raw.toLowerCase().replace(/\.$/, "");
  if (/^cups?$/.test(s)) return "cup";
  if (/^tablespoons?$|^tbsp?$/.test(s)) return "tbsp";
  if (/^teaspoons?$|^tsp?$/.test(s)) return "tsp";
  if (/^ounces?$|^oz$/.test(s)) return "oz";
  if (/^pounds?$|^lbs?$/.test(s)) return "lb";
  if (/^grams?$|^g$/.test(s)) return "g";
  if (/^kilograms?$|^kg$/.test(s)) return "kg";
  if (/^milliliters?$|^ml$/.test(s)) return "ml";
  if (/^liters?$|^l$/.test(s)) return "l";
  return s;
}

/**
 * Parse ISO 8601 duration strings to minutes.
 * PT15M → 15, PT1H30M → 90, PT2H → 120
 */
export function parseISO8601Duration(s: string | null | undefined): number | null {
  if (!s || typeof s !== "string") return null;

  const match = s.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;

  const days = parseInt(match[1] || "0");
  const hours = parseInt(match[2] || "0");
  const minutes = parseInt(match[3] || "0");
  const seconds = parseInt(match[4] || "0");

  const total = days * 24 * 60 + hours * 60 + minutes + Math.ceil(seconds / 60);
  return total > 0 ? total : null;
}

/**
 * Merge keywords + recipeCategory into deduplicated lowercase tags.
 */
function parseTags(keywords: unknown, recipeCategory: unknown): string[] {
  const tags: string[] = [];

  if (typeof keywords === "string") {
    tags.push(...keywords.split(",").map(s => s.trim().toLowerCase()));
  } else if (Array.isArray(keywords)) {
    tags.push(...keywords.map(s => String(s).trim().toLowerCase()));
  }

  if (typeof recipeCategory === "string") {
    tags.push(...recipeCategory.split(",").map(s => s.trim().toLowerCase()));
  } else if (Array.isArray(recipeCategory)) {
    tags.push(...recipeCategory.map(s => String(s).trim().toLowerCase()));
  }

  return [...new Set(tags.filter(Boolean))];
}

/**
 * Extract image URL from schema.org image field.
 * Handles: string, string[], ImageObject, ImageObject[]
 */
function parseImage(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && (first as Record<string, unknown>).url) {
      return String((first as Record<string, unknown>).url);
    }
    return null;
  }
  if (typeof image === "object" && (image as Record<string, unknown>).url) {
    return String((image as Record<string, unknown>).url);
  }
  return null;
}

/**
 * Extract the main content from an HTML page, stripping navigation and boilerplate.
 */
export function extractMainContent(html: string): string {
  // Try to find <article> or <main> content
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let content = articleMatch?.[1] || mainMatch?.[1] || html;

  // Strip nav, footer, header, aside
  content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  content = content.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  // Strip remaining HTML tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  content = content.replace(/<[^>]+>/g, " ");
  content = content.replace(/\s+/g, " ").trim();

  return content.slice(0, 12000);
}
