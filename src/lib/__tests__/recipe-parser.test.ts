import { describe, it, expect } from "vitest";
import { extractJsonLdRecipe, parseIngredientString, parseISO8601Duration, extractMainContent } from "../recipe-parser";

describe("parseISO8601Duration", () => {
  it("parses PT15M to 15", () => {
    expect(parseISO8601Duration("PT15M")).toBe(15);
  });

  it("parses PT1H30M to 90", () => {
    expect(parseISO8601Duration("PT1H30M")).toBe(90);
  });

  it("parses PT2H to 120", () => {
    expect(parseISO8601Duration("PT2H")).toBe(120);
  });

  it("parses P0DT1H15M to 75", () => {
    expect(parseISO8601Duration("P0DT1H15M")).toBe(75);
  });

  it("returns null for invalid string", () => {
    expect(parseISO8601Duration("not a duration")).toBe(null);
  });

  it("returns null for null input", () => {
    expect(parseISO8601Duration(null)).toBe(null);
  });

  it("returns null for undefined", () => {
    expect(parseISO8601Duration(undefined)).toBe(null);
  });
});

describe("parseIngredientString", () => {
  it("parses '2 cups flour'", () => {
    const result = parseIngredientString("2 cups flour");
    expect(result).toEqual({ quantity: 2, unit: "cup", name: "flour" });
  });

  it("parses '1/2 tsp salt'", () => {
    const result = parseIngredientString("1/2 tsp salt");
    expect(result.quantity).toBeCloseTo(0.5);
    expect(result.unit).toBe("tsp");
    expect(result.name).toBe("salt");
  });

  it("parses '3 large eggs' (no unit)", () => {
    const result = parseIngredientString("3 large eggs");
    expect(result).toEqual({ quantity: 3, unit: "item", name: "large eggs" });
  });

  it("parses 'Salt and pepper to taste' as fallback", () => {
    const result = parseIngredientString("Salt and pepper to taste");
    expect(result.name).toBe("Salt and pepper to taste");
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe("item");
  });

  it("handles empty string", () => {
    const result = parseIngredientString("");
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe("item");
  });

  it("strips parenthetical notes", () => {
    const result = parseIngredientString("1 cup sugar (plus extra for dusting)");
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe("cup");
    expect(result.name).toBe("sugar");
  });

  it("handles tablespoon unit", () => {
    const result = parseIngredientString("2 tablespoons olive oil");
    expect(result).toEqual({ quantity: 2, unit: "tbsp", name: "olive oil" });
  });

  it("handles ranges (takes first number)", () => {
    const result = parseIngredientString("2-3 cloves garlic");
    expect(result.quantity).toBe(2);
    expect(result.name).toContain("garlic");
  });
});

describe("extractJsonLdRecipe", () => {
  it("extracts recipe from valid JSON-LD", () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Chicken Parmesan",
        "description": "A classic Italian dish",
        "recipeYield": "4 servings",
        "prepTime": "PT15M",
        "cookTime": "PT30M",
        "recipeIngredient": ["2 cups flour", "1 lb chicken breast", "1 cup marinara sauce"],
        "recipeInstructions": [
          {"@type": "HowToStep", "text": "Bread the chicken"},
          {"@type": "HowToStep", "text": "Fry until golden"},
          {"@type": "HowToStep", "text": "Top with sauce and cheese"}
        ],
        "keywords": "Italian, Chicken, Dinner",
        "image": "https://example.com/chicken.jpg"
      }
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipe(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Chicken Parmesan");
    expect(result!.servings).toBe(4);
    expect(result!.prepTime).toBe(15);
    expect(result!.cookTime).toBe(30);
    expect(result!.instructions).toHaveLength(3);
    expect(result!.ingredients).toHaveLength(3);
    expect(result!.imageUrl).toBe("https://example.com/chicken.jpg");
    expect(result!.tags).toContain("italian");
  });

  it("finds Recipe nested in @graph", () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {"@type": "WebPage", "name": "My Blog"},
          {
            "@type": "Recipe",
            "name": "Pasta Carbonara",
            "recipeIngredient": ["200g spaghetti", "100g pancetta"],
            "recipeInstructions": ["Cook pasta", "Fry pancetta", "Combine"]
          }
        ]
      }
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipe(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Pasta Carbonara");
  });

  it("returns null when no JSON-LD tags exist", () => {
    const html = "<html><head></head><body><h1>Not a recipe</h1></body></html>";
    expect(extractJsonLdRecipe(html)).toBeNull();
  });

  it("returns null when JSON-LD exists but no Recipe type", () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {"@type": "WebPage", "name": "Just a page"}
      </script>
    </head><body></body></html>`;

    expect(extractJsonLdRecipe(html)).toBeNull();
  });

  it("handles malformed JSON gracefully", () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {not valid json}
      </script>
    </head><body></body></html>`;

    expect(extractJsonLdRecipe(html)).toBeNull();
  });

  it("handles @type as array", () => {
    const html = `<html><head>
      <script type="application/ld+json">
      {
        "@type": ["Recipe", "HowTo"],
        "name": "Multi-type Recipe",
        "recipeIngredient": ["1 cup water"],
        "recipeInstructions": ["Boil water"]
      }
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipe(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Multi-type Recipe");
  });
});

describe("extractMainContent", () => {
  it("extracts article content when available", () => {
    const html = `<html><body><nav>Nav</nav><article>Recipe content here</article><footer>Footer</footer></body></html>`;
    const result = extractMainContent(html);
    expect(result).toContain("Recipe content here");
    expect(result).not.toContain("Nav");
    expect(result).not.toContain("Footer");
  });

  it("falls back to body when no article/main", () => {
    const html = `<html><body><div>Some recipe content</div></body></html>`;
    const result = extractMainContent(html);
    expect(result).toContain("Some recipe content");
  });

  it("truncates to 12000 chars", () => {
    const html = `<html><body>${"x".repeat(20000)}</body></html>`;
    const result = extractMainContent(html);
    expect(result.length).toBeLessThanOrEqual(12000);
  });
});
