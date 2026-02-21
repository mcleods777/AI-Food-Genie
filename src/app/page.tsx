import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [pantryCount, expiringCount, recipeCount, shoppingCount, upcomingMeals] =
    await Promise.all([
      prisma.pantryItem.count(),
      prisma.pantryItem.count({
        where: {
          expirationDate: {
            lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
            gte: new Date(),
          },
        },
      }),
      prisma.recipe.count(),
      prisma.shoppingListItem.count({ where: { checked: false } }),
      prisma.mealPlanEntry.findMany({
        where: { date: { gte: new Date() } },
        include: { recipe: true },
        orderBy: { date: "asc" },
        take: 5,
      }),
    ]);

  const needsRestock = await prisma.pantryItem.count({
    where: { needsRestock: true },
  });

  const stats = [
    { label: "Pantry Items", value: pantryCount, href: "/pantry", color: "bg-emerald-500" },
    { label: "Expiring Soon", value: expiringCount, href: "/audit", color: "bg-amber-500" },
    { label: "Recipes", value: recipeCount, href: "/recipes", color: "bg-blue-500" },
    { label: "Shopping Items", value: shoppingCount, href: "/shopping-list", color: "bg-purple-500" },
    { label: "Needs Restock", value: needsRestock, href: "/audit", color: "bg-red-500" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your kitchen at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white text-lg font-bold mb-3`}>
              {stat.value}
            </div>
            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pantry?action=scan"
              className="bg-emerald-50 text-emerald-700 rounded-lg p-4 text-center hover:bg-emerald-100 transition-colors"
            >
              <div className="text-2xl mb-1">📸</div>
              <p className="text-sm font-medium">Scan Pantry</p>
            </Link>
            <Link
              href="/groceries?action=add"
              className="bg-blue-50 text-blue-700 rounded-lg p-4 text-center hover:bg-blue-100 transition-colors"
            >
              <div className="text-2xl mb-1">🛒</div>
              <p className="text-sm font-medium">Log Groceries</p>
            </Link>
            <Link
              href="/recipes?action=import"
              className="bg-purple-50 text-purple-700 rounded-lg p-4 text-center hover:bg-purple-100 transition-colors"
            >
              <div className="text-2xl mb-1">🔗</div>
              <p className="text-sm font-medium">Import Recipe</p>
            </Link>
            <Link
              href="/audit?action=run"
              className="bg-amber-50 text-amber-700 rounded-lg p-4 text-center hover:bg-amber-100 transition-colors"
            >
              <div className="text-2xl mb-1">🔍</div>
              <p className="text-sm font-medium">Run Audit</p>
            </Link>
          </div>
        </div>

        {/* Upcoming Meals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Upcoming Meals</h2>
          {upcomingMeals.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm">No meals planned yet</p>
              <Link
                href="/meal-planner"
                className="text-emerald-600 text-sm hover:underline mt-2 inline-block"
              >
                Plan your week
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingMeals.map((meal) => (
                <li
                  key={meal.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {meal.recipe?.title || meal.customMeal}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(meal.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      &middot; {meal.mealType}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {meal.servings} servings
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
