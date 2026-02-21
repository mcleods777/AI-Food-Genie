"use client";

import { useState, useEffect, useRef } from "react";

interface PantryItem {
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
  needsRestock: boolean;
}

const LOCATIONS = ["Pantry", "Refrigerator", "Freezer", "Cabinet"];
const CATEGORIES = ["Produce", "Dairy", "Meat", "Grain", "Spice", "Canned", "Frozen", "Beverage", "Snack", "Condiment", "Other"];
const UNITS = ["item", "lb", "oz", "gal", "ct", "bag", "box", "can", "bottle"];

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanLocation, setScanLocation] = useState("Pantry");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "Other",
    quantity: 1,
    unit: "item",
    location: "Pantry",
    expirationDate: "",
    notes: "",
  });

  useEffect(() => {
    fetchItems();
  }, [filterLocation, filterCategory]);

  async function fetchItems() {
    const params = new URLSearchParams();
    if (filterLocation) params.set("location", filterLocation);
    if (filterCategory) params.set("category", filterCategory);
    const res = await fetch(`/api/pantry?${params}`);
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
    formData.append("location", scanLocation);

    const res = await fetch("/api/pantry", { method: "POST", body: formData });
    const data = await res.json();
    setScanning(false);
    setScanResult(data.message);
    fetchItems();
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    setNewItem({ name: "", category: "Other", quantity: 1, unit: "item", location: "Pantry", expirationDate: "", notes: "" });
    setShowAddForm(false);
    fetchItems();
  }

  async function handleUpdateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    await fetch("/api/pantry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingItem),
    });
    setEditingItem(null);
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this item?")) return;
    await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    fetchItems();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  }

  function getExpiryClass(dateStr: string | null) {
    if (!dateStr) return "";
    const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return "text-red-600 font-semibold";
    if (days <= 3) return "text-orange-500 font-semibold";
    if (days <= 7) return "text-amber-500";
    return "text-gray-500";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pantry & Inventory</h1>
          <p className="text-gray-500 mt-1">
            Scan your pantry, fridge, and cabinets or add items manually
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* AI Photo Scanner */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">AI Photo Scanner</h2>
        <p className="text-sm text-gray-500 mb-4">
          Take a photo of your pantry, refrigerator, freezer, or cabinets. AI will identify and catalog all visible items.
        </p>
        <div className="flex items-center gap-4">
          <select
            value={scanLocation}
            onChange={(e) => setScanLocation(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
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
            <span className="text-sm">AI is analyzing your photo...</span>
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
          <h2 className="text-lg font-semibold mb-4">Add Item Manually</h2>
          <form onSubmit={handleAddItem} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input
              required
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm col-span-2"
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={newItem.location}
              onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input
              type="number"
              min="0"
              step="0.1"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Qty"
            />
            <select
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
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
            <div className="col-span-2 md:col-span-4 flex gap-2">
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

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Locations</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Edit Item</h3>
            <form onSubmit={handleUpdateItem} className="space-y-3">
              <input
                required
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={editingItem.location}
                  onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingItem.quantity}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={editingItem.unit}
                  onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <input
                type="date"
                value={editingItem.expirationDate?.split("T")[0] || ""}
                onChange={(e) => setEditingItem({ ...editingItem, expirationDate: e.target.value || null })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
                placeholder="Expiration date"
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingItem(null)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🗄️</p>
            <p>No items found. Scan your pantry or add items manually.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">
                    {item.name}
                    {item.needsRestock && (
                      <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        restock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-gray-500">{item.location}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.quantity} {item.unit}
                  </td>
                  <td className={`px-4 py-3 ${getExpiryClass(item.expirationDate)}`}>
                    {formatDate(item.expirationDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    </div>
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
