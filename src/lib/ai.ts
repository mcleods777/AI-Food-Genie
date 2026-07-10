// Consolidated Gemini-only AI layer for food analysis
// Gemini handles all tasks: scanning, OCR, recipe extraction, meal suggestions
// Note: strip EXIF orientation metadata from iPhone photos before sending to Gemini
// (documented issue causes rotated bounding boxes). Use thinking level "minimal" for speed.

import { z } from "zod";
import { estimateExpiration } from "./expiration";
import { getProviderConfig, getProviderForTask, type ScanProvider } from "./providers";
import { extractJsonLdRecipe, extractMainContent, type ExtractedRecipe } from "./recipe-parser";

export type { ExtractedRecipe };

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
  mimeType: string = "image/jpeg",
  fileUri?: string,
  fileMimeType?: string
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

  if (fileUri) {
    parts.push({
      file_data: {
        mime_type: fileMimeType || "video/mp4",
        file_uri: fileUri,
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
 * Uses Gemini Flash for detection (bounding boxes, speed, cost).
 * Falls back to GPT-4o or Claude if Gemini is unavailable.
 */
export async function analyzeImageForItems(
  base64Image: string,
  location: string
): Promise<AnalyzedItem[]> {
  const { provider, model, available } = getProviderForTask("scan");

  if (!available) {
    return getMockAnalysisResults(location);
  }

  const providerLabel = provider === "gemini" ? "Gemini Flash" : provider === "openai" ? "GPT-4o" : "Claude";
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
 * Read expiration dates from a label image using Gemini Flash.
 * Gemini achieves lowest OCR edit distance (0.115 on OmniDocBench).
 * Uses response_mime_type="application/json" for structured output.
 * Falls back to GPT-4o or Claude if Gemini is unavailable.
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

// Zod schema for validated recipe extraction
const recipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  servings: z.coerce.number().positive().default(4),
  prepTime: z.coerce.number().positive().nullable().default(null),
  cookTime: z.coerce.number().positive().nullable().default(null),
  instructions: z.array(z.string()).min(1),
  ingredients: z.array(z.object({
    name: z.string().min(1),
    quantity: z.coerce.number().default(1),
    unit: z.string().default("item"),
  })).min(1),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().nullable().default(null),
});

/**
 * Fetch a recipe page with a proper User-Agent header.
 * Returns the raw HTML string. Throws with specific error messages.
 */
async function fetchRecipePage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FoodGenieBot/1.0; +https://food-genie.app)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 404) throw new Error("PAGE_NOT_FOUND");
  if (res.status === 403) throw new Error("PAGE_BLOCKED");
  if (!res.ok) throw new Error(`FETCH_ERROR_${res.status}`);

  return res.text();
}

/**
 * Extract a recipe from a URL using JSON-LD first, AI as fallback.
 * Returns a validated ExtractedRecipe or null if extraction fails.
 */
export async function extractRecipeFromUrl(
  url: string
): Promise<(ExtractedRecipe & { _error?: string }) | null> {
  const { provider, model, available } = getProviderForTask("recipe");

  if (!available) {
    return getMockRecipe(url);
  }

  // 1. Fetch the page
  let html: string;
  try {
    html = await fetchRecipePage(url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "FETCH_ERROR";
    return { _error: msg } as unknown as ExtractedRecipe & { _error: string };
  }

  // 2. Try JSON-LD extraction first (no AI needed)
  try {
    const fromJsonLd = extractJsonLdRecipe(html);
    if (fromJsonLd) {
      const validated = recipeSchema.safeParse(fromJsonLd);
      if (validated.success) {
        console.log("[recipe] Extracted via JSON-LD");
        return validated.data as ExtractedRecipe;
      }
    }
  } catch {
    // JSON-LD parsing failed, fall through to AI
  }

  // 3. AI fallback with strict prompt
  const content = extractMainContent(html);

  const systemPrompt = "You are a recipe extraction specialist. Extract structured recipe data from webpage content. Return ONLY valid JSON matching the exact schema specified.";
  const userPrompt = `Extract the recipe from this content. Return a JSON object with EXACTLY these fields:

{
  "title": "Recipe Name",
  "description": "Brief description or null",
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "instructions": ["Step 1 text", "Step 2 text"],
  "ingredients": [{"name": "flour", "quantity": 2, "unit": "cup"}],
  "tags": ["dinner", "easy"],
  "imageUrl": null
}

Rules:
- title: required, non-empty string
- servings: number, default 4 if not found
- prepTime/cookTime: minutes as number, null if not found
- instructions: array of strings, at least 1 step
- ingredients: each MUST have name (string), quantity (number, default 1), unit (string, default "item")
- tags: array of lowercase strings
- imageUrl: URL string or null

Content:
${content}`;

  try {
    const raw = await callProvider(provider, model, systemPrompt, userPrompt);
    const json = extractJson(raw);
    const parsed = JSON.parse(json);
    const validated = recipeSchema.safeParse(parsed);
    if (validated.success) {
      console.log("[recipe] Extracted via AI fallback");
      return validated.data as ExtractedRecipe;
    }
    console.error("[recipe] AI response failed Zod validation:", validated.error.issues);
    return null;
  } catch (error) {
    console.error("[recipe] AI extraction failed:", error);
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

// ─── Video recipe extraction ──────────────────────────────────────────────

import {
  isVideoUrl as _isVideoUrl,
  extractTikTokVideoUrl,
  getYouTubeVideoId,
  downloadToTmp,
  uploadToGeminiFileApi,
  cleanupTmpFile,
  type VideoPlatform,
} from "./video-parser";

export { _isVideoUrl as isVideoUrl };

const VIDEO_RECIPE_SYSTEM_PROMPT = `You are a recipe extraction specialist analyzing a cooking video. Watch the entire video carefully, paying attention to both visual and audio content.`;

const VIDEO_RECIPE_USER_PROMPT = `Watch this cooking video and extract the complete recipe. Pay attention to:
- Ingredients shown, mentioned, or measured (with quantities when visible/stated)
- The cooking steps in chronological order
- Prep time and cook time if mentioned
- The name of the dish

Return a JSON object with EXACTLY these fields:
{
  "title": "Dish name",
  "description": "Brief description or null",
  "servings": 4,
  "prepTime": 15,
  "cookTime": 30,
  "instructions": ["Step 1", "Step 2"],
  "ingredients": [{"name": "flour", "quantity": 2, "unit": "cup"}],
  "tags": ["tiktok", "quick", "dinner"],
  "imageUrl": null
}

If you can't determine an exact quantity, estimate based on what you see.
If you can't determine the dish name, describe what was cooked.
Every ingredient MUST have name, quantity (number, default 1), and unit (string, default "item").`;

/**
 * Extract a recipe from a video URL (TikTok, YouTube).
 * Downloads/uploads the video and sends to Gemini for multimodal analysis.
 */
export async function extractRecipeFromVideo(
  url: string,
  platform: VideoPlatform
): Promise<ExtractedRecipe | null> {
  const { provider, available } = getProviderForTask("recipe");
  if (provider !== "gemini" || !available) {
    console.error("[video] Video extraction requires Gemini. Provider:", provider, "Available:", available);
    return null;
  }

  const apiKey = getProviderConfig().geminiApiKey;
  if (!apiKey) return null;

  let fileUri: string | null = null;
  let tmpPath: string | null = null;

  try {
    if (platform === "youtube") {
      // Try passing YouTube URL directly to Gemini
      // Gemini may support YouTube URLs natively (Google-to-Google)
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        // Use the YouTube URL as the file URI directly
        fileUri = `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    if (platform === "tiktok") {
      // Extract video URL from TikTok page, download, upload to Gemini
      const videoUrl = await extractTikTokVideoUrl(url);
      if (!videoUrl) {
        console.error("[video] Could not extract video URL from TikTok page");
        return null;
      }

      tmpPath = await downloadToTmp(videoUrl);
      fileUri = await uploadToGeminiFileApi(tmpPath);
      if (!fileUri) {
        console.error("[video] Failed to upload video to Gemini File API");
        return null;
      }
    }

    if (!fileUri) {
      console.error("[video] No file URI available for platform:", platform);
      return null;
    }

    // Call Gemini with the video
    const raw = await callGemini(
      apiKey,
      "gemini-2.5-flash",
      VIDEO_RECIPE_SYSTEM_PROMPT,
      VIDEO_RECIPE_USER_PROMPT,
      undefined, // no base64 image
      undefined, // no image mime type
      fileUri,
      "video/mp4"
    );

    const json = extractJson(raw);
    const parsed = JSON.parse(json);
    const validated = recipeSchema.safeParse(parsed);

    if (validated.success) {
      console.log(`[video] Successfully extracted recipe from ${platform} video`);
      return validated.data as ExtractedRecipe;
    }

    console.error("[video] Gemini response failed Zod validation:", validated.error.issues);
    return null;
  } catch (error) {
    console.error("[video] Video recipe extraction failed:", error);
    return null;
  } finally {
    if (tmpPath) cleanupTmpFile(tmpPath);
  }
}

// ─── Daily meal assignment generation (P0 Autopilot) ─────────────────────

// Fallback meals + types live in fallback-meals.ts (no server deps) so
// client components can import them without dragging fs/crypto into the
// browser bundle. Re-exported here for existing server-side consumers.
import { getFallbackMeal, type DailyAssignmentData } from "./fallback-meals";
export { getFallbackMeal };
export type { DailyAssignmentData };


/**
 * Generate a daily meal assignment using AI.
 * Falls back to curated meals on failure.
 */
export async function generateDailyAssignment(
  expiringItems: { name: string; daysLeft: number }[],
  allPantryItems: string[],
  recentMealNames: string[],
  scenario: string,
  headcount: number
): Promise<DailyAssignmentData> {
  const { provider, model, available } = getProviderForTask("assignment");

  if (!available || allPantryItems.length === 0) {
    return getFallbackMeal(recentMealNames);
  }

  const expiringContext = expiringItems.length > 0
    ? `Items expiring soon: ${expiringItems.map(i => `${i.name} (${i.daysLeft} days left)`).join(", ")}.`
    : "No items expiring soon.";

  const systemPrompt = `You are a meal assignment engine for a neurodivergent user who needs zero-decision daily meal assignments. Prioritize using ingredients that are expiring soonest. Keep meals simple — under 30 minutes, under 6 ingredients preferred.`;

  const userPrompt = `Household: ${scenario} with ${headcount} people.
${expiringContext}
Available pantry items: ${allPantryItems.join(", ")}.
Recent meals to avoid repeating: ${recentMealNames.join(", ") || "none"}.

Generate exactly ONE dinner assignment for tonight. Return JSON:
{
  "mealName": "string",
  "ingredients": [{"name": "string", "fromPantry": true/false, "expiring": true/false}],
  "steps": ["string max 1 sentence each, 4-6 steps"],
  "prepMinutes": number,
  "usesExpiring": ["names of expiring items this meal uses"],
  "reason": "1 sentence why this meal was chosen"
}`;

  try {
    const raw = await callProvider(provider, model, systemPrompt, userPrompt);
    const json = extractJson(raw);
    const parsed = JSON.parse(json);

    // Validate required fields
    if (!parsed.mealName || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      console.error("[ai] Invalid meal assignment structure, using fallback");
      return getFallbackMeal(recentMealNames);
    }

    return {
      mealName: parsed.mealName,
      ingredients: parsed.ingredients || [],
      steps: parsed.steps,
      prepMinutes: parsed.prepMinutes || 30,
      usesExpiring: parsed.usesExpiring || [],
      reason: parsed.reason || "AI-generated meal suggestion",
    };
  } catch (error) {
    console.error("[ai] Meal assignment generation failed, using fallback:", error);
    return getFallbackMeal(recentMealNames);
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
    imageUrl: null,
  };
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
