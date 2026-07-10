// Curated fallback meals and daily-assignment types.
// Standalone module with ZERO server-only imports: this is consumed by
// client components (TonightsMeal), so nothing here may pull in fs,
// crypto, or the AI/provider layer — that breaks the browser bundle.

export interface DailyAssignmentData {
  mealName: string;
  ingredients: { name: string; fromPantry: boolean; expiring: boolean }[];
  steps: string[];
  prepMinutes: number;
  usesExpiring: string[];
  reason: string;
}

// 20 curated fallback meals for when AI is unavailable or pantry is empty.
// Cycle through these based on day-of-year to avoid repeats within a week.
const FALLBACK_MEALS: DailyAssignmentData[] = [
  { mealName: "Pasta with Garlic Butter", ingredients: [{ name: "Pasta", fromPantry: false, expiring: false }, { name: "Butter", fromPantry: false, expiring: false }, { name: "Garlic", fromPantry: false, expiring: false }], steps: ["Boil pasta until al dente.", "Melt butter with minced garlic.", "Toss pasta in garlic butter.", "Season with salt and pepper."], prepMinutes: 15, usesExpiring: [], reason: "Simple pantry staple meal" },
  { mealName: "Bean Tacos", ingredients: [{ name: "Tortillas", fromPantry: false, expiring: false }, { name: "Canned beans", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }], steps: ["Warm beans in a pot.", "Heat tortillas.", "Fill tortillas with beans and cheese.", "Add any toppings you have."], prepMinutes: 10, usesExpiring: [], reason: "Quick, kid-friendly" },
  { mealName: "Fried Rice", ingredients: [{ name: "Rice", fromPantry: false, expiring: false }, { name: "Eggs", fromPantry: false, expiring: false }, { name: "Soy sauce", fromPantry: false, expiring: false }], steps: ["Cook rice if not leftover.", "Scramble eggs in hot pan.", "Add rice and soy sauce.", "Stir-fry until heated through.", "Add any vegetables you have."], prepMinutes: 20, usesExpiring: [], reason: "Uses leftovers well" },
  { mealName: "Grilled Cheese & Tomato Soup", ingredients: [{ name: "Bread", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }, { name: "Canned tomato soup", fromPantry: false, expiring: false }], steps: ["Heat soup in a pot.", "Butter bread slices.", "Add cheese between bread.", "Grill in pan until golden.", "Serve with soup."], prepMinutes: 15, usesExpiring: [], reason: "Comfort food classic" },
  { mealName: "Scrambled Eggs & Toast", ingredients: [{ name: "Eggs", fromPantry: false, expiring: false }, { name: "Bread", fromPantry: false, expiring: false }, { name: "Butter", fromPantry: false, expiring: false }], steps: ["Whisk eggs with a splash of milk.", "Scramble in buttered pan over low heat.", "Toast bread.", "Serve together."], prepMinutes: 10, usesExpiring: [], reason: "Breakfast for dinner" },
  { mealName: "Quesadillas", ingredients: [{ name: "Tortillas", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }], steps: ["Place cheese on half a tortilla.", "Fold in half.", "Cook in dry pan until crispy and cheese melts.", "Cut into wedges."], prepMinutes: 10, usesExpiring: [], reason: "Minimal ingredients needed" },
  { mealName: "Spaghetti with Marinara", ingredients: [{ name: "Spaghetti", fromPantry: false, expiring: false }, { name: "Marinara sauce", fromPantry: false, expiring: false }], steps: ["Boil spaghetti.", "Heat marinara sauce.", "Drain pasta and top with sauce.", "Add parmesan if you have it."], prepMinutes: 15, usesExpiring: [], reason: "Always works" },
  { mealName: "PB&J with Fruit", ingredients: [{ name: "Bread", fromPantry: false, expiring: false }, { name: "Peanut butter", fromPantry: false, expiring: false }, { name: "Jelly", fromPantry: false, expiring: false }], steps: ["Spread peanut butter on one slice.", "Spread jelly on the other.", "Put together.", "Slice any fruit you have on the side."], prepMinutes: 5, usesExpiring: [], reason: "Zero cooking required" },
  { mealName: "Chicken Stir-Fry", ingredients: [{ name: "Chicken", fromPantry: false, expiring: false }, { name: "Vegetables", fromPantry: false, expiring: false }, { name: "Soy sauce", fromPantry: false, expiring: false }, { name: "Rice", fromPantry: false, expiring: false }], steps: ["Cut chicken into strips.", "Stir-fry chicken until cooked.", "Add chopped vegetables.", "Add soy sauce.", "Serve over rice."], prepMinutes: 25, usesExpiring: [], reason: "Uses whatever vegetables you have" },
  { mealName: "Baked Potatoes", ingredients: [{ name: "Potatoes", fromPantry: false, expiring: false }, { name: "Butter", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }], steps: ["Poke potatoes with fork.", "Microwave 5 min per potato.", "Split open and add butter.", "Top with cheese and anything else."], prepMinutes: 10, usesExpiring: [], reason: "Filling and easy" },
  { mealName: "Tuna Sandwiches", ingredients: [{ name: "Canned tuna", fromPantry: false, expiring: false }, { name: "Mayo", fromPantry: false, expiring: false }, { name: "Bread", fromPantry: false, expiring: false }], steps: ["Drain tuna.", "Mix with mayo.", "Spread on bread.", "Add lettuce if available."], prepMinutes: 5, usesExpiring: [], reason: "No cooking needed" },
  { mealName: "Mac and Cheese", ingredients: [{ name: "Macaroni", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }, { name: "Milk", fromPantry: false, expiring: false }, { name: "Butter", fromPantry: false, expiring: false }], steps: ["Boil macaroni.", "Melt butter in pot, add milk.", "Stir in cheese until melted.", "Add drained pasta and mix."], prepMinutes: 20, usesExpiring: [], reason: "Kid-approved every time" },
  { mealName: "Ramen Upgrade", ingredients: [{ name: "Instant ramen", fromPantry: false, expiring: false }, { name: "Egg", fromPantry: false, expiring: false }], steps: ["Cook ramen per package.", "Soft-boil an egg (6 min).", "Add egg to ramen.", "Add any vegetables or leftovers you have."], prepMinutes: 10, usesExpiring: [], reason: "Fast and satisfying" },
  { mealName: "Pancakes", ingredients: [{ name: "Flour", fromPantry: false, expiring: false }, { name: "Eggs", fromPantry: false, expiring: false }, { name: "Milk", fromPantry: false, expiring: false }], steps: ["Mix flour, egg, and milk.", "Pour batter on hot greased pan.", "Flip when bubbles form.", "Serve with syrup or fruit."], prepMinutes: 15, usesExpiring: [], reason: "Breakfast for dinner" },
  { mealName: "Pizza Toast", ingredients: [{ name: "Bread", fromPantry: false, expiring: false }, { name: "Tomato sauce", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }], steps: ["Spread sauce on bread.", "Top with cheese.", "Broil until cheese melts.", "Add any toppings."], prepMinutes: 10, usesExpiring: [], reason: "Fun and fast" },
  { mealName: "Veggie Soup", ingredients: [{ name: "Broth", fromPantry: false, expiring: false }, { name: "Mixed vegetables", fromPantry: false, expiring: false }], steps: ["Bring broth to a boil.", "Add chopped vegetables.", "Simmer 15 minutes.", "Season to taste."], prepMinutes: 20, usesExpiring: [], reason: "Uses whatever is in the fridge" },
  { mealName: "Nachos", ingredients: [{ name: "Tortilla chips", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }, { name: "Beans", fromPantry: false, expiring: false }], steps: ["Spread chips on baking sheet.", "Top with beans and cheese.", "Broil until cheese melts.", "Add salsa or any toppings."], prepMinutes: 10, usesExpiring: [], reason: "Fun family meal" },
  { mealName: "Omelette", ingredients: [{ name: "Eggs", fromPantry: false, expiring: false }, { name: "Cheese", fromPantry: false, expiring: false }], steps: ["Whisk eggs.", "Pour into buttered pan over medium heat.", "Add cheese and any fillings.", "Fold when edges set.", "Serve with toast."], prepMinutes: 10, usesExpiring: [], reason: "Uses whatever you have" },
  { mealName: "BLT Wraps", ingredients: [{ name: "Tortillas", fromPantry: false, expiring: false }, { name: "Bacon", fromPantry: false, expiring: false }, { name: "Lettuce", fromPantry: false, expiring: false }, { name: "Tomato", fromPantry: false, expiring: false }], steps: ["Cook bacon until crispy.", "Lay out tortillas.", "Add bacon, lettuce, and tomato.", "Roll up and cut in half."], prepMinutes: 15, usesExpiring: [], reason: "Classic combo" },
  { mealName: "Rice and Beans", ingredients: [{ name: "Rice", fromPantry: false, expiring: false }, { name: "Canned beans", fromPantry: false, expiring: false }, { name: "Spices", fromPantry: false, expiring: false }], steps: ["Cook rice.", "Heat beans with cumin and garlic.", "Serve beans over rice.", "Top with hot sauce if available."], prepMinutes: 20, usesExpiring: [], reason: "Cheap, filling, nutritious" },
];

/**
 * Get a fallback meal from the curated rotation.
 * Uses day-of-year modulo 20 to cycle, then checks recent assignments to avoid repeats.
 */
export function getFallbackMeal(recentMealNames: string[]): DailyAssignmentData {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const startIndex = dayOfYear % FALLBACK_MEALS.length;

  // Find the first meal not in recent history
  for (let i = 0; i < FALLBACK_MEALS.length; i++) {
    const meal = FALLBACK_MEALS[(startIndex + i) % FALLBACK_MEALS.length];
    if (!recentMealNames.includes(meal.mealName)) {
      return meal;
    }
  }
  // If somehow all 20 are recent, just return the day's default
  return FALLBACK_MEALS[startIndex];
}
