// Smart expiration date estimation based on item type, storage location, and opened status.
// Data sourced from USDA FoodKeeper app guidelines and general food safety references.

interface ExpiryEstimate {
  days: number;
  reason: string;
}

interface StorageShelfLife {
  pantry?: { sealed: number; opened: number };
  refrigerator?: { sealed: number; opened: number };
  freezer?: { sealed: number; opened: number };
  cabinet?: { sealed: number; opened: number };
}

// Shelf life database: days until expiration by item keyword, storage, and opened status
// Values represent typical shelf life in days
const SHELF_LIFE_DB: Record<string, StorageShelfLife> = {
  // === DAIRY ===
  milk: {
    refrigerator: { sealed: 10, opened: 7 },
    freezer: { sealed: 90, opened: 90 },
  },
  "whole milk": {
    refrigerator: { sealed: 10, opened: 7 },
  },
  "skim milk": {
    refrigerator: { sealed: 10, opened: 7 },
  },
  "almond milk": {
    pantry: { sealed: 180, opened: 10 },
    refrigerator: { sealed: 10, opened: 7 },
  },
  "oat milk": {
    pantry: { sealed: 180, opened: 10 },
    refrigerator: { sealed: 10, opened: 7 },
  },
  cream: {
    refrigerator: { sealed: 21, opened: 7 },
  },
  "heavy cream": {
    refrigerator: { sealed: 21, opened: 7 },
  },
  "sour cream": {
    refrigerator: { sealed: 21, opened: 14 },
  },
  yogurt: {
    refrigerator: { sealed: 21, opened: 7 },
    freezer: { sealed: 60, opened: 60 },
  },
  "greek yogurt": {
    refrigerator: { sealed: 14, opened: 5 },
  },
  butter: {
    refrigerator: { sealed: 90, opened: 30 },
    freezer: { sealed: 365, opened: 365 },
    pantry: { sealed: 7, opened: 2 },
  },
  cheese: {
    refrigerator: { sealed: 30, opened: 14 },
    freezer: { sealed: 180, opened: 180 },
  },
  "cheddar cheese": {
    refrigerator: { sealed: 45, opened: 21 },
    freezer: { sealed: 180, opened: 180 },
  },
  "mozzarella": {
    refrigerator: { sealed: 21, opened: 7 },
    freezer: { sealed: 180, opened: 180 },
  },
  "parmesan": {
    refrigerator: { sealed: 180, opened: 60 },
    freezer: { sealed: 365, opened: 365 },
  },
  "cream cheese": {
    refrigerator: { sealed: 30, opened: 10 },
  },
  "cottage cheese": {
    refrigerator: { sealed: 14, opened: 7 },
  },
  eggs: {
    refrigerator: { sealed: 35, opened: 35 },
  },

  // === MEAT & POULTRY ===
  "chicken breast": {
    refrigerator: { sealed: 3, opened: 2 },
    freezer: { sealed: 270, opened: 270 },
  },
  chicken: {
    refrigerator: { sealed: 3, opened: 2 },
    freezer: { sealed: 270, opened: 270 },
  },
  "ground chicken": {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 120, opened: 120 },
  },
  "ground beef": {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 120, opened: 120 },
  },
  "ground turkey": {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 120, opened: 120 },
  },
  beef: {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 365, opened: 365 },
  },
  steak: {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 365, opened: 365 },
  },
  pork: {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 180, opened: 180 },
  },
  "pork chops": {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 180, opened: 180 },
  },
  bacon: {
    refrigerator: { sealed: 14, opened: 7 },
    freezer: { sealed: 30, opened: 30 },
  },
  "deli meat": {
    refrigerator: { sealed: 7, opened: 5 },
    freezer: { sealed: 60, opened: 60 },
  },
  ham: {
    refrigerator: { sealed: 7, opened: 5 },
    freezer: { sealed: 60, opened: 60 },
  },
  turkey: {
    refrigerator: { sealed: 3, opened: 2 },
    freezer: { sealed: 270, opened: 270 },
  },
  sausage: {
    refrigerator: { sealed: 7, opened: 3 },
    freezer: { sealed: 60, opened: 60 },
  },
  "hot dogs": {
    refrigerator: { sealed: 14, opened: 7 },
    freezer: { sealed: 60, opened: 60 },
  },

  // === SEAFOOD ===
  fish: {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 180, opened: 180 },
  },
  salmon: {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 180, opened: 180 },
  },
  shrimp: {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 180, opened: 180 },
  },
  tuna: {
    refrigerator: { sealed: 2, opened: 1 },
    freezer: { sealed: 90, opened: 90 },
  },

  // === PRODUCE ===
  apples: {
    pantry: { sealed: 7, opened: 7 },
    refrigerator: { sealed: 30, opened: 30 },
  },
  bananas: {
    pantry: { sealed: 7, opened: 3 },
    refrigerator: { sealed: 7, opened: 5 },
  },
  oranges: {
    pantry: { sealed: 7, opened: 7 },
    refrigerator: { sealed: 21, opened: 21 },
  },
  berries: {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 365, opened: 365 },
  },
  strawberries: {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 365, opened: 365 },
  },
  blueberries: {
    refrigerator: { sealed: 7, opened: 5 },
    freezer: { sealed: 365, opened: 365 },
  },
  grapes: {
    refrigerator: { sealed: 10, opened: 7 },
  },
  lemons: {
    pantry: { sealed: 7, opened: 3 },
    refrigerator: { sealed: 28, opened: 21 },
  },
  limes: {
    pantry: { sealed: 7, opened: 3 },
    refrigerator: { sealed: 28, opened: 21 },
  },
  avocado: {
    pantry: { sealed: 5, opened: 2 },
    refrigerator: { sealed: 7, opened: 2 },
  },
  tomatoes: {
    pantry: { sealed: 7, opened: 3 },
    refrigerator: { sealed: 10, opened: 5 },
  },
  lettuce: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  spinach: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  kale: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  broccoli: {
    refrigerator: { sealed: 7, opened: 5 },
    freezer: { sealed: 365, opened: 365 },
  },
  carrots: {
    pantry: { sealed: 7, opened: 5 },
    refrigerator: { sealed: 28, opened: 21 },
  },
  celery: {
    refrigerator: { sealed: 14, opened: 10 },
  },
  peppers: {
    refrigerator: { sealed: 10, opened: 5 },
    freezer: { sealed: 365, opened: 365 },
  },
  "bell pepper": {
    refrigerator: { sealed: 10, opened: 5 },
  },
  cucumber: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  onions: {
    pantry: { sealed: 60, opened: 10 },
    refrigerator: { sealed: 60, opened: 10 },
  },
  garlic: {
    pantry: { sealed: 90, opened: 14 },
    refrigerator: { sealed: 90, opened: 14 },
  },
  potatoes: {
    pantry: { sealed: 35, opened: 35 },
    refrigerator: { sealed: 21, opened: 21 },
  },
  "sweet potatoes": {
    pantry: { sealed: 28, opened: 28 },
  },
  mushrooms: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  corn: {
    refrigerator: { sealed: 5, opened: 3 },
    freezer: { sealed: 365, opened: 365 },
  },
  zucchini: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  herbs: {
    refrigerator: { sealed: 10, opened: 7 },
  },
  cilantro: {
    refrigerator: { sealed: 10, opened: 7 },
  },
  basil: {
    refrigerator: { sealed: 7, opened: 5 },
  },
  parsley: {
    refrigerator: { sealed: 10, opened: 7 },
  },

  // === GRAINS & BREAD ===
  bread: {
    pantry: { sealed: 7, opened: 5 },
    refrigerator: { sealed: 14, opened: 10 },
    freezer: { sealed: 90, opened: 90 },
  },
  "tortillas": {
    pantry: { sealed: 14, opened: 7 },
    refrigerator: { sealed: 30, opened: 14 },
    freezer: { sealed: 180, opened: 180 },
  },
  bagels: {
    pantry: { sealed: 5, opened: 3 },
    freezer: { sealed: 90, opened: 90 },
  },
  pasta: {
    pantry: { sealed: 730, opened: 365 },
  },
  rice: {
    pantry: { sealed: 730, opened: 365 },
  },
  "brown rice": {
    pantry: { sealed: 180, opened: 90 },
    refrigerator: { sealed: 365, opened: 180 },
  },
  oats: {
    pantry: { sealed: 365, opened: 180 },
  },
  cereal: {
    pantry: { sealed: 270, opened: 90 },
  },
  flour: {
    pantry: { sealed: 365, opened: 180 },
    freezer: { sealed: 730, opened: 730 },
  },
  "whole wheat flour": {
    pantry: { sealed: 90, opened: 30 },
    refrigerator: { sealed: 180, opened: 90 },
    freezer: { sealed: 365, opened: 365 },
  },
  crackers: {
    pantry: { sealed: 270, opened: 30 },
  },

  // === CANNED & JARRED ===
  "canned tomatoes": {
    pantry: { sealed: 730, opened: 5 },
    refrigerator: { sealed: 730, opened: 7 },
  },
  "canned beans": {
    pantry: { sealed: 730, opened: 5 },
    refrigerator: { sealed: 730, opened: 7 },
  },
  "canned tuna": {
    pantry: { sealed: 1095, opened: 3 },
    refrigerator: { sealed: 1095, opened: 5 },
  },
  "canned soup": {
    pantry: { sealed: 730, opened: 3 },
    refrigerator: { sealed: 730, opened: 5 },
  },
  "canned vegetables": {
    pantry: { sealed: 730, opened: 5 },
    refrigerator: { sealed: 730, opened: 7 },
  },
  "canned fruit": {
    pantry: { sealed: 730, opened: 5 },
    refrigerator: { sealed: 730, opened: 7 },
  },
  "pasta sauce": {
    pantry: { sealed: 365, opened: 7 },
    refrigerator: { sealed: 365, opened: 10 },
  },
  salsa: {
    pantry: { sealed: 365, opened: 14 },
    refrigerator: { sealed: 365, opened: 14 },
  },
  "peanut butter": {
    pantry: { sealed: 365, opened: 90 },
  },
  "almond butter": {
    pantry: { sealed: 365, opened: 90 },
    refrigerator: { sealed: 365, opened: 180 },
  },
  jam: {
    pantry: { sealed: 365, opened: 30 },
    refrigerator: { sealed: 365, opened: 90 },
  },
  jelly: {
    pantry: { sealed: 365, opened: 30 },
    refrigerator: { sealed: 365, opened: 90 },
  },
  honey: {
    pantry: { sealed: 730, opened: 730 },
  },
  "maple syrup": {
    pantry: { sealed: 365, opened: 365 },
    refrigerator: { sealed: 365, opened: 365 },
  },

  // === CONDIMENTS & SAUCES ===
  ketchup: {
    pantry: { sealed: 365, opened: 180 },
    refrigerator: { sealed: 365, opened: 180 },
  },
  mustard: {
    pantry: { sealed: 365, opened: 365 },
    refrigerator: { sealed: 365, opened: 365 },
  },
  mayonnaise: {
    pantry: { sealed: 365, opened: 60 },
    refrigerator: { sealed: 365, opened: 60 },
  },
  "soy sauce": {
    pantry: { sealed: 1095, opened: 730 },
    refrigerator: { sealed: 1095, opened: 1095 },
  },
  "hot sauce": {
    pantry: { sealed: 1095, opened: 365 },
    refrigerator: { sealed: 1095, opened: 730 },
  },
  "olive oil": {
    pantry: { sealed: 730, opened: 180 },
    cabinet: { sealed: 730, opened: 180 },
  },
  "vegetable oil": {
    pantry: { sealed: 730, opened: 365 },
  },
  "coconut oil": {
    pantry: { sealed: 730, opened: 365 },
  },
  vinegar: {
    pantry: { sealed: 1825, opened: 1825 },
  },
  "balsamic vinegar": {
    pantry: { sealed: 1095, opened: 1095 },
  },
  "salad dressing": {
    refrigerator: { sealed: 90, opened: 30 },
  },
  "bbq sauce": {
    pantry: { sealed: 365, opened: 120 },
    refrigerator: { sealed: 365, opened: 120 },
  },
  "worcestershire sauce": {
    pantry: { sealed: 1095, opened: 365 },
  },

  // === SPICES ===
  salt: {
    pantry: { sealed: 1825, opened: 1825 },
    cabinet: { sealed: 1825, opened: 1825 },
  },
  "black pepper": {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  "garlic powder": {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  "onion powder": {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  paprika: {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  cumin: {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  "chili powder": {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  oregano: {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  cinnamon: {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  "baking powder": {
    pantry: { sealed: 540, opened: 180 },
  },
  "baking soda": {
    pantry: { sealed: 1095, opened: 180 },
  },
  sugar: {
    pantry: { sealed: 730, opened: 730 },
    cabinet: { sealed: 730, opened: 730 },
  },
  "brown sugar": {
    pantry: { sealed: 730, opened: 120 },
  },
  "powdered sugar": {
    pantry: { sealed: 730, opened: 730 },
  },

  // === BEVERAGES ===
  juice: {
    pantry: { sealed: 365, opened: 7 },
    refrigerator: { sealed: 365, opened: 7 },
  },
  "orange juice": {
    refrigerator: { sealed: 14, opened: 7 },
  },
  soda: {
    pantry: { sealed: 270, opened: 1 },
    refrigerator: { sealed: 270, opened: 1 },
  },
  coffee: {
    pantry: { sealed: 365, opened: 30 },
    freezer: { sealed: 730, opened: 365 },
  },
  "ground coffee": {
    pantry: { sealed: 365, opened: 14 },
    freezer: { sealed: 730, opened: 365 },
  },
  tea: {
    pantry: { sealed: 730, opened: 365 },
    cabinet: { sealed: 730, opened: 365 },
  },
  wine: {
    pantry: { sealed: 730, opened: 5 },
    refrigerator: { sealed: 730, opened: 5 },
  },
  beer: {
    refrigerator: { sealed: 180, opened: 1 },
    pantry: { sealed: 180, opened: 1 },
  },

  // === FROZEN ===
  "ice cream": {
    freezer: { sealed: 60, opened: 30 },
  },
  "frozen pizza": {
    freezer: { sealed: 120, opened: 120 },
  },
  "frozen vegetables": {
    freezer: { sealed: 365, opened: 240 },
  },
  "frozen fruit": {
    freezer: { sealed: 365, opened: 240 },
  },
  "frozen meals": {
    freezer: { sealed: 120, opened: 120 },
  },
  "frozen waffles": {
    freezer: { sealed: 120, opened: 90 },
  },

  // === SNACKS ===
  chips: {
    pantry: { sealed: 90, opened: 14 },
  },
  cookies: {
    pantry: { sealed: 60, opened: 14 },
  },
  "granola bars": {
    pantry: { sealed: 270, opened: 270 },
  },
  nuts: {
    pantry: { sealed: 270, opened: 60 },
    refrigerator: { sealed: 365, opened: 180 },
  },
  "dried fruit": {
    pantry: { sealed: 365, opened: 90 },
  },
  popcorn: {
    pantry: { sealed: 365, opened: 14 },
  },
  chocolate: {
    pantry: { sealed: 365, opened: 60 },
  },

  // === BAKING ===
  "vanilla extract": {
    pantry: { sealed: 1825, opened: 1825 },
    cabinet: { sealed: 1825, opened: 1825 },
  },
  "cocoa powder": {
    pantry: { sealed: 1095, opened: 730 },
  },
  "chocolate chips": {
    pantry: { sealed: 730, opened: 120 },
  },
  yeast: {
    pantry: { sealed: 365, opened: 120 },
    refrigerator: { sealed: 365, opened: 120 },
    freezer: { sealed: 730, opened: 365 },
  },
  "cornstarch": {
    pantry: { sealed: 1825, opened: 1825 },
  },

  // === BABY / KIDS ===
  "baby food": {
    pantry: { sealed: 365, opened: 1 },
    refrigerator: { sealed: 365, opened: 2 },
  },
  formula: {
    pantry: { sealed: 365, opened: 30 },
  },
};

// Category-level defaults when no specific item match is found
const CATEGORY_DEFAULTS: Record<string, StorageShelfLife> = {
  Produce: {
    pantry: { sealed: 7, opened: 5 },
    refrigerator: { sealed: 10, opened: 7 },
    freezer: { sealed: 365, opened: 365 },
  },
  Dairy: {
    refrigerator: { sealed: 14, opened: 7 },
    freezer: { sealed: 90, opened: 90 },
  },
  Meat: {
    refrigerator: { sealed: 3, opened: 2 },
    freezer: { sealed: 180, opened: 180 },
  },
  Grain: {
    pantry: { sealed: 365, opened: 180 },
    cabinet: { sealed: 365, opened: 180 },
  },
  Spice: {
    pantry: { sealed: 1095, opened: 730 },
    cabinet: { sealed: 1095, opened: 730 },
  },
  Canned: {
    pantry: { sealed: 730, opened: 5 },
    refrigerator: { sealed: 730, opened: 7 },
  },
  Frozen: {
    freezer: { sealed: 180, opened: 120 },
  },
  Beverage: {
    pantry: { sealed: 365, opened: 7 },
    refrigerator: { sealed: 365, opened: 7 },
  },
  Snack: {
    pantry: { sealed: 180, opened: 30 },
  },
  Condiment: {
    pantry: { sealed: 365, opened: 180 },
    refrigerator: { sealed: 365, opened: 180 },
    cabinet: { sealed: 365, opened: 180 },
  },
  Other: {
    pantry: { sealed: 180, opened: 90 },
    refrigerator: { sealed: 14, opened: 7 },
    freezer: { sealed: 180, opened: 180 },
    cabinet: { sealed: 365, opened: 180 },
  },
};

function normalizeLocation(location: string): "pantry" | "refrigerator" | "freezer" | "cabinet" {
  const lower = location.toLowerCase();
  if (lower.includes("fridge") || lower.includes("refrig")) return "refrigerator";
  if (lower.includes("freez")) return "freezer";
  if (lower.includes("cabin")) return "cabinet";
  return "pantry";
}

function findBestMatch(itemName: string): StorageShelfLife | null {
  const lower = itemName.toLowerCase().trim();

  // Exact match
  if (SHELF_LIFE_DB[lower]) return SHELF_LIFE_DB[lower];

  // Check if item name contains any known key
  for (const [key, value] of Object.entries(SHELF_LIFE_DB)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  // Check individual words
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue; // skip short words
    if (SHELF_LIFE_DB[word]) return SHELF_LIFE_DB[word];
  }

  return null;
}

function formatDays(days: number): string {
  if (days >= 730) return `~${Math.round(days / 365)} years`;
  if (days >= 365) return "~1 year";
  if (days >= 60) return `~${Math.round(days / 30)} months`;
  if (days >= 14) return `~${Math.round(days / 7)} weeks`;
  return `~${days} days`;
}

/**
 * Estimates the expiration date for a food item based on its name, storage location,
 * category, and whether it has been opened.
 */
export function estimateExpiration(
  itemName: string,
  location: string,
  category: string,
  opened: boolean
): ExpiryEstimate {
  const normalizedLoc = normalizeLocation(location);
  const status = opened ? "opened" : "sealed";
  const displayStatus = opened ? "Opened" : "Unopened";

  // Try to find specific item match
  const itemMatch = findBestMatch(itemName);
  if (itemMatch) {
    const locData = itemMatch[normalizedLoc];
    if (locData) {
      const days = locData[status];
      return {
        days,
        reason: `${displayStatus} ${itemName.toLowerCase()}, ${location.toLowerCase()}: ${formatDays(days)}`,
      };
    }

    // Item found but not for this storage location - use best available + note
    const availableLocations = Object.keys(itemMatch) as Array<keyof StorageShelfLife>;
    if (availableLocations.length > 0) {
      const bestLoc = availableLocations[0];
      const bestData = itemMatch[bestLoc]!;
      const days = bestData[status];
      const suggestion = bestLoc === "refrigerator" ? "refrigerate" : `store in ${bestLoc}`;
      return {
        days: Math.max(1, Math.round(days * 0.5)), // Reduce if wrong storage
        reason: `${displayStatus} ${itemName.toLowerCase()} in ${location.toLowerCase()} (best to ${suggestion}): ${formatDays(days)} typical, reduced for non-ideal storage`,
      };
    }
  }

  // Fall back to category defaults
  const categoryDefaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS["Other"];
  const catLocData = categoryDefaults[normalizedLoc];
  if (catLocData) {
    const days = catLocData[status];
    return {
      days,
      reason: `${displayStatus} ${category.toLowerCase()} item, ${location.toLowerCase()}: ${formatDays(days)} (category estimate)`,
    };
  }

  // Absolute fallback
  const fallbackDays = opened ? 7 : 30;
  return {
    days: fallbackDays,
    reason: `${displayStatus} item, ${location.toLowerCase()}: ${formatDays(fallbackDays)} (general estimate)`,
  };
}

/**
 * Recalculates expiration date from a purchase date using the estimation engine.
 */
export function calculateExpirationDate(
  purchaseDate: Date,
  itemName: string,
  location: string,
  category: string,
  opened: boolean
): { date: Date; reason: string } {
  const estimate = estimateExpiration(itemName, location, category, opened);
  const date = new Date(purchaseDate);
  date.setDate(date.getDate() + estimate.days);
  return { date, reason: estimate.reason };
}

/**
 * Returns the estimated shelf life info as a user-friendly summary.
 */
export function getShelfLifeSummary(
  itemName: string,
  location: string,
  category: string
): { sealed: string; opened: string } {
  const sealedEst = estimateExpiration(itemName, location, category, false);
  const openedEst = estimateExpiration(itemName, location, category, true);
  return {
    sealed: sealedEst.reason,
    opened: openedEst.reason,
  };
}
