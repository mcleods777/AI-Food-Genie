// Meat price tracker: fetches current per-store meat prices.
//
// Why AI search instead of scraping (verified 2026-07-10):
// - aldi.us is an Instacart-powered storefront; prices render client-side
//   behind PerimeterX bot protection (0 prices in server-fetched HTML).
// - Hy-Vee's GraphQL API (api.prod.hy-vee.cloud) returns Cloudflare 403
//   on unauthenticated server requests.
// Both would be blocked harder from Vercel datacenter IPs, so we use
// Gemini with Google Search grounding to read current prices from weekly
// ads and store pages instead.
//
// Links: ALWAYS store search URLs (verified to return 200 without sign-in).
// Never deep product links — those rot and 404 (Aldi's Instacart migration
// killed every old product URL).

import { z } from "zod";
import { randomUUID } from "crypto";
import { getProviderConfig } from "./providers";
import { prisma } from "./db";

// ─── Store + cut catalogs ──────────────────────────────────────────────────

export const STORES = ["ALDI", "Hy-Vee"] as const;
export type Store = (typeof STORES)[number];

// Cuts to track. Extend freely — the fetch prompt and UI iterate this list.
export const MEAT_CUTS = [
  "Ribeye",
  "NY Strip",
  "Sirloin",
  "T-Bone",
  "Filet Mignon",
  "Chuck Roast",
  "Brisket",
  "Flank Steak",
  "Skirt Steak",
  "Ground Beef 80/20",
  "Ground Beef 90/10",
  "Stew Meat",
] as const;

// USDA grade sort order (higher = better). Angus is a breed, not a grade,
// but shoppers compare on it, so it ranks between Select and Choice when
// no explicit USDA grade is present.
export const GRADE_RANK: Record<string, number> = {
  Wagyu: 50,
  Prime: 40,
  Choice: 30,
  Angus: 25,
  Select: 20,
  Ungraded: 0,
};

export function parseGrade(productName: string): string {
  const name = productName.toLowerCase();
  if (name.includes("wagyu")) return "Wagyu";
  if (name.includes("prime")) return "Prime";
  if (name.includes("choice")) return "Choice";
  if (name.includes("select")) return "Select";
  if (name.includes("angus")) return "Angus";
  return "Ungraded";
}

/**
 * Build a store search URL for a product query.
 * These are the ONLY link formats we surface — both verified to return
 * HTTP 200 without sign-in or zip cookies (2026-07-10).
 */
export function buildSearchUrl(store: Store, query: string): string {
  const q = encodeURIComponent(query);
  switch (store) {
    case "ALDI":
      return `https://www.aldi.us/store/aldi/search?query=${q}`;
    case "Hy-Vee":
      return `https://www.hy-vee.com/aisles-online/search?search=${q}`;
  }
}

// ─── Fetch via Gemini + Google Search grounding ────────────────────────────

