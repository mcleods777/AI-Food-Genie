// Multi-provider AI layer for food analysis
// Routes tasks to the best model: Gemini (scanning), Claude (OCR), GPT-4o (fallback)

import { estimateExpiration } from "./expiration";
import { getProviderConfig, getProviderForTask, type ScanProvider } from "./providers";

export interface AnalyzedItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  opened: boolean;
  confidence: number; // 0.0-1.0
  estimatedExpiration?: string;
  expiryEstimateReason?: string;
  expirationDateFromLabel?: string | null; // OCR-read date if visible
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

// ─── Describe-then-extract system prompt (proven to reduce errors) ─────────

const SCAN_SYSTEM_PROMPT = `You are a food inventory scanner. Analyze the image and identify all food items.

RULES:
- Extract EXACT text from labels. Never invent text.
- Set fields to null when information isn't visible. Never guess dates.
- Parse dates to ISO 8601 (YYYY-MM-DD). Look for: "Best By", "Use By", "Sell By", "BB", "EXP", "Best Before".
- For multi-item scenes, list ALL items left-to-right, top-to-bottom.
- Include confidence (0.0-1.0) for every item based on how clearly visible it is.
- Look for opened containers, torn packaging, partially used items.`;

function buildScanPrompt(location: string): string {
  return `STEP 1: Describe every food item you can see in this image of a ${location}. Note the item name, its packaging state (opened/sealed), and any visible text on labels (especially dates).

STEP 2: From your description, extract a JSON array where each item has:
- name: string (the item name)
- category: one of "Produce", "Dairy", "Meat", "Grain", "Spice", "Canned", "Frozen", "Beverage", "Snack", "Condiment", "Other"
- quantity: number (estimated count or amount)
- unit: one of "item", "lb", "oz", "gal", "ct", "bag", "box", "can", "bottle"
- opened: boolean (true if the container appears opened/unsealed/partially used)
- confidence: number 0.0-1.0 (how clearly you can identify this item)
- expirationDateFromLabel: string|null (ISO 8601 date if you can read an expiration/best-by date on the label, null otherwise. ONLY include dates you can actually read - never guess.)

Do NOT estimate expiration dates. The system calculates those from item type, storage (${location}), and opened status.

Respond with the JSON array ONLY after your description. Format: [{"name":...}, ...]`;
}

// ─── Provider-specific API calls ───────────────────────────────────────────

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [];

  if (base64Image) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Image,
      },
    });
  }

  parts.push({ text: userPrompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1,
          maxOutputTokens: 4000,
        },
      }),
    }
  );

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<string> {
  const content: Array<Record<string, unknown>> = [];

  if (base64Image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: base64Image,
      },
    });
  }

  content.push({ type: "text", text: userPrompt });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "[]";
  return text;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<string> {
  const content: Array<Record<string, unknown>> = [];

  content.push({ type: "text", text: userPrompt });

  if (base64Image) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64Image}` },
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[]";
}

async function callProvider(
  provider: ScanProvider,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  base64Image?: string,
  mimeType?: string
): Promise<string> {
  const config = getProviderConfig();

  switch (provider) {
    case "gemini":
      return callGemini(config.geminiApiKey!, model, systemPrompt, userPrompt, base64Image, mimeType);
    case "claude":
      return callClaude(config.claudeApiKey!, model, systemPrompt, userPrompt, base64Image, mimeType);
    case "openai":
      return callOpenAI(config.openaiApiKey!, model, systemPrompt, userPrompt, base64Image, mimeType);
  }
}

function extractJson(text: string): string {
  // Try to find JSON array or object in the response
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  // Clean markdown code fences
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Analyze an image to identify food items.
 * Uses Gemini Flash as primary (bounding boxes, speed, cost),
 * falls back to OpenAI or Claude.
 */
export async function analyzeImageForItems(
  base64Image: string,
  location: string
): Promise<AnalyzedItem[]> {
  const { provider, model, available } = getProviderForTask("scan");

  if (!available) {
    return getMockAnalysisResults(location);
  }

  const providerLabel = provider === "gemini" ? "Gemini Flash" : provider === "claude" ? "Claude" : "GPT-4o";
  console.log(`[AI Scan] Using ${providerLabel} (${model}) for item detection`);

  try {
    const raw = await callProvider(
      provider,
      model,
      SCAN_SYSTEM_PROMPT,
      buildScanPrompt(location),
      base64Image
    );

    const json = extractJson(raw);
    const items: AnalyzedItem[] = JSON.parse(json);

    // Ensure all items have required fields with defaults
    return items.map((item) => ({
      name: item.name || "Unknown Item",
      category: item.category || "Other",
      quantity: item.quantity ?? 1,
      unit: item.unit || "item",
      opened: item.opened ?? false,
      confidence: item.confidence ?? 0.5,
      expirationDateFromLabel: item.expirationDateFromLabel || null,
    }));
  } catch (err) {
    console.error(`[AI Scan] ${providerLabel} failed:`, err);
    return [];
  }
}

/**
 * Read expiration dates from a label image using Claude (lowest hallucination rate).
 * Falls back to other providers.
 */
export async function readExpirationDate(
  base64Image: string
): Promise<{ date: string | null; confidence: number; rawText: string | null }> {
  const { provider, model, available } = getProviderForTask("ocr");

  if (!available) {
    return { date: null, confidence: 0, rawText: null };
  }

  const systemPrompt = `You are a food label OCR specialist. Your ONLY job is to find and read expiration dates.

