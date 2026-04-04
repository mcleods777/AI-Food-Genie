import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFallbackMeal } from "../ai";

// Mock the providers module
vi.mock("../providers", () => ({
  getProviderForTask: vi.fn(() => ({ provider: "gemini", model: "gemini-2.5-flash", available: false })),
  getProviderConfig: vi.fn(() => ({ geminiApiKey: null, claudeApiKey: null, openaiApiKey: null })),
}));

// Mock the expiration module
vi.mock("../expiration", () => ({
  estimateExpiration: vi.fn(() => ({ days: 7, reason: "Default estimate" })),
}));

describe("getFallbackMeal", () => {
  it("returns a meal with all required fields", () => {
    const meal = getFallbackMeal([]);
    expect(meal).toHaveProperty("mealName");
    expect(meal).toHaveProperty("ingredients");
    expect(meal).toHaveProperty("steps");
    expect(meal).toHaveProperty("prepMinutes");
    expect(meal).toHaveProperty("usesExpiring");
    expect(meal).toHaveProperty("reason");
    expect(typeof meal.mealName).toBe("string");
    expect(Array.isArray(meal.ingredients)).toBe(true);
    expect(Array.isArray(meal.steps)).toBe(true);
    expect(typeof meal.prepMinutes).toBe("number");
    expect(meal.steps.length).toBeGreaterThan(0);
  });

  it("avoids recent meal names", () => {
    const firstMeal = getFallbackMeal([]);
    const secondMeal = getFallbackMeal([firstMeal.mealName]);
    expect(secondMeal.mealName).not.toBe(firstMeal.mealName);
  });

  it("cycles through meals based on day of year", () => {
    // Same day, same recent history → same meal
    const meal1 = getFallbackMeal(["NonexistentMeal"]);
    const meal2 = getFallbackMeal(["NonexistentMeal"]);
    expect(meal1.mealName).toBe(meal2.mealName);
  });

  it("returns a meal even when all 20 are in recent history", () => {
    const allMealNames = Array.from({ length: 25 }, (_, i) => `Meal ${i}`);
    const meal = getFallbackMeal(allMealNames);
    expect(meal).toBeDefined();
    expect(meal.mealName).toBeTruthy();
  });

  it("ingredients have expected structure", () => {
    const meal = getFallbackMeal([]);
    for (const ing of meal.ingredients) {
      expect(ing).toHaveProperty("name");
      expect(ing).toHaveProperty("fromPantry");
      expect(ing).toHaveProperty("expiring");
      expect(typeof ing.name).toBe("string");
      expect(typeof ing.fromPantry).toBe("boolean");
      expect(typeof ing.expiring).toBe("boolean");
    }
  });

  it("fallback meals have reasonable prep times", () => {
    const meal = getFallbackMeal([]);
    expect(meal.prepMinutes).toBeGreaterThanOrEqual(5);
    expect(meal.prepMinutes).toBeLessThanOrEqual(30);
  });

  it("fallback meals have empty usesExpiring (no pantry awareness)", () => {
    const meal = getFallbackMeal([]);
    expect(meal.usesExpiring).toEqual([]);
  });
});

describe("generateDailyAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback meal when no provider is available", async () => {
    const { generateDailyAssignment } = await import("../ai");
    const meal = await generateDailyAssignment([], [], [], "solo", 1);
    expect(meal).toBeDefined();
    expect(meal.mealName).toBeTruthy();
    expect(Array.isArray(meal.steps)).toBe(true);
  });

  it("returns fallback meal when pantry is empty", async () => {
    const { generateDailyAssignment } = await import("../ai");
    const meal = await generateDailyAssignment([], [], [], "with_kids", 4);
    expect(meal).toBeDefined();
    expect(meal.mealName).toBeTruthy();
  });

  it("avoids recent meals in fallback", async () => {
    const { generateDailyAssignment } = await import("../ai");
    const first = await generateDailyAssignment([], [], [], "solo", 1);
    const second = await generateDailyAssignment([], [], [first.mealName], "solo", 1);
    expect(second.mealName).not.toBe(first.mealName);
  });
});
