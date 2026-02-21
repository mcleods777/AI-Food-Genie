"use client";

import { useState, useEffect } from "react";

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  notes: string | null;
}

const CATEGORIES = ["Produce", "Dairy", "Meat", "Grain", "Spice", "Canned", "Frozen", "Beverage", "Snack", "Condiment", "Other"];

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, unit: "item", category: "Other", notes: "" });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const res = await fetch("/api/shopping-list");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    setNewItem({ name: "", quantity: 1, unit: "item", category: "Other", notes: "" });
    setShowAddForm(false);
    fetchItems();
  }

  async function handleToggleItem(id: string, checked: boolean) {
    await fetch("/api/shopping-list", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checked: !checked }),
    });
    fetchItems();
  }

  async function handleDeleteItem(id: string) {
    await fetch(`/api/shopping-list?id=${id}`, { method: "DELETE" });
    fetchItems();
  }

  async function handleClearChecked() {
    await fetch("/api/shopping-list?clearChecked=true", { method: "DELETE" });
    fetchItems();
  }

  async function handleGenerateFromMealPlan() {
    setGenerating(true);
    setGenerateResult(null);

    const now = new Date();
    const day = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);

    const res = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_from_meal_plan",
        weekStart: weekStart.toISOString(),
      }),
    });

    const data = await res.json();
    setGenerating(false);
    setGenerateResult(data.message);
    fetchItems();
  }

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);

  // Group unchecked by category
  const grouped = uncheckedItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shopping List</h1>
          <p className="text-gray-500 mt-1">
            Track what you need to buy. Auto-generate from your meal plan.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
          >
            + Add Item
          </button>
          <button
            onClick={handleGenerateFromMealPlan}
            disabled={generating}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate from Meal Plan"}
          </button>
        </div>
      </div>

      {generateResult && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm mb-6">
          {generateResult}
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <form onSubmit={handleAddItem} className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input
              required
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-1"
            />
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                className="border rounded-lg px-3 py-2 text-sm w-20"
              />
              <input
                placeholder="unit"
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm flex-1"
              />
            </div>
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Notes"
              value={newItem.notes}
              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
                Add
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📝</p>
          <p>Shopping list is empty. Add items or generate from your meal plan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unchecked items grouped by category */}
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h3 className="text-sm font-semibold text-gray-600">{category}</h3>
              </div>
              <ul>
                {categoryItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleItem(item.id, item.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="flex-1 text-sm">{item.name}</span>
                    <span className="text-xs text-gray-400">
                      {item.quantity} {item.unit}
                    </span>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-gray-300 hover:text-red-500 text-sm"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Checked items */}
          {checkedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400">Purchased ({checkedItems.length})</h3>
                <button
                  onClick={handleClearChecked}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Clear all
                </button>
              </div>
              <ul>
                {checkedItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleItem(item.id, item.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="flex-1 text-sm text-gray-400 line-through">{item.name}</span>
                    <span className="text-xs text-gray-300">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