RULES:
- Extract EXACT text from the label. Never invent text.
- Return null if you cannot clearly read a date. Never guess.
- Look for: "Best By", "Use By", "Sell By", "BB", "EXP", "Best Before", "Best If Used By"
- Parse to ISO 8601 (YYYY-MM-DD)
- Include confidence 0.0-1.0 based on text clarity`;

  const userPrompt = `Read the expiration date from this food label.

Return JSON: {"date": "YYYY-MM-DD" or null, "confidence": 0.0-1.0, "rawText": "the exact text you read" or null}

If you cannot clearly read a date, return {"date": null, "confidence": 0, "rawText": null}. Do NOT guess.`;

  try {
    const raw = await callProvider(provider, model, systemPrompt, userPrompt, base64Image);
    const json = extractJson(raw);
    const result = JSON.parse(json);
    return {
      date: result.date || null,
      confidence: result.confidence ?? 0,
      rawText: result.rawText || null,
    };
  } catch {
    return { date: null, confidence: 0, rawText: null };
  }
}

/**
 * Extract a recipe from a URL.
 */
export async function extractRecipeFromUrl(
  url: string
): Promise<ExtractedRecipe | null> {
  const { provider, model, available } = getProviderForTask("recipe");

  if (!available) {
    return getMockRecipe(url);
  }

  // Fetch the webpage content
  let pageContent: string;
  try {
    const res = await fetch(url);
    pageContent = await res.text();
    pageContent = pageContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return null;
  }

  const systemPrompt = "You are a recipe extraction specialist. Extract structured recipe data from webpage content.";
  const userPrompt = `Extract the recipe from this webpage content. Return a JSON object with:
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

Respond with JSON only.`;

  try {
    const raw = await callProvider(provider, model, systemPrompt, userPrompt);
    const json = extractJson(raw);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Generate meal plan suggestions based on pantry items.
 */
export async function generateMealPlanSuggestions(
  pantryItems: string[],
  scenario: string,
  headcount: number
): Promise<string[]> {
  const { provider, model, available } = getProviderForTask("suggest");

  if (!available) {
    return [
      "Pasta with marinara sauce",
      "Grilled chicken salad",
      "Tacos with ground beef",
      "Stir-fry with rice",
      "Homemade pizza",
    ];
  }

  const systemPrompt = "You are a meal planning assistant. Suggest practical meals using available ingredients.";
  const userPrompt = `Suggest 7 meal ideas based on these pantry items: ${pantryItems.join(", ")}.
Context: ${scenario} scenario with ${headcount} people.
Return a JSON array of meal name strings only.`;

  try {
    const raw = await callProvider(provider, model, systemPrompt, userPrompt);
    const json = extractJson(raw);
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// ─── Mock data for development without API keys ────────────────────────────

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
      confidence: 0.95,
      estimatedExpiration: addDays(now, estimate.days),
      expiryEstimateReason: estimate.reason,
      expirationDateFromLabel: null,
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
