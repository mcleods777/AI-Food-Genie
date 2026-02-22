import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  // Clear existing data in dependency order
  await prisma.mealPlanEntry.deleteMany();
  await prisma.shoppingListItem.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.pantryItem.deleteMany();
  await prisma.householdConfig.deleteMany();
  await prisma.auditLog.deleteMany();

  console.log("Cleared existing data");

  // ──────────────────────────────────────────────
  // Household configurations
  // ──────────────────────────────────────────────
  await prisma.householdConfig.createMany({
    data: [
      { name: "Solo", scenario: "solo", headcount: 1, isDefault: true, notes: "Just me" },
      { name: "Kids Week", scenario: "with_kids", headcount: 3, isDefault: false, notes: "50% custody - kids are here" },
      { name: "Date Night", scenario: "with_partner", headcount: 2, isDefault: false, notes: "Partner visits" },
      { name: "Full House", scenario: "with_partner_and_kids", headcount: 4, isDefault: false, notes: "Everyone together" },
      { name: "Holiday/Party", scenario: "special_occasion", headcount: 8, isDefault: false, notes: "Special occasions and gatherings" },
    ],
  });
  console.log("Seeded 5 household configs");

  // ──────────────────────────────────────────────
  // Pantry items — diverse, realistic inventory
  // ──────────────────────────────────────────────
  const now = new Date();

  await prisma.pantryItem.createMany({
    data: [
      // Dairy
      { name: "Whole Milk", category: "Dairy", quantity: 1, unit: "gal", location: "Refrigerator", purchaseDate: addDays(now, -3), expirationDate: addDays(now, 7), expiryEstimateReason: "Unopened milk, refrigerated: ~10 days" },
      { name: "Eggs", category: "Dairy", quantity: 12, unit: "ct", location: "Refrigerator", purchaseDate: addDays(now, -2), expirationDate: addDays(now, 19) },
      { name: "Butter", category: "Dairy", quantity: 1, unit: "lb", location: "Refrigerator", purchaseDate: addDays(now, -5), expirationDate: addDays(now, 55) },
      { name: "Shredded Cheddar", category: "Dairy", quantity: 8, unit: "oz", location: "Refrigerator", purchaseDate: addDays(now, -4), expirationDate: addDays(now, 26), opened: true, expiryEstimateReason: "Opened shredded cheese: ~3-4 weeks" },
      { name: "Greek Yogurt", category: "Dairy", quantity: 4, unit: "ct", location: "Refrigerator", purchaseDate: addDays(now, -1), expirationDate: addDays(now, 13) },
      { name: "Cream Cheese", category: "Dairy", quantity: 1, unit: "item", location: "Refrigerator", purchaseDate: addDays(now, -10), expirationDate: addDays(now, 4), opened: true },

      // Produce
      { name: "Bananas", category: "Produce", quantity: 5, unit: "ct", location: "Pantry", purchaseDate: addDays(now, -2), expirationDate: addDays(now, 3) },
      { name: "Romaine Lettuce", category: "Produce", quantity: 1, unit: "item", location: "Refrigerator", purchaseDate: addDays(now, -3), expirationDate: addDays(now, 4) },
      { name: "Tomatoes", category: "Produce", quantity: 4, unit: "ct", location: "Refrigerator", purchaseDate: addDays(now, -2), expirationDate: addDays(now, 5) },
      { name: "Avocados", category: "Produce", quantity: 3, unit: "ct", location: "Pantry", purchaseDate: addDays(now, -1), expirationDate: addDays(now, 4) },
      { name: "Bell Peppers", category: "Produce", quantity: 3, unit: "ct", location: "Refrigerator", purchaseDate: addDays(now, -2), expirationDate: addDays(now, 8) },
      { name: "Garlic", category: "Produce", quantity: 2, unit: "item", location: "Pantry", purchaseDate: addDays(now, -5), expirationDate: addDays(now, 25) },
      { name: "Yellow Onions", category: "Produce", quantity: 4, unit: "ct", location: "Pantry", purchaseDate: addDays(now, -3), expirationDate: addDays(now, 27) },
      { name: "Lemons", category: "Produce", quantity: 3, unit: "ct", location: "Refrigerator", purchaseDate: addDays(now, -1), expirationDate: addDays(now, 20) },
      { name: "Fresh Basil", category: "Produce", quantity: 1, unit: "item", location: "Refrigerator", purchaseDate: addDays(now, -2), expirationDate: addDays(now, 3), notes: "Keep stems in water" },
      { name: "Carrots", category: "Produce", quantity: 1, unit: "lb", location: "Refrigerator", purchaseDate: addDays(now, -4), expirationDate: addDays(now, 17) },
      { name: "Potatoes", category: "Produce", quantity: 5, unit: "lb", location: "Pantry", purchaseDate: addDays(now, -7), expirationDate: addDays(now, 21) },
      // Expired produce to make the dashboard interesting
      { name: "Spinach", category: "Produce", quantity: 1, unit: "bag", location: "Refrigerator", purchaseDate: addDays(now, -9), expirationDate: addDays(now, -2), opened: true, notes: "Getting wilty" },

      // Meat & Protein
      { name: "Chicken Breast", category: "Meat", quantity: 2, unit: "lb", location: "Refrigerator", purchaseDate: addDays(now, -1), expirationDate: addDays(now, 2) },
      { name: "Ground Beef (80/20)", category: "Meat", quantity: 1.5, unit: "lb", location: "Freezer", purchaseDate: addDays(now, -10), expirationDate: addDays(now, 80) },
      { name: "Salmon Fillets", category: "Meat", quantity: 1, unit: "lb", location: "Freezer", purchaseDate: addDays(now, -14), expirationDate: addDays(now, 76) },
      { name: "Bacon", category: "Meat", quantity: 1, unit: "lb", location: "Refrigerator", purchaseDate: addDays(now, -3), expirationDate: addDays(now, 4), opened: true },
      { name: "Italian Sausage", category: "Meat", quantity: 1, unit: "lb", location: "Refrigerator", purchaseDate: addDays(now, -1), expirationDate: addDays(now, 5) },

      // Grains & Pasta
      { name: "Spaghetti", category: "Grain", quantity: 2, unit: "box", location: "Pantry", purchaseDate: addDays(now, -30), expirationDate: addDays(now, 335) },
      { name: "Penne", category: "Grain", quantity: 1, unit: "box", location: "Pantry", purchaseDate: addDays(now, -20), expirationDate: addDays(now, 345) },
      { name: "Jasmine Rice", category: "Grain", quantity: 5, unit: "lb", location: "Pantry", purchaseDate: addDays(now, -15), expirationDate: addDays(now, 350) },
      { name: "Bread (Whole Wheat)", category: "Grain", quantity: 1, unit: "item", location: "Pantry", purchaseDate: addDays(now, -2), expirationDate: addDays(now, 4), opened: true },
      { name: "Flour (All Purpose)", category: "Grain", quantity: 5, unit: "lb", location: "Pantry", purchaseDate: addDays(now, -60), expirationDate: addDays(now, 120) },
      { name: "Tortillas (Flour)", category: "Grain", quantity: 10, unit: "ct", location: "Pantry", purchaseDate: addDays(now, -3), expirationDate: addDays(now, 11) },
      { name: "Panko Breadcrumbs", category: "Grain", quantity: 1, unit: "item", location: "Pantry", purchaseDate: addDays(now, -45), expirationDate: addDays(now, 135), opened: true },

      // Canned & Jarred
      { name: "Crushed Tomatoes", category: "Canned", quantity: 4, unit: "can", location: "Pantry", purchaseDate: addDays(now, -30), expirationDate: addDays(now, 700) },
      { name: "Black Beans", category: "Canned", quantity: 3, unit: "can", location: "Pantry", purchaseDate: addDays(now, -30), expirationDate: addDays(now, 700) },
      { name: "Chicken Broth", category: "Canned", quantity: 2, unit: "can", location: "Pantry", purchaseDate: addDays(now, -20), expirationDate: addDays(now, 345), needsRestock: false },
      { name: "Coconut Milk", category: "Canned", quantity: 2, unit: "can", location: "Pantry", purchaseDate: addDays(now, -15), expirationDate: addDays(now, 350) },
      { name: "Marinara Sauce", category: "Canned", quantity: 1, unit: "jar", location: "Pantry", purchaseDate: addDays(now, -5), expirationDate: addDays(now, 175) },
      { name: "Peanut Butter", category: "Canned", quantity: 1, unit: "jar", location: "Pantry", purchaseDate: addDays(now, -20), expirationDate: addDays(now, 70), opened: true },

      // Frozen
      { name: "Frozen Broccoli", category: "Frozen", quantity: 2, unit: "bag", location: "Freezer", purchaseDate: addDays(now, -14), expirationDate: addDays(now, 166) },
      { name: "Frozen Mixed Berries", category: "Frozen", quantity: 1, unit: "bag", location: "Freezer", purchaseDate: addDays(now, -7), expirationDate: addDays(now, 173) },
      { name: "Frozen Pizza", category: "Frozen", quantity: 2, unit: "item", location: "Freezer", purchaseDate: addDays(now, -10), expirationDate: addDays(now, 80) },
      { name: "Ice Cream (Vanilla)", category: "Frozen", quantity: 1, unit: "item", location: "Freezer", purchaseDate: addDays(now, -5), expirationDate: addDays(now, 55), opened: true },

      // Condiments & Sauces
      { name: "Olive Oil (Extra Virgin)", category: "Condiment", quantity: 1, unit: "bottle", location: "Pantry", purchaseDate: addDays(now, -30), expirationDate: addDays(now, 150) },
      { name: "Soy Sauce", category: "Condiment", quantity: 1, unit: "bottle", location: "Pantry", purchaseDate: addDays(now, -60), expirationDate: addDays(now, 300), opened: true },
      { name: "Hot Sauce", category: "Condiment", quantity: 1, unit: "bottle", location: "Refrigerator", purchaseDate: addDays(now, -90), expirationDate: addDays(now, 275) },
      { name: "Balsamic Vinegar", category: "Condiment", quantity: 1, unit: "bottle", location: "Pantry", purchaseDate: addDays(now, -45), expirationDate: addDays(now, 680) },
      { name: "Dijon Mustard", category: "Condiment", quantity: 1, unit: "jar", location: "Refrigerator", purchaseDate: addDays(now, -30), expirationDate: addDays(now, 150), opened: true },
      { name: "Honey", category: "Condiment", quantity: 1, unit: "bottle", location: "Pantry", purchaseDate: addDays(now, -60), expirationDate: addDays(now, 670) },

      // Spices
      { name: "Salt", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 1825) },
      { name: "Black Pepper", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 730) },
      { name: "Cumin", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 600) },
      { name: "Paprika", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 550) },
      { name: "Garlic Powder", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 500) },
      { name: "Italian Seasoning", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 450) },
      { name: "Chili Powder", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 500) },
      { name: "Cinnamon", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 600) },
      { name: "Red Pepper Flakes", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 400) },

      // Beverages
      { name: "Orange Juice", category: "Beverage", quantity: 1, unit: "item", location: "Refrigerator", purchaseDate: addDays(now, -3), expirationDate: addDays(now, 7), opened: true },
      { name: "Coffee (Ground)", category: "Beverage", quantity: 1, unit: "bag", location: "Pantry", purchaseDate: addDays(now, -10), expirationDate: addDays(now, 50), opened: true },
      { name: "Sparkling Water", category: "Beverage", quantity: 12, unit: "ct", location: "Pantry", purchaseDate: addDays(now, -5), expirationDate: addDays(now, 175) },

      // Snacks
      { name: "Tortilla Chips", category: "Snack", quantity: 1, unit: "bag", location: "Pantry", purchaseDate: addDays(now, -5), expirationDate: addDays(now, 40), opened: true },
      { name: "Mixed Nuts", category: "Snack", quantity: 1, unit: "item", location: "Pantry", purchaseDate: addDays(now, -10), expirationDate: addDays(now, 80) },
      { name: "Dark Chocolate", category: "Snack", quantity: 2, unit: "item", location: "Pantry", purchaseDate: addDays(now, -7), expirationDate: addDays(now, 173) },

      // Items that need restocking
      { name: "Sugar", category: "Other", quantity: 0.5, unit: "lb", location: "Pantry", purchaseDate: addDays(now, -90), expirationDate: addDays(now, 275), needsRestock: true, notes: "Running low" },
      { name: "Vegetable Oil", category: "Condiment", quantity: 0.25, unit: "bottle", location: "Pantry", purchaseDate: addDays(now, -60), expirationDate: addDays(now, 120), needsRestock: true },
    ],
  });
  console.log("Seeded 60 pantry items");

  // ──────────────────────────────────────────────
  // Recipes — a variety of real, cookable meals
  // ──────────────────────────────────────────────
  const chickenPasta = await prisma.recipe.create({
    data: {
      title: "Garlic Chicken Pasta",
      description: "Quick and easy chicken pasta with garlic and olive oil — a weeknight staple",
      servings: 4,
      prepTime: 10,
      cookTime: 20,
      instructions: JSON.stringify([
        "Cook spaghetti according to package directions, reserving 1 cup pasta water before draining",
        "Season chicken breast with salt, pepper, and garlic powder. Cut into bite-sized cubes",
        "Heat 2 tbsp olive oil in a large skillet over medium-high heat",
        "Cook chicken until golden brown on all sides, about 6-7 minutes. Remove and set aside",
        "In the same skillet, add remaining olive oil and sauté minced garlic for 30 seconds",
        "Add red pepper flakes, toss in drained pasta and chicken",
        "Add pasta water a splash at a time until the sauce coats the noodles",
        "Finish with fresh basil and serve immediately",
      ]),
      tags: "dinner,easy,protein,pasta,weeknight",
      ingredients: {
        create: [
          { name: "Spaghetti", quantity: 1, unit: "lb" },
          { name: "Chicken Breast", quantity: 1.5, unit: "lb" },
          { name: "Olive Oil", quantity: 3, unit: "tbsp" },
          { name: "Garlic", quantity: 4, unit: "cloves" },
          { name: "Red Pepper Flakes", quantity: 0.25, unit: "tsp" },
          { name: "Fresh Basil", quantity: 0.25, unit: "cup" },
          { name: "Salt", quantity: 1, unit: "tsp" },
          { name: "Black Pepper", quantity: 0.5, unit: "tsp" },
          { name: "Garlic Powder", quantity: 0.5, unit: "tsp" },
        ],
      },
    },
  });

  const beefTacos = await prisma.recipe.create({
    data: {
      title: "Beef Tacos",
      description: "Classic seasoned ground beef tacos with all the fixings",
      servings: 4,
      prepTime: 10,
      cookTime: 15,
      instructions: JSON.stringify([
        "Brown the ground beef in a large skillet over medium-high heat, breaking it up as it cooks",
        "Drain excess fat, then add cumin, chili powder, paprika, garlic powder, salt, and pepper",
        "Stir in 1/4 cup water and simmer for 5 minutes until thickened",
        "Warm tortillas in a dry skillet or microwave",
        "Dice tomatoes, shred lettuce, and slice avocados",
        "Assemble tacos: tortilla, beef, then toppings",
        "Top with shredded cheddar and hot sauce to taste",
      ]),
      tags: "dinner,easy,mexican,kids-favorite,weeknight",
      ingredients: {
        create: [
          { name: "Ground Beef", quantity: 1, unit: "lb" },
          { name: "Flour Tortillas", quantity: 8, unit: "ct" },
          { name: "Shredded Cheddar", quantity: 1, unit: "cup" },
          { name: "Tomatoes", quantity: 2, unit: "ct" },
          { name: "Romaine Lettuce", quantity: 0.5, unit: "item" },
          { name: "Avocado", quantity: 1, unit: "ct" },
          { name: "Cumin", quantity: 1, unit: "tsp" },
          { name: "Chili Powder", quantity: 1, unit: "tsp" },
          { name: "Paprika", quantity: 0.5, unit: "tsp" },
          { name: "Garlic Powder", quantity: 0.5, unit: "tsp" },
          { name: "Salt", quantity: 0.5, unit: "tsp" },
          { name: "Hot Sauce", quantity: 1, unit: "tbsp", optional: true },
        ],
      },
    },
  });

  const salmonRice = await prisma.recipe.create({
    data: {
      title: "Honey Soy Glazed Salmon",
      description: "Pan-seared salmon with a sweet and savory glaze, served over jasmine rice",
      servings: 2,
      prepTime: 10,
      cookTime: 15,
      instructions: JSON.stringify([
        "Cook jasmine rice according to package directions",
        "Mix soy sauce, honey, and a squeeze of lemon juice in a small bowl",
        "Pat salmon fillets dry and season with salt and pepper",
        "Heat olive oil in a skillet over medium-high heat",
        "Sear salmon skin-side up for 4 minutes, then flip",
        "Pour the honey-soy glaze over the salmon and cook 3-4 more minutes",
        "Serve salmon over rice, spooning pan sauce on top",
        "Garnish with a lemon wedge",
      ]),
      tags: "dinner,healthy,seafood,date-night,protein",
      ingredients: {
        create: [
          { name: "Salmon Fillets", quantity: 1, unit: "lb" },
          { name: "Jasmine Rice", quantity: 1.5, unit: "cup" },
          { name: "Soy Sauce", quantity: 3, unit: "tbsp" },
          { name: "Honey", quantity: 2, unit: "tbsp" },
          { name: "Lemon", quantity: 1, unit: "ct" },
          { name: "Olive Oil", quantity: 1, unit: "tbsp" },
          { name: "Salt", quantity: 0.5, unit: "tsp" },
          { name: "Black Pepper", quantity: 0.25, unit: "tsp" },
        ],
      },
    },
  });

  const scrambledEggs = await prisma.recipe.create({
    data: {
      title: "Fluffy Scrambled Eggs & Toast",
      description: "Perfect creamy scrambled eggs with buttered toast — the ultimate quick breakfast",
      servings: 2,
      prepTime: 3,
      cookTime: 5,
      instructions: JSON.stringify([
        "Crack eggs into a bowl, add a splash of milk, and whisk until smooth",
        "Melt butter in a non-stick skillet over medium-low heat",
        "Pour in eggs and let sit for 30 seconds",
        "Gently push eggs from the edges to the center with a spatula, forming soft curds",
        "Remove from heat while still slightly wet — they'll finish cooking off the heat",
        "Season with salt and pepper",
        "Toast bread and butter it",
        "Serve eggs alongside toast",
      ]),
      tags: "breakfast,easy,quick,kids-favorite",
      ingredients: {
        create: [
          { name: "Eggs", quantity: 4, unit: "ct" },
          { name: "Milk", quantity: 2, unit: "tbsp" },
          { name: "Butter", quantity: 1, unit: "tbsp" },
          { name: "Bread", quantity: 2, unit: "slices" },
          { name: "Salt", quantity: 0.25, unit: "tsp" },
          { name: "Black Pepper", quantity: 0.125, unit: "tsp" },
        ],
      },
    },
  });

  const chickenStirFry = await prisma.recipe.create({
    data: {
      title: "Chicken Stir-Fry with Vegetables",
      description: "Colorful stir-fry with chicken, bell peppers, and broccoli in a savory sauce",
      servings: 4,
      prepTime: 15,
      cookTime: 12,
      instructions: JSON.stringify([
        "Slice chicken breast into thin strips and season with salt and pepper",
        "Mix soy sauce, honey, and garlic powder in a small bowl for the sauce",
        "Heat olive oil in a wok or large skillet over high heat",
        "Stir-fry chicken strips for 4-5 minutes until cooked through, then remove",
        "Add bell peppers and broccoli to the wok, stir-fry 3-4 minutes until tender-crisp",
        "Add minced garlic and cook 30 seconds",
        "Return chicken to wok, pour sauce over everything",
        "Toss to coat and cook 1 more minute",
        "Serve over jasmine rice",
      ]),
      tags: "dinner,healthy,asian,protein,weeknight",
      ingredients: {
        create: [
          { name: "Chicken Breast", quantity: 1.5, unit: "lb" },
          { name: "Bell Peppers", quantity: 2, unit: "ct" },
          { name: "Frozen Broccoli", quantity: 2, unit: "cup" },
          { name: "Soy Sauce", quantity: 3, unit: "tbsp" },
          { name: "Honey", quantity: 1, unit: "tbsp" },
          { name: "Garlic", quantity: 3, unit: "cloves" },
          { name: "Garlic Powder", quantity: 0.5, unit: "tsp" },
          { name: "Olive Oil", quantity: 2, unit: "tbsp" },
          { name: "Jasmine Rice", quantity: 2, unit: "cup" },
          { name: "Salt", quantity: 0.5, unit: "tsp" },
          { name: "Black Pepper", quantity: 0.25, unit: "tsp" },
        ],
      },
    },
  });

  const blackBeanBowl = await prisma.recipe.create({
    data: {
      title: "Black Bean & Rice Bowl",
      description: "Hearty vegetarian bowl with seasoned black beans, rice, and fresh toppings",
      servings: 3,
      prepTime: 10,
      cookTime: 15,
      instructions: JSON.stringify([
        "Cook jasmine rice according to package directions",
        "Drain and rinse black beans",
        "Heat olive oil in a skillet, add diced onion and cook until softened (4 minutes)",
        "Add black beans, cumin, chili powder, and garlic powder. Cook 5 minutes",
        "Season with salt and a squeeze of lemon juice",
        "Build bowls: rice on the bottom, seasoned black beans on top",
        "Top with diced avocado, diced tomatoes, and shredded cheddar",
        "Add hot sauce if desired",
      ]),
      tags: "dinner,lunch,vegetarian,healthy,easy,meal-prep",
      ingredients: {
        create: [
          { name: "Black Beans", quantity: 2, unit: "can" },
          { name: "Jasmine Rice", quantity: 1.5, unit: "cup" },
          { name: "Yellow Onion", quantity: 1, unit: "ct" },
          { name: "Avocado", quantity: 1, unit: "ct" },
          { name: "Tomato", quantity: 1, unit: "ct" },
          { name: "Shredded Cheddar", quantity: 0.5, unit: "cup" },
          { name: "Olive Oil", quantity: 1, unit: "tbsp" },
          { name: "Cumin", quantity: 1, unit: "tsp" },
          { name: "Chili Powder", quantity: 0.5, unit: "tsp" },
          { name: "Garlic Powder", quantity: 0.5, unit: "tsp" },
          { name: "Lemon", quantity: 0.5, unit: "ct" },
          { name: "Salt", quantity: 0.5, unit: "tsp" },
          { name: "Hot Sauce", quantity: 1, unit: "tbsp", optional: true },
        ],
      },
    },
  });

  const bananaSmoothie = await prisma.recipe.create({
    data: {
      title: "Berry Banana Smoothie",
      description: "Thick and creamy smoothie with frozen berries, banana, and Greek yogurt",
      servings: 2,
      prepTime: 5,
      cookTime: 0,
      instructions: JSON.stringify([
        "Add frozen mixed berries and banana to a blender",
        "Add Greek yogurt and a splash of milk",
        "Add honey to taste",
        "Blend on high until smooth and creamy (about 60 seconds)",
        "Pour into glasses and serve immediately",
      ]),
      tags: "breakfast,snack,healthy,quick,kids-favorite",
      ingredients: {
        create: [
          { name: "Frozen Mixed Berries", quantity: 1, unit: "cup" },
          { name: "Banana", quantity: 1, unit: "ct" },
          { name: "Greek Yogurt", quantity: 0.5, unit: "cup" },
          { name: "Milk", quantity: 0.5, unit: "cup" },
          { name: "Honey", quantity: 1, unit: "tbsp", optional: true },
        ],
      },
    },
  });

  const sausagePasta = await prisma.recipe.create({
    data: {
      title: "Italian Sausage Penne",
      description: "Rustic penne with crumbled Italian sausage in a quick marinara",
      servings: 4,
      prepTime: 5,
      cookTime: 20,
      instructions: JSON.stringify([
        "Cook penne according to package directions, drain",
        "Remove sausage from casings and crumble into a hot skillet",
        "Brown sausage over medium-high heat, about 6 minutes",
        "Add diced onion and cook 3 minutes until softened",
        "Add minced garlic and Italian seasoning, cook 1 minute",
        "Pour in marinara sauce and simmer 5 minutes",
        "Toss in cooked penne and stir to coat",
        "Top with fresh basil if available",
      ]),
      tags: "dinner,easy,italian,pasta,weeknight",
      ingredients: {
        create: [
          { name: "Penne", quantity: 1, unit: "lb" },
          { name: "Italian Sausage", quantity: 1, unit: "lb" },
          { name: "Marinara Sauce", quantity: 1, unit: "jar" },
          { name: "Yellow Onion", quantity: 0.5, unit: "ct" },
          { name: "Garlic", quantity: 3, unit: "cloves" },
          { name: "Italian Seasoning", quantity: 1, unit: "tsp" },
          { name: "Olive Oil", quantity: 1, unit: "tbsp" },
          { name: "Fresh Basil", quantity: 1, unit: "tbsp", optional: true },
        ],
      },
    },
  });

  console.log("Seeded 8 recipes");

  // ──────────────────────────────────────────────
  // Meal plan entries — current week with realistic meals
  // ──────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

  const dayDate = (dayOffset: number) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + dayOffset);
    return d;
  };

  await prisma.mealPlanEntry.createMany({
    data: [
      // Sunday
      { date: dayDate(0), mealType: "Breakfast", recipeId: scrambledEggs.id, servings: 2 },
      { date: dayDate(0), mealType: "Lunch", customMeal: "Leftover pizza from freezer", servings: 1 },
      { date: dayDate(0), mealType: "Dinner", recipeId: chickenPasta.id, servings: 4, notes: "Meal prep extra for Monday lunch" },

      // Monday
      { date: dayDate(1), mealType: "Breakfast", recipeId: bananaSmoothie.id, servings: 1 },
      { date: dayDate(1), mealType: "Lunch", customMeal: "Leftover Garlic Chicken Pasta", servings: 1 },
      { date: dayDate(1), mealType: "Dinner", recipeId: chickenStirFry.id, servings: 2 },

      // Tuesday
      { date: dayDate(2), mealType: "Breakfast", recipeId: scrambledEggs.id, servings: 1 },
      { date: dayDate(2), mealType: "Lunch", recipeId: blackBeanBowl.id, servings: 1, notes: "Quick and healthy" },
      { date: dayDate(2), mealType: "Dinner", recipeId: beefTacos.id, servings: 4, notes: "Kids love these" },

      // Wednesday
      { date: dayDate(3), mealType: "Breakfast", customMeal: "Greek yogurt with honey and bananas", servings: 1 },
      { date: dayDate(3), mealType: "Lunch", customMeal: "Leftover beef tacos", servings: 1 },
      { date: dayDate(3), mealType: "Dinner", recipeId: sausagePasta.id, servings: 2 },

      // Thursday
      { date: dayDate(4), mealType: "Breakfast", recipeId: bananaSmoothie.id, servings: 2 },
      { date: dayDate(4), mealType: "Lunch", recipeId: blackBeanBowl.id, servings: 1 },
      { date: dayDate(4), mealType: "Dinner", recipeId: salmonRice.id, servings: 2, notes: "Date night in" },

      // Friday
      { date: dayDate(5), mealType: "Breakfast", customMeal: "Bagel with cream cheese", servings: 1 },
      { date: dayDate(5), mealType: "Lunch", customMeal: "Turkey sandwich from deli", servings: 1 },
      { date: dayDate(5), mealType: "Dinner", customMeal: "Order takeout", servings: 2, notes: "Treat yourself Friday" },

      // Saturday
      { date: dayDate(6), mealType: "Breakfast", recipeId: scrambledEggs.id, servings: 3, notes: "Big breakfast, kids are here" },
      { date: dayDate(6), mealType: "Lunch", customMeal: "PB&J sandwiches and fruit", servings: 3 },
      { date: dayDate(6), mealType: "Dinner", recipeId: beefTacos.id, servings: 4, notes: "Taco Saturday!" },
      { date: dayDate(6), mealType: "Snack", customMeal: "Popcorn and movie night", servings: 3 },
    ],
  });
  console.log("Seeded 22 meal plan entries for the week");

  // ──────────────────────────────────────────────
  // Shopping list — items needed for the week
  // ──────────────────────────────────────────────
  await prisma.shoppingListItem.createMany({
    data: [
      { name: "Chicken Breast", quantity: 3, unit: "lb", category: "Meat", notes: "For stir-fry + pasta" },
      { name: "Ground Beef", quantity: 2, unit: "lb", category: "Meat", notes: "For tacos x2" },
      { name: "Whole Milk", quantity: 1, unit: "gal", category: "Dairy", checked: true, notes: "Grabbed yesterday" },
      { name: "Greek Yogurt", quantity: 6, unit: "ct", category: "Dairy" },
      { name: "Bananas", quantity: 6, unit: "ct", category: "Produce" },
      { name: "Romaine Lettuce", quantity: 1, unit: "item", category: "Produce" },
      { name: "Avocados", quantity: 4, unit: "ct", category: "Produce" },
      { name: "Tomatoes", quantity: 4, unit: "ct", category: "Produce" },
      { name: "Fresh Basil", quantity: 1, unit: "item", category: "Produce" },
      { name: "Lemons", quantity: 2, unit: "ct", category: "Produce", checked: true },
      { name: "Flour Tortillas", quantity: 2, unit: "pack", category: "Grain" },
      { name: "Bread (Whole Wheat)", quantity: 1, unit: "item", category: "Grain" },
      { name: "Marinara Sauce", quantity: 1, unit: "jar", category: "Canned" },
      { name: "Black Beans", quantity: 2, unit: "can", category: "Canned", checked: true },
      { name: "Sugar", quantity: 5, unit: "lb", category: "Other", notes: "Running low at home" },
      { name: "Vegetable Oil", quantity: 1, unit: "bottle", category: "Condiment" },
    ],
  });
  console.log("Seeded 16 shopping list items (3 already checked off)");

  // ──────────────────────────────────────────────
  // Audit logs — recent inventory checks
  // ──────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        type: "full_audit",
        summary: "Weekly pantry audit — 58 items in stock, 1 expired, 2 need restocking",
        details: JSON.stringify({
          totalItems: 58,
          expired: ["Spinach (expired 2 days ago)"],
          expiringIn3Days: ["Chicken Breast", "Bananas", "Fresh Basil"],
          needsRestock: ["Sugar", "Vegetable Oil"],
          newSinceLastAudit: 5,
        }),
        createdAt: addDays(now, -1),
      },
      {
        type: "expiration_check",
        summary: "Expiration check — 4 items expiring within 5 days",
        details: JSON.stringify({
          expiringSoon: [
            { name: "Chicken Breast", daysLeft: 2, location: "Refrigerator" },
            { name: "Bananas", daysLeft: 3, location: "Pantry" },
            { name: "Fresh Basil", daysLeft: 3, location: "Refrigerator" },
            { name: "Cream Cheese", daysLeft: 4, location: "Refrigerator" },
          ],
          recommendation: "Use chicken breast and basil tonight — try the Garlic Chicken Pasta recipe",
        }),
        createdAt: addDays(now, 0),
      },
      {
        type: "restock_check",
        summary: "Restock check — 2 items flagged for restocking",
        details: JSON.stringify({
          lowStock: [
            { name: "Sugar", currentQuantity: "0.5 lb", typicalUsage: "5 lb bag lasts ~2 months" },
            { name: "Vegetable Oil", currentQuantity: "1/4 bottle", typicalUsage: "Used for frying 2-3x per week" },
          ],
          addedToShoppingList: true,
        }),
        createdAt: addDays(now, -3),
      },
    ],
  });
  console.log("Seeded 3 audit log entries");

  console.log("\nDone! Database seeded with rich mock data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
