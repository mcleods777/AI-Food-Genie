// AI utility functions for food analysis and recipe extraction
// These functions integrate with OpenAI's API for image analysis and web scraping

import { estimateExpiration } from "./expiration";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface AnalyzedItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedExpiration?: string;
  expiryEstimateReason?: string;
  opened?: boolean;
}

interface ExtractedRecipe {
  title: string;
  description: string;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  instructions: string[];
  ingredients: { name: string; quantity: number; unit: string }[];
  tags: string[];
}

export async function analyzeImageForItems(
  base64Image: string,
  location: string
): Promise<AnalyzedItem[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-api-key-here") {
    // Return mock data when no API key is configured
    return getMockAnalysisResults(location);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image of a ${location} and identify all food items visible. For each item, provide:
- name: the item name
- category: one of Produce, Dairy, Meat, Grain, Spice, Canned, Frozen, Beverage, Snack, Condiment, Other
- quantity: estimated quantity (number)
- unit: one of item, lb, oz, gal, ct, bag, box, can, bottle
- opened: boolean - whether the item appears opened/unsealed or still sealed/unopened (look for opened containers, torn packaging, etc.)

Do NOT estimate expiration dates - the system will calculate those based on item type, storage location (${location}), and opened status.

Respond with a JSON array of objects only, no other text.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "[]";

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

export async function extractRecipeFromUrl(
  url: string
): Promise<ExtractedRecipe | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-api-key-here") {
    return getMockRecipe(url);
  }

  // Fetch the webpage content
  let pageContent: string;
  try {
    const res = await fetch(url);
    pageContent = await res.text();
    // Strip HTML tags for a rough text extraction
    pageContent = pageContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // Limit content length
  } catch {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Extract the recipe from this webpage content. Return a JSON object with:
- title: recipe name
- description: brief description
- servings: number of servings
- prepTime: prep time in minutes (null if not found)
- cookTime: cook time in minutes (null if not found)
- instructions: array of step strings
- ingredients: array of objects with {name, quantity (number), unit}
- tags: array of tag strings (e.g., "vegetarian", "quick", "dessert")

Webpage content:
${pageContent}

Respond with JSON only, no other text.`,
        },
      ],
      max_tokens: 3000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "null";

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function generateMealPlanSuggestions(
  pantryItems: string[],
  scenario: string,
  headcount: number
): Promise<string[]> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-openai-api-key-here") {
    return [
      "Pasta with marinara sauce",
      "Grilled chicken salad",
      "Tacos with ground beef",
      "Stir-fry with rice",
      "Homemade pizza",
    ];
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Suggest 7 meal ideas based on these pantry items: ${pantryItems.join(", ")}.
Context: ${scenario} scenario with ${headcount} people.
Return a JSON array of meal name strings only.`,
        },
      ],
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "[]";

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

function getMockAnalysisResults(location: string): AnalyzedItem[] {
  const now = new Date();

  const mockItemDefs: Record<string, { name: string; category: string; quantity: number; unit: string; opened: boolean }[]> = {
    Refrigerator: [
      { name: "Milk", category: "Dairy", quantity: 1, unit: "gal", opened: false },
      { name: "Eggs", category: "Dairy", quantity: 12, unit: "ct", opened: false },
      { name: "Cheddar Cheese", category: "Dairy", quantity: 8, unit: "oz", opened: false },
      { name: "Chicken Breast", category: "Meat", quantity: 2, unit: "lb", opened: false },
      { name: "Lettuce", category: "Produce", quantity: 1, unit: "item", opened: false },
    ],
    Pantry: [
      { name: "Pasta", category: "Grain", quantity: 1, unit: "box", opened: false },
      { name: "Rice", category: "Grain", quantity: 2, unit: "lb", opened: false },
      { name: "Canned Tomatoes", category: "Canned", quantity: 3, unit: "can", opened: false },
      { name: "Olive Oil", category: "Condiment", quantity: 1, unit: "bottle", opened: true },
      { name: "Peanut Butter", category: "Other", quantity: 1, unit: "item", opened: true },
    ],
    Cabinet: [
      { name: "Salt", category: "Spice", quantity: 1, unit: "item", opened: true },
      { name: "Black Pepper", category: "Spice", quantity: 1, unit: "item", opened: true },
      { name: "Garlic Powder", category: "Spice", quantity: 1, unit: "item", opened: true },
      { name: "Flour", category: "Grain", quantity: 5, unit: "lb", opened: false },
      { name: "Sugar", category: "Other", quantity: 4, unit: "lb", opened: false },
    ],
    Freezer: [
      { name: "Frozen Pizza", category: "Frozen", quantity: 2, unit: "item", opened: false },
      { name: "Ice Cream", category: "Frozen", quantity: 1, unit: "item", opened: true },
      { name: "Frozen Vegetables", category: "Frozen", quantity: 2, unit: "bag", opened: false },
    ],
  };

  const defs = mockItemDefs[location] || mockItemDefs["Pantry"];

  return defs.map((def) => {
    const estimate = estimateExpiration(def.name, location, def.category, def.opened);
    return {
      ...def,
      estimatedExpiration: addDays(now, estimate.days),
      expiryEstimateReason: estimate.reason,
    };
  });
}

function getMockRecipe(url: string): ExtractedRecipe {
  return {
    title: `Recipe from ${new URL(url).hostname}`,
    description: "A delicious recipe extracted from the web",
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    instructions: [
      "Prepare all ingredients",
      "Cook the main protein",
      "Combine with vegetables",
      "Season to taste",
      "Serve hot",
    ],
    ingredients: [
      { name: "Chicken Breast", quantity: 2, unit: "lb" },
      { name: "Olive Oil", quantity: 2, unit: "tbsp" },
      { name: "Garlic", quantity: 3, unit: "cloves" },
      { name: "Salt", quantity: 1, unit: "tsp" },
      { name: "Black Pepper", quantity: 0.5, unit: "tsp" },
    ],
    tags: ["dinner", "protein", "easy"],
  };
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