const priceItemSchema = z.object({
  productName: z.string().min(1),
  cut: z.string().min(1),
  pricePerLb: z.coerce.number().positive().nullable().default(null),
  totalPrice: z.coerce.number().positive().nullable().default(null),
  packSize: z.string().nullable().default(null),
  onSale: z.coerce.boolean().default(false),
  saleNote: z.string().nullable().default(null),
  sourceNote: z.string().nullable().default(null),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export type FetchedPrice = z.infer<typeof priceItemSchema> & {
  store: Store;
  grade: string;
  linkUrl: string;
};

function extractJsonArray(text: string): string {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : "[]";
}

/**
 * Call Gemini with Google Search grounding. Grounding cannot be combined
 * with response_mime_type=application/json (API rejects it), so we prompt
 * for JSON and extract it from the text response.
 */
async function callGeminiWithSearch(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8000,
        },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini search call failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
}

function buildStorePrompt(store: Store, zipCode: string | null): string {
  const location = zipCode
    ? `near zip code ${zipCode}`
    : "at typical US midwest locations";
  return `Search the web for CURRENT beef prices at ${store} grocery stores ${location}. Check ${store}'s weekly ad, their website, and recent grocery price reports. Today's prices only — ignore anything older than 2 weeks.

Find prices for as many of these cuts as you can:
${MEAT_CUTS.join(", ")}

Return ONLY a JSON array. Each item:
{
  "productName": "exact product name as sold, including brand/grade words like USDA Choice, Black Angus, Prime",
  "cut": "one of: ${MEAT_CUTS.join(" | ")}",
  "pricePerLb": 9.99 or null if only sold per package,
  "totalPrice": 12.49 or null if priced per lb,
  "packSize": "e.g. ~1.1 lb each, 16 oz, family pack" or null,
  "onSale": true/false,
  "saleNote": "e.g. weekly ad through 7/15, was $12.99/lb" or null,
  "sourceNote": "where you found this price (e.g. ${store} weekly ad, ${store} website)",
  "confidence": 0.0-1.0 how confident you are this price is current and correct for ${store}
}

Rules:
- Include the USDA grade (Prime/Choice/Select) or breed (Angus, Wagyu) in productName whenever the product has one. ${store === "ALDI" ? "ALDI's ribeye and strip steaks are typically USDA Choice Black Angus." : "Hy-Vee sells multiple tiers, e.g. Hy-Vee Choice Reserve (USDA Choice) and Prime Reserve (USDA Prime) — list each tier as a separate item."}
- Only include prices you actually found via search. Skip cuts you cannot find. Do NOT guess or make up prices.
- Set confidence below 0.5 for prices from third-party reports rather than the store itself.
- No text outside the JSON array.`;
}

/**
 * Fetch current prices for one store. Returns validated items with
 * normalized grade and a verified search link.
 */
export async function fetchStorePrices(
  store: Store,
  zipCode: string | null
): Promise<FetchedPrice[]> {
  const apiKey = getProviderConfig().geminiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const raw = await callGeminiWithSearch(apiKey, buildStorePrompt(store, zipCode));
  const parsed: unknown[] = JSON.parse(extractJsonArray(raw));

  const results: FetchedPrice[] = [];
  for (const item of parsed) {
    const validated = priceItemSchema.safeParse(item);
    if (!validated.success) continue;
    const v = validated.data;
    // Drop items with no price at all
    if (v.pricePerLb === null && v.totalPrice === null) continue;
    // Normalize cut to catalog spelling when close; keep as-is otherwise
    const cut =
      MEAT_CUTS.find((c) => c.toLowerCase() === v.cut.toLowerCase()) || v.cut;
    results.push({
      ...v,
      cut,
      store,
      grade: parseGrade(v.productName),
      linkUrl: buildSearchUrl(store, v.productName),
    });
  }
  return results;
}

/**
 * Fetch all stores in parallel. A store failing doesn't sink the batch —
 * we return what succeeded plus per-store errors for the caller to report.
 */
export async function fetchAllMeatPrices(zipCode: string | null): Promise<{
  prices: FetchedPrice[];
  errors: { store: Store; error: string }[];
}> {
  const settled = await Promise.allSettled(
    STORES.map((store) => fetchStorePrices(store, zipCode))
  );

  const prices: FetchedPrice[] = [];
  const errors: { store: Store; error: string }[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      prices.push(...result.value);
    } else {
      errors.push({
        store: STORES[i],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });
  return { prices, errors };
}

// ─── Refresh + persist ─────────────────────────────────────────────────────

/**
 * Run a full price refresh and save the batch. Used by both the daily cron
 * and the manual Refresh button. Reads the zip code from PriceSetting.
 */
export async function refreshMeatPrices(): Promise<{
  batchId: string;
  saved: number;
  errors: { store: Store; error: string }[];
}> {
  const setting = await prisma.priceSetting.findUnique({
    where: { userId: "default" },
  });
  const zipCode = setting?.zipCode || null;

  const { prices, errors } = await fetchAllMeatPrices(zipCode);
  const batchId = randomUUID();

  if (prices.length > 0) {
    await prisma.meatPrice.createMany({
      data: prices.map((p) => ({
        store: p.store,
        productName: p.productName,
        cut: p.cut,
        grade: p.grade,
        pricePerLb: p.pricePerLb,
        totalPrice: p.totalPrice,
        packSize: p.packSize,
        onSale: p.onSale,
        saleNote: p.saleNote,
        sourceNote: p.sourceNote,
        confidence: p.confidence,
        linkUrl: p.linkUrl,
        batchId,
      })),
    });
  }

  return { batchId, saved: prices.length, errors };
}
