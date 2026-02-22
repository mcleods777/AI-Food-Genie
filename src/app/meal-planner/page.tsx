"use client";

import { useState, useEffect } from "react";

interface Recipe {
  id: string;
  title: string;
  servings: number;
}

interface MealPlanEntry {
  id: string;
  date: string;
  mealType: string;
  recipeId: string | null;
  customMeal: string | null;
  servings: number;
  notes: string | null;
  recipe: Recipe | null;
}

interface HouseholdConfig {
  id: string;
  name: string;
  scenario: string;
  headcount: number;
  notes: string | null;
  isDefault: boolean;
}

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

const SCENARIOS = [
  { value: "solo", label: "Just me", headcount: 1 },
  { value: "with_kids", label: "With kids (50% custody)", headcount: 3 },
  { value: "with_partner", label: "With partner", headcount: 2 },
  { value: "with_partner_and_kids", label: "Partner + Kids", headcount: 4 },
  { value: "special_occasion", label: "Special occasion", headcount: 6 },
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export default function MealPlannerPage() {
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [households, setHouseholds] = useState<HouseholdConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestingMeals, setSuggestingMeals] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState("solo");
  const [addingMeal, setAddingMeal] = useState<{ date: string; mealType: string } | null>(null);
  const [mealForm, setMealForm] = useState({ recipeId: "", customMeal: "", servings: 2, notes: "" });
  const [showHouseholdForm, setShowHouseholdForm] = useState(false);
  const [newHousehold, setNewHousehold] = useState({ name: "", scenario: "solo", headcount: 1, notes: "" });

  const weekDays = getWeekDays(weekStart);

  useEffect(() => {
    fetchData();
  }, [weekStart]);

  async function fetchData() {
    const [entriesRes, recipesRes, householdRes] = await Promise.all([
      fetch(`/api/meal-plans?weekStart=${weekStart.toISOString()}`),
      fetch("/api/recipes"),
      fetch("/api/meal-plans/household"),
    ]);
    setEntries(await entriesRes.json());
    setRecipes(await recipesRes.json());
    setHouseholds(await householdRes.json());
    setLoading(false);
  }

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!addingMeal) return;

    await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: addingMeal.date,
        mealType: addingMeal.mealType,
        recipeId: mealForm.recipeId || null,
        customMeal: mealForm.customMeal || null,
        servings: mealForm.servings,
        notes: mealForm.notes,
      }),
    });

    setAddingMeal(null);
    setMealForm({ recipeId: "", customMeal: "", servings: 2, notes: "" });
    fetchData();
  }

  async function handleDeleteEntry(id: string) {
    await fetch(`/api/meal-plans?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  async function handleGetSuggestions() {
    setSuggestingMeals(true);
    const scenario = SCENARIOS.find((s) => s.value === selectedScenario);
    const res = await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "suggest",
        scenario: selectedScenario,
        headcount: scenario?.headcount || 1,
      }),
    });
    const data = await res.json();
    setSuggestions(data.suggestions || []);
    setSuggestingMeals(false);
  }

  async function handleAddHousehold(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/meal-plans/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newHousehold),
    });
    setNewHousehold({ name: "", scenario: "solo", headcount: 1, notes: "" });
    setShowHouseholdForm(false);
    fetchData();
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function getEntriesForDay(date: Date, mealType: string): MealPlanEntry[] {
    const dateStr = date.toISOString().split("T")[0];
    return entries.filter((e) => {
      const entryDate = new Date(e.date).toISOString().split("T")[0];
      return entryDate === dateStr && e.mealType === mealType;
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Meal Planner</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Plan weekly meals based on household size and schedule
          </p>
        </div>
        <button
          onClick={() => setShowHouseholdForm(!showHouseholdForm)}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm"
        >
          Household Profiles
        </button>
      </div>

      {/* Household Config */}
      {showHouseholdForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Household Profiles</h2>
          {households.length > 0 && (
            <div className="mb-4 space-y-2">
              {households.map((h) => (
                <div key={h.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 text-sm">
                  <span className="font-medium">{h.name}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{SCENARIOS.find((s) => s.value === h.scenario)?.label}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{h.headcount} people</span>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddHousehold} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              required
              placeholder="Profile name"
              value={newHousehold.name}
              onChange={(e) => setNewHousehold({ ...newHousehold, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newHousehold.scenario}
              onChange={(e) => {
                const sc = SCENARIOS.find((s) => s.value === e.target.value);
                setNewHousehold({ ...newHousehold, scenario: e.target.value, headcount: sc?.headcount || 1 });
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {SCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={newHousehold.headcount}
              onChange={(e) => setNewHousehold({ ...newHousehold, headcount: parseInt(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Headcount"
            />
            <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
              Add Profile
            </button>
          </form>
        </div>
      )}

      {/* AI Suggestions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">AI Meal Suggestions</h2>
        <p className="text-sm text-gray-500 mb-4">
          Get meal ideas based on your pantry items and household scenario.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>{s.label} ({s.headcount})</option>
            ))}
          </select>
          <button
            onClick={handleGetSuggestions}
            disabled={suggestingMeals}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
          >
            {suggestingMeals ? "Thinking..." : "Get Suggestions"}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((meal, i) => (
              <span key={i} className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-sm">
                {meal}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevWeek} className="text-gray-500 hover:text-gray-700 text-sm">&larr; Previous Week</button>
        <h3 className="font-semibold text-gray-700">
          {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} &ndash;{" "}
          {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </h3>
        <button onClick={nextWeek} className="text-gray-500 hover:text-gray-700 text-sm">Next Week &rarr;</button>
      </div>

      {/* Weekly Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium text-gray-600 w-20">Meal</th>
                    {weekDays.map((day) => (
                      <th key={day.toISOString()} className="text-center px-2 py-3 font-medium text-gray-600 min-w-[120px]">
                        <div>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                        <div className="text-xs text-gray-400">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map((mealType) => (
                    <tr key={mealType} className="border-b border-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">
                        {mealType}
                      </td>
                      {weekDays.map((day) => {
                        const dayEntries = getEntriesForDay(day, mealType);
                        const dateStr = day.toISOString().split("T")[0];
                        return (
                          <td key={day.toISOString()} className="px-2 py-2 align-top">
                            {dayEntries.map((entry) => (
                              <div key={entry.id} className="bg-emerald-50 rounded-lg p-2 mb-1 group relative">
                                <p className="text-xs font-medium text-emerald-800">
                                  {entry.recipe?.title || entry.customMeal}
                                </p>
                                <p className="text-xs text-emerald-600">{entry.servings}sv</p>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="absolute top-1 right-1 text-emerald-400 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                setAddingMeal({ date: dateStr, mealType });
                                setMealForm({ recipeId: "", customMeal: "", servings: 2, notes: "" });
                              }}
                              className="text-xs text-gray-300 hover:text-emerald-500 w-full text-center py-1"
                            >
                              +
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile day-by-day view — hidden on desktop */}
          <div className="md:hidden space-y-3">
            {weekDays.map((day) => {
              const dateStr = day.toISOString().split("T")[0];
              const isToday = new Date().toISOString().split("T")[0] === dateStr;
              return (
                <div
                  key={day.toISOString()}
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                    isToday ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-100"
                  }`}
                >
                  <div className={`px-4 py-2.5 border-b ${isToday ? "bg-emerald-50" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {day.toLocaleDateString("en-US", { weekday: "long" })}
                      </span>
                      <span className={`text-xs ${isToday ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                        {isToday ? "Today" : day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {MEAL_TYPES.map((mealType) => {
                      const dayEntries = getEntriesForDay(day, mealType);
                      return (
                        <div key={mealType}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{mealType}</span>
                            <button
                              onClick={() => {
                                setAddingMeal({ date: dateStr, mealType });
                                setMealForm({ recipeId: "", customMeal: "", servings: 2, notes: "" });
                              }}
                              className="text-emerald-500 text-xs px-2 py-1"
                            >
                              + Add
                            </button>
                          </div>
                          {dayEntries.length > 0 ? (
                            dayEntries.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2 mt-1">
                                <div>
                                  <p className="text-sm font-medium text-emerald-800">
                                    {entry.recipe?.title || entry.customMeal}
                                  </p>
                                  <p className="text-xs text-emerald-600">{entry.servings} servings{entry.notes ? ` — ${entry.notes}` : ""}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="text-emerald-400 hover:text-red-500 text-lg px-2"
                                >
                                  &times;
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-300 mt-1 ml-1">No meal planned</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Meal Modal */}
      {addingMeal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-2">
              Add {addingMeal.mealType}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {new Date(addingMeal.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <form onSubmit={handleAddMeal} className="space-y-3">
              <select
                value={mealForm.recipeId}
                onChange={(e) => setMealForm({ ...mealForm, recipeId: e.target.value, customMeal: "" })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
              >
                <option value="">Select a recipe...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
              <div className="text-center text-xs text-gray-400">or</div>
              <input
                placeholder="Custom meal name"
                value={mealForm.customMeal}
                onChange={(e) => setMealForm({ ...mealForm, customMeal: e.target.value, recipeId: "" })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
              />
              <input
                type="number"
                min="1"
                value={mealForm.servings}
                onChange={(e) => setMealForm({ ...mealForm, servings: parseInt(e.target.value) })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
                placeholder="Servings"
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
                  Add to Plan
                </button>
                <button type="button" onClick={() => setAddingMeal(null)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
