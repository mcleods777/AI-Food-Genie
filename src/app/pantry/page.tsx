"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  expirationDate: string | null;
  expiryEstimateReason: string | null;
  opened: boolean;
  purchaseDate: string | null;
  imageUrl: string | null;
  notes: string | null;
  needsRestock: boolean;
  barcode: string | null;
  brand: string | null;
  ingredients: string | null;
  nutriScore: string | null;
  novaGroup: number | null;
}

interface ProductDetails {
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  nutriScore: string | null;
  novaGroup: number | null;
  quantity: string | null;
  allergens: string[];
  nutriments: {
    energy_kcal: number | null;
    fat: number | null;
    saturatedFat: number | null;
    carbs: number | null;
    sugars: number | null;
    fiber: number | null;
    protein: number | null;
    salt: number | null;
    sodium: number | null;
  } | null;
  labels: string | null;
  origins: string | null;
  stores: string | null;
  url: string;
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
  const [tooltipItem, setTooltipItem] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<string | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [detailItem, setDetailItem] = useState<PantryItem | null>(null);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Expiration date popup state (shown after successful barcode scan)
  const [expiryPopup, setExpiryPopup] = useState<{ itemId: string; itemName: string } | null>(null);
  const [expiryManualDate, setExpiryManualDate] = useState("");
  const [expiryPhotoLoading, setExpiryPhotoLoading] = useState(false);
  const [expiryPopupResult, setExpiryPopupResult] = useState<string | null>(null);
  const expiryFileRef = useRef<HTMLInputElement>(null);

