import { prisma } from "@/lib/db";
import { getProviderStatus, getProviderForTask } from "@/lib/providers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const providers = getProviderStatus();
  const scanProvider = getProviderForTask("scan");
  const ocrProvider = getProviderForTask("ocr");
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

      {/* AI Provider Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-3">AI Provider Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className={`rounded-lg p-3 ${providers.gemini ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${providers.gemini ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-sm font-medium">Gemini Flash</span>
            </div>
            <p className="text-xs text-gray-500">Primary scanner &middot; $0.0003/scan</p>
          </div>
          <div className={`rounded-lg p-3 ${providers.claude ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${providers.claude ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-sm font-medium">Claude</span>
            </div>
            <p className="text-xs text-gray-500">Date OCR &middot; 0.09% hallucination</p>
          </div>
          <div className={`rounded-lg p-3 ${providers.openai ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${providers.openai ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-sm font-medium">GPT-4o</span>
            </div>
            <p className="text-xs text-gray-500">Fallback &middot; fine-tuning option</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Scanning: <span className="font-medium text-gray-600">{scanProvider.available ? `${scanProvider.provider === "gemini" ? "Gemini Flash" : scanProvider.provider === "claude" ? "Claude" : "GPT-4o"}` : "Mock data (no provider configured)"}</span></p>
          <p>Date OCR: <span className="font-medium text-gray-600">{ocrProvider.available ? `${ocrProvider.provider === "claude" ? "Claude" : ocrProvider.provider === "gemini" ? "Gemini Flash" : "GPT-4o"}` : "Not available"}</span></p>
          <p>Barcode: <span className="font-medium text-gray-600">Open Food Facts (always available)</span></p>
        </div>
        {!providers.gemini && !providers.claude && !providers.openai && (
          <p className="text-xs text-amber-600 mt-3 bg-amber-50 px-3 py-2 rounded-lg">
            No AI providers configured. Add API keys to .env for live scanning. The app works with mock data for development.
          </p>
        )}
      </div>
    </div>
  );
}
