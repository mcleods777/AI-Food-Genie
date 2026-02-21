import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed household configurations
  await prisma.householdConfig.createMany({
    data: [
      { name: "Solo", scenario: "solo", headcount: 1, isDefault: true, notes: "Just me" },
      { name: "Kids Week", scenario: "with_kids", headcount: 3, isDefault: false, notes: "50% custody - kids are here" },
      { name: "Date Night", scenario: "with_partner", headcount: 2, isDefault: false, notes: "Partner visits" },
      { name: "Full House", scenario: "with_partner_and_kids", headcount: 4, isDefault: false, notes: "Everyone together" },
      { name: "Holiday/Party", scenario: "special_occasion", headcount: 8, isDefault: false, notes: "Special occasions and gatherings" },
    ],
  });

  // Seed some sample pantry items
  const now = new Date();
  await prisma.pantryItem.createMany({
    data: [
      { name: "Milk", category: "Dairy", quantity: 1, unit: "gal", location: "Refrigerator", purchaseDate: now, expirationDate: addDays(now, 7) },
      { name: "Eggs", category: "Dairy", quantity: 12, unit: "ct", location: "Refrigerator", purchaseDate: now, expirationDate: addDays(now, 21) },
      { name: "Chicken Breast", category: "Meat", quantity: 2, unit: "lb", location: "Refrigerator", purchaseDate: now, expirationDate: addDays(now, 3) },
      { name: "Pasta", category: "Grain", quantity: 2, unit: "box", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 365) },
      { name: "Rice", category: "Grain", quantity: 5, unit: "lb", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 365) },
      { name: "Canned Tomatoes", category: "Canned", quantity: 4, unit: "can", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 730) },
      { name: "Olive Oil", category: "Condiment", quantity: 1, unit: "bottle", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 180) },
      { name: "Lettuce", category: "Produce", quantity: 1, unit: "item", location: "Refrigerator", purchaseDate: now, expirationDate: addDays(now, 5) },
      { name: "Frozen Pizza", category: "Frozen", quantity: 2, unit: "item", location: "Freezer", purchaseDate: now, expirationDate: addDays(now, 90) },
      { name: "Frozen Vegetables", category: "Frozen", quantity: 3, unit: "bag", location: "Freezer", purchaseDate: now, expirationDate: addDays(now, 180) },
      { name: "Bread", category: "Grain", quantity: 1, unit: "item", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 5) },
      { name: "Butter", category: "Dairy", quantity: 1, unit: "item", location: "Refrigerator", purchaseDate: now, expirationDate: addDays(now, 30) },
      { name: "Garlic", category: "Produce", quantity: 1, unit: "item", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 14) },
      { name: "Onions", category: "Produce", quantity: 3, unit: "item", location: "Pantry", purchaseDate: now, expirationDate: addDays(now, 30) },
      { name: "Salt", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 1825) },
      { name: "Black Pepper", category: "Spice", quantity: 1, unit: "item", location: "Cabinet", expirationDate: addDays(now, 730) },
    ],
  });

  // Seed a sample recipe
  const recipe = await prisma.recipe.create({
    data: {
      title: "Simple Chicken Pasta",
      description: "Quick and easy chicken pasta with garlic and olive oil",
      servings: 4,
      prepTime: 10,
      cookTime: 20,
      instructions: JSON.stringify([
        "Cook pasta according to package directions",
        "Season chicken with salt and pepper, cut into cubes",
        "Heat olive oil in a large skillet over medium-high heat",
        "Cook chicken until golden, about 6 minutes",
        "Add minced garlic, cook 1 minute",
        "Toss with drained pasta and serve",
      ]),
      tags: "dinner,easy,protein,pasta",
      ingredients: {
        create: [
          { name: "Pasta", quantity: 1, unit: "lb" },
          { name: "Chicken Breast", quantity: 1.5, unit: "lb" },
          { name: "Olive Oil", quantity: 3, unit: "tbsp" },
          { name: "Garlic", quantity: 4, unit: "cloves" },
          { name: "Salt", quantity: 1, unit: "tsp" },
          { name: "Black Pepper", quantity: 0.5, unit: "tsp" },
        ],
      },
    },
  });

  console.log("Seeded database with sample data");
  console.log(`Created recipe: ${recipe.title}`);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
