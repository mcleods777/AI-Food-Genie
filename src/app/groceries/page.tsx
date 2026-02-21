"use client";

import { useState, useEffect, useRef } from "react";

interface GroceryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  expirationDate: string | null;
  purchaseDate: string | null;
  imageUrl: string | null;
  notes: string | null;
}

const CATEGORIES = ["Produce", "Dairy", "Meat", "Grain", "Spice", "Canned", "Frozen", "Beverage", "Snack", "Condiment", "Other"];
const UNITS = ["item", "lb", "oz", "gal", "ct", "bag", "box", "can", "bottle"];

export default function GroceriesPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpiry, setEditingExpiry] = useState<{ id: string; date: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "Other",
    quantity: 1,
    unit: "item",
    expirationDate: "",
    notes: "",
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const res = await fetch("/api/groceries");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanResult(null);
    const formData = new FormData();
    formData.append("photo", file);

    const res = await fetch("/api/groceries", { method: "POST", body: formData });
    const data = await res.json();
    setScanning(false);
    setScanResult(data.message);
    fetchItems();
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/groceries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    setNewItem({ name: "", category: "Other", quantity: 1, unit: "item", expirationDate: "", notes: "" });
    setShowAddForm(false);
    fetchItems();
  }

  async function handleUpdateExpiry(id: string, date: string) {
    await fetch("/api/pantry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, expirationDate: date || null }),
    });
    setEditingExpiry(null);
    fetchItems();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Grocery Tracker</h1>
          <p className="text-gray-500 mt-1">
            Photograph grocery purchases to catalog them with expiration dates
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
        >
          + Add Purchase
        </button>
      </div>

      {/* Photo Scanner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Scan Grocery Receipt / Items</h2>
        <p className="text-sm text-gray-500 mb-4">
          Take a photo of your grocery items or receipt. AI will catalog everything with estimated expiration dates.
          You can retroactively adjust expiration dates after scanning.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
          >
            {scanning ? "Analyzing..." : "Upload Photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
        {scanning && (
          <div className="mt-4 flex items-center gap-2 text-blue-600">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-sm">AI is analyzing your grocery items...</span>
          </div>
        )}
        {scanResult && (
          <div className="mt-4 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">
            {scanResult}
          </div>
        )}
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Log Purchase Manually</h2>
          <form onSubmit={handleAddItem} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <input
              required
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-1"
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
                className="border rounded-lg px-3 py-2 text-sm w-20"
              />
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm flex-1"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <input
              type="date"
              value={newItem.expirationDate}
              onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Expiration date"
            />
            <input
              placeholder="Notes"
              value={newItem.notes}
              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <div className="col-span-2 md:col-span-3 flex gap-2">
              <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
                Save
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🛒</p>
            <p>No grocery purchases logged yet. Snap a photo or add items manually.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Purchased</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-gray-500">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(item.purchaseDate)}</td>
                  <td className="px-4 py-3">
                    {editingExpiry?.id === item.id ? (
                      <div className="flex gap-1">
                        <input
                          type="date"
                          value={editingExpiry.date}
                          onChange={(e) => setEditingExpiry({ ...editingExpiry, date: e.target.value })}
                          className="border rounded px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => handleUpdateExpiry(item.id, editingExpiry.date)}
                          className="text-emerald-600 hover:text-emerald-800 text-xs"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => setEditingExpiry({ id: item.id, date: item.expirationDate?.split("T")[0] || "" })}
                        className="cursor-pointer hover:text-blue-600 underline-offset-2 hover:underline"
                        title="Click to edit expiration date"
                      >
                        {formatDate(item.expirationDate)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingExpiry({ id: item.id, date: item.expirationDate?.split("T")[0] || "" })}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Set Expiry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