  async function openProductDetail(item: PantryItem) {
    setDetailItem(item);
    setProductDetails(null);
    if (item.barcode) {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/pantry/product?barcode=${encodeURIComponent(item.barcode)}`);
        if (res.ok) {
          setProductDetails(await res.json());
        }
      } catch {
        // Failed to fetch live details
      } finally {
        setDetailLoading(false);
      }
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item${selectedIds.size !== 1 ? "s" : ""}?`)) return;
    setBulkDeleting(true);
    try {
      await fetch(`/api/pantry?ids=${Array.from(selectedIds).join(",")}`, { method: "DELETE" });
      setSelectedIds(new Set());
      fetchItems();
    } catch {
      // Network error
    } finally {
      setBulkDeleting(false);
    }
  }

  const [newItem, setNewItem] = useState({
    name: "",
    category: "Other",
    quantity: 1,
    unit: "item",
    location: "Pantry",
    expirationDate: "",
    opened: false,
    notes: "",
  });

  useEffect(() => {
    fetchItems();
  }, [filterLocation, filterCategory]);

  async function fetchItems() {
    try {
      const params = new URLSearchParams();
      if (filterLocation) params.set("location", filterLocation);
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/pantry?${params}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      setSelectedIds((prev) => {
        const validIds = new Set(list.map((i: PantryItem) => i.id));
        const next = new Set([...prev].filter((id) => validIds.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      // API or database may be temporarily unavailable
    } finally {
      setLoading(false);
    }
  }

  const submitBarcode = useCallback(async (barcode: string) => {
    setBarcodeLoading(true);
    setBarcodeResult(null);

    try {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: barcode.trim(), location: scanLocation }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        setBarcodeLoading(false);
        setBarcodeResult("Server error. Please try again.");
        return;
      }

      setBarcodeLoading(false);

      if (res.ok) {
        setBarcodeResult(`Added: ${data.name || "item"}`);
        setBarcodeInput("");
        fetchItems();
        // Show expiration date popup
        setExpiryPopup({ itemId: data.id, itemName: data.name || "item" });
        setExpiryManualDate("");
        setExpiryPopupResult(null);
      } else {
        setBarcodeResult(data.error || "Product not found");
      }
    } catch {
      setBarcodeLoading(false);
      setBarcodeResult("Network error. Check your connection and try again.");
    }
  }, [scanLocation]);

  async function handleBarcodeScan(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    submitBarcode(barcodeInput.trim());
  }

  const handleBarcodeDetected = useCallback((barcode: string) => {
    setShowBarcodeScanner(false);
    setBarcodeInput(barcode);
    submitBarcode(barcode);
  }, [submitBarcode]);

  async function handleExpiryPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !expiryPopup) return;

    setExpiryPhotoLoading(true);
    setExpiryPopupResult(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("itemId", expiryPopup.itemId);

      const res = await fetch("/api/pantry/expiration", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success) {
        setExpiryPopupResult(`Expiration date set: ${new Date(data.date).toLocaleDateString()}${data.rawText ? ` (read: "${data.rawText}")` : ""}`);
        fetchItems();
        setTimeout(() => setExpiryPopup(null), 2000);
      } else {
        setExpiryPopupResult(data.message || "Could not read date. Try again or enter manually.");
      }
    } catch {
      setExpiryPopupResult("Failed to analyze photo. Try again or enter manually.");
    } finally {
      setExpiryPhotoLoading(false);
      if (expiryFileRef.current) expiryFileRef.current.value = "";
    }
  }

  async function handleExpiryManualSave() {
    if (!expiryPopup || !expiryManualDate) return;

    try {
      await fetch("/api/pantry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expiryPopup.itemId,
          expirationDate: expiryManualDate,
          expiryEstimateReason: "Manually entered expiration date",
        }),
      });
      setExpiryPopupResult(`Expiration date set: ${new Date(expiryManualDate).toLocaleDateString()}`);
      fetchItems();
      setTimeout(() => setExpiryPopup(null), 1500);
    } catch {
      setExpiryPopupResult("Failed to save date. Try again.");
    }
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
    setNewItem({ name: "", category: "Other", quantity: 1, unit: "item", location: "Pantry", expirationDate: "", opened: false, notes: "" });
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

  async function handleToggleOpened(item: PantryItem) {
    await fetch("/api/pantry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        opened: !item.opened,
        recalculateExpiry: true,
      }),
    });
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this item?")) return;
    await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    fetchItems();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString();
  }

  function getDaysUntilExpiry(dateStr: string | null): number | null {
    if (!dateStr) return null;
    return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function getExpiryClass(dateStr: string | null) {
    const days = getDaysUntilExpiry(dateStr);
    if (days === null) return "";
    if (days < 0) return "text-red-600 font-semibold";
    if (days <= 3) return "text-orange-500 font-semibold";
    if (days <= 7) return "text-amber-500";
    return "text-gray-500";
  }

  function getExpiryLabel(dateStr: string | null): string {
    const days = getDaysUntilExpiry(dateStr);
    if (days === null) return "";
    if (days < 0) return `(expired ${Math.abs(days)}d ago)`;
    if (days === 0) return "(expires today)";
    if (days <= 7) return `(${days}d left)`;
    return "";
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pantry & Inventory</h1>
          <p className="text-gray-500 mt-1 text-sm">
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

      {/* Scanning Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Barcode Scanner */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Barcode Scanner</h2>
          <p className="text-sm text-gray-500 mb-4">
            Scan or type a barcode. Looks up product info from Open Food Facts (4M+ products).
          </p>
          <div className="flex gap-2 mb-3">
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
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              disabled={barcodeLoading}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50 flex-1"
            >
              Scan with Camera
            </button>
          </div>
          <form onSubmit={handleBarcodeScan} className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Or type barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button
              type="submit"
              disabled={barcodeLoading}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
            >
              {barcodeLoading ? "..." : "Look Up"}
            </button>
          </form>
          {barcodeResult && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${barcodeResult.startsWith("Added") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {barcodeResult}
            </div>
          )}
        </div>

        {/* AI Photo Scanner */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-2">AI Photo Scanner</h2>
          <p className="text-sm text-gray-500 mb-4">
            Photograph your shelves. AI identifies items, reads label dates, and estimates expiration.
          </p>
          <div className="flex items-center gap-3">
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
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
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
            <div className="mt-3 flex items-center gap-2 text-blue-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm">AI is analyzing your photo...</span>
            </div>
          )}
          {scanResult && (
            <div className="mt-3 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm">
              {scanResult}
            </div>
          )}
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Add Item Manually</h2>
          <p className="text-xs text-gray-400 mb-4">
            Leave expiration date blank to auto-estimate based on item type, storage, and opened status.
          </p>
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
              placeholder="Expiration (blank = auto)"
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newItem.opened}
                onChange={(e) => setNewItem({ ...newItem, opened: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span>Already opened</span>
            </label>
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

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-red-700">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {bulkDeleting ? "Deleting..." : `Delete Selected`}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Clear
          </button>
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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.opened}
                  onChange={(e) => setEditingItem({ ...editingItem, opened: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span>Opened / Unsealed</span>
              </label>
              {editingItem.expiryEstimateReason && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  Estimate: {editingItem.expiryEstimateReason}
                </p>
              )}
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

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🗄️</p>
            <p>No items found. Scan your pantry or add items manually.</p>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${selectedIds.has(item.id) ? "bg-emerald-50/50" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => openProductDetail(item)}
                        className="text-left hover:text-emerald-700 hover:underline transition-colors"
                      >
                        {item.name}
                      </button>
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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleOpened(item)}
                        className={`text-xs px-2 py-1 rounded-full transition-colors ${
                          item.opened
                            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                        title={item.opened ? "Click to mark as sealed" : "Click to mark as opened"}
                      >
                        {item.opened ? "Opened" : "Sealed"}
                      </button>
                    </td>
                    <td
                      className={`px-4 py-3 ${getExpiryClass(item.expirationDate)} relative`}
                      onMouseEnter={() => setTooltipItem(item.id)}
                      onMouseLeave={() => setTooltipItem(null)}
                    >
                      <div className="cursor-help">
                        {formatDate(item.expirationDate)}
                        {getExpiryLabel(item.expirationDate) && (
                          <span className="text-xs ml-1">{getExpiryLabel(item.expirationDate)}</span>
                        )}
                      </div>
                      {tooltipItem === item.id && item.expiryEstimateReason && (
                        <div className="absolute z-20 bottom-full left-0 mb-1 w-64 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                          {item.expiryEstimateReason}
                          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                        </div>
                      )}
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

            {/* Mobile card view — hidden on desktop */}
            <div className="md:hidden divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className={`p-4 ${selectedIds.has(item.id) ? "bg-emerald-50/50" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer mt-1"
                      />
                      <div>
                        <button
                          onClick={() => openProductDetail(item)}
                          className="font-medium text-left hover:text-emerald-700 hover:underline transition-colors"
                        >
                          {item.name}
                        </button>
                      {item.needsRestock && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          restock
                        </span>
                      )}
                      </div>
                    </div>
                    <div className="flex gap-3 ml-2">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="text-blue-600 hover:text-blue-800 text-sm py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-700 text-sm py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{item.category}</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{item.location}</span>
                    <span>{item.quantity} {item.unit}</span>
                    <button
                      onClick={() => handleToggleOpened(item)}
                      className={`px-2 py-0.5 rounded-full transition-colors ${
                        item.opened
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {item.opened ? "Opened" : "Sealed"}
                    </button>
                  </div>
                  {item.expirationDate && (
                    <div className={`mt-1.5 text-xs ${getExpiryClass(item.expirationDate)}`}>
                      Expires: {formatDate(item.expirationDate)} {getExpiryLabel(item.expirationDate)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Product Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-lg font-semibold truncate pr-4">{detailItem.name}</h3>
              <button
                onClick={() => { setDetailItem(null); setProductDetails(null); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Product image + basic info */}
              <div className="flex gap-6">
                {(productDetails?.imageUrl || detailItem.imageUrl) && (
                  <div className="flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productDetails?.imageUrl || detailItem.imageUrl || ""}
                      alt={detailItem.name}
                      className="w-32 h-32 object-contain rounded-lg border"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  {detailItem.brand && (
                    <p className="text-sm text-gray-500">Brand: <span className="text-gray-700 font-medium">{detailItem.brand}</span></p>
                  )}
                  {detailItem.barcode && (
                    <p className="text-sm text-gray-500">Barcode: <span className="font-mono text-gray-700">{detailItem.barcode}</span></p>
                  )}
                  <p className="text-sm text-gray-500">Category: <span className="text-gray-700">{detailItem.category}</span></p>
                  <p className="text-sm text-gray-500">Location: <span className="text-gray-700">{detailItem.location}</span></p>
                  <p className="text-sm text-gray-500">Quantity: <span className="text-gray-700">{detailItem.quantity} {detailItem.unit}</span></p>
                  <p className="text-sm text-gray-500">
                    Status:{" "}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${detailItem.opened ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                      {detailItem.opened ? "Opened" : "Sealed"}
                    </span>
                  </p>
                  {detailItem.expirationDate && (
                    <p className={`text-sm ${getExpiryClass(detailItem.expirationDate)}`}>
                      Expires: {formatDate(detailItem.expirationDate)} {getExpiryLabel(detailItem.expirationDate)}
                    </p>
                  )}
                  {detailItem.purchaseDate && (
                    <p className="text-sm text-gray-500">Purchased: {formatDate(detailItem.purchaseDate)}</p>
                  )}
                </div>
              </div>

              {/* Nutri-Score and NOVA */}
              {(detailItem.nutriScore || detailItem.novaGroup || productDetails?.nutriScore || productDetails?.novaGroup) && (
                <div className="flex gap-4">
                  {(productDetails?.nutriScore || detailItem.nutriScore) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Nutri-Score:</span>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm uppercase ${
                        {a: "bg-green-600", b: "bg-lime-500", c: "bg-yellow-500", d: "bg-orange-500", e: "bg-red-600"}[
                          (productDetails?.nutriScore || detailItem.nutriScore || "").toLowerCase()
                        ] || "bg-gray-400"
                      }`}>
                        {(productDetails?.nutriScore || detailItem.nutriScore || "").toUpperCase()}
                      </span>
                    </div>
                  )}
                  {(productDetails?.novaGroup || detailItem.novaGroup) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">NOVA Group:</span>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm ${
                        {1: "bg-green-600", 2: "bg-yellow-500", 3: "bg-orange-500", 4: "bg-red-600"}[
                          productDetails?.novaGroup || detailItem.novaGroup || 0
                        ] || "bg-gray-400"
                      }`}>
                        {productDetails?.novaGroup || detailItem.novaGroup}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Loading indicator for live data */}
              {detailLoading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <span className="text-sm">Fetching product details from Open Food Facts...</span>
                </div>
              )}

              {/* Nutrition facts from live API */}
              {productDetails?.nutriments && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Nutrition Facts <span className="font-normal text-gray-400">(per 100g)</span></h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <table className="w-full text-sm">
                      <tbody>
                        {[
                          ["Energy", productDetails.nutriments.energy_kcal, "kcal"],
                          ["Fat", productDetails.nutriments.fat, "g"],
                          ["  Saturated Fat", productDetails.nutriments.saturatedFat, "g"],
                          ["Carbohydrates", productDetails.nutriments.carbs, "g"],
                          ["  Sugars", productDetails.nutriments.sugars, "g"],
                          ["Fiber", productDetails.nutriments.fiber, "g"],
                          ["Protein", productDetails.nutriments.protein, "g"],
                          ["Salt", productDetails.nutriments.salt, "g"],
                        ].filter(([, val]) => val != null).map(([label, value, unit]) => (
                          <tr key={label as string} className="border-b border-gray-200 last:border-0">
                            <td className={`py-1.5 text-gray-600 ${(label as string).startsWith("  ") ? "pl-4 text-gray-400" : ""}`}>
                              {(label as string).trim()}
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {typeof value === "number" ? value.toFixed(1) : value} {unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {(productDetails?.ingredients || detailItem.ingredients) && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Ingredients</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                    {productDetails?.ingredients || detailItem.ingredients}
                  </p>
                </div>
              )}

              {/* Allergens */}
              {productDetails?.allergens && productDetails.allergens.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Allergens</h4>
                  <div className="flex flex-wrap gap-2">
                    {productDetails.allergens.map((a) => (
                      <span key={a} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium capitalize">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional info */}
              {(productDetails?.labels || productDetails?.origins) && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {productDetails.labels && (
                    <div>
                      <span className="text-gray-500">Labels:</span>
                      <p className="text-gray-700 mt-1">{productDetails.labels}</p>
                    </div>
                  )}
                  {productDetails.origins && (
                    <div>
                      <span className="text-gray-500">Origins:</span>
                      <p className="text-gray-700 mt-1">{productDetails.origins}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Expiry estimate reason */}
              {detailItem.expiryEstimateReason && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Expiration Estimate</h4>
                  <p className="text-sm text-gray-600 bg-amber-50 rounded-lg p-3">
                    {detailItem.expiryEstimateReason}
                  </p>
                </div>
              )}

              {/* Notes */}
              {detailItem.notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{detailItem.notes}</p>
                </div>
              )}

              {/* Open Food Facts link */}
              {productDetails?.url && (
                <div className="pt-2 border-t">
                  <a
                    href={productDetails.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View on Open Food Facts &rarr;
                  </a>
                </div>
              )}

              {/* No barcode message */}
              {!detailItem.barcode && (
                <p className="text-sm text-gray-400 italic">
                  This item was added manually or via photo scan. Scan a barcode to see full product details.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expiration Date Popup — shown after successful barcode scan */}
      {expiryPopup && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Set Expiration Date</h3>
              <button
                onClick={() => setExpiryPopup(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{expiryPopup.itemName}</span> was added. How would you like to set the expiration date?
              </p>

              {/* Take Photo button */}
              <button
                onClick={() => expiryFileRef.current?.click()}
                disabled={expiryPhotoLoading}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {expiryPhotoLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    AI is reading the date...
                  </>
                ) : (
                  "Take Photo of Expiration Date"
                )}
              </button>
              <input
                ref={expiryFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleExpiryPhoto}
              />

              {/* Manual date entry */}
              <div className="flex gap-2">
                <input
                  type="date"
                  value={expiryManualDate}
                  onChange={(e) => setExpiryManualDate(e.target.value)}
                  className="border rounded-lg px-3 py-2.5 text-sm flex-1"
                />
                <button
                  onClick={handleExpiryManualSave}
                  disabled={!expiryManualDate}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Save Date
                </button>
              </div>

              {/* Result message */}
              {expiryPopupResult && (
                <div className={`px-3 py-2 rounded-lg text-sm ${expiryPopupResult.startsWith("Expiration date set") ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {expiryPopupResult}
                </div>
              )}

              {/* Skip button */}
              <button
                onClick={() => setExpiryPopup(null)}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors"
              >
                Skip — use estimated date
              </button>
            </div>
          </div>
        </div>
      )}

      {showBarcodeScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
}
