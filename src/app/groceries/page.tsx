"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

interface GroceryItem {
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
  const [tooltipItem, setTooltipItem] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<string | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
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

  const submitBarcode = useCallback(async (barcode: string) => {
    setBarcodeLoading(true);
    setBarcodeResult(null);

    const res = await fetch("/api/groceries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: barcode.trim() }),
    });

    const data = await res.json();
    setBarcodeLoading(false);

    if (res.ok) {
      setBarcodeResult(`Added: ${data.name}`);
      setBarcodeInput("");
      fetchItems();
    } else {
      setBarcodeResult(data.error || "Product not found");
    }
  }, []);

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
      body: JSON.stringify({
        id,
        expirationDate: date || null,
        expiryEstimateReason: date ? "Manually set expiration date" : null,
      }),
    });
    setEditingExpiry(null);
    fetchItems();
  }

  async function handleToggleOpened(item: GroceryItem) {
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

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "\u2014";
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

  function getExpiryLabel(dateStr: string | null): string {
    if (!dateStr) return "";
    const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `(expired ${Math.abs(days)}d ago)`;
    if (days === 0) return "(expires today)";
    if (days <= 7) return `(${days}d left)`;
    return "";
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Grocery Tracker</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Photograph grocery purchases to catalog them with smart expiration estimates
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
        >
          + Add Purchase
        </button>
      </div>

      {/* Scanning Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Barcode Scanner */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Barcode Scanner</h2>
          <p className="text-sm text-gray-500 mb-4">
            Scan a barcode to instantly look up product info and auto-assign storage &amp; expiration.
          </p>
          <button
            type="button"
            onClick={() => setShowBarcodeScanner(true)}
            disabled={barcodeLoading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50 w-full mb-3"
          >
            Scan with Camera
          </button>
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
            Photograph grocery items. AI reads label dates and estimates expiration. Adjust dates anytime.
          </p>
          <div className="flex items-center gap-3">
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
              <span className="text-sm">AI is analyzing your grocery items...</span>
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
          <h2 className="text-lg font-semibold mb-2">Log Purchase Manually</h2>
          <p className="text-xs text-gray-400 mb-4">
            Leave expiration date blank to auto-estimate based on item type and storage.
          </p>
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
              placeholder="Expiration (blank = auto)"
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
          <>
            {/* Desktop table — hidden on mobile */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleOpened(item)}
                        className={`text-xs px-2 py-1 rounded-full transition-colors ${
                          item.opened
                            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                        title={`${item.opened ? "Opened" : "Sealed"} - click to toggle (changes expiration estimate)`}
                      >
                        {item.opened ? "Opened" : "Sealed"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(item.purchaseDate)}</td>
                    <td
                      className={`px-4 py-3 relative ${getExpiryClass(item.expirationDate)}`}
                      onMouseEnter={() => setTooltipItem(item.id)}
                      onMouseLeave={() => setTooltipItem(null)}
                    >
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
                          <button
                            onClick={() => setEditingExpiry(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="cursor-help">
                          <span
                            onClick={() => setEditingExpiry({ id: item.id, date: item.expirationDate?.split("T")[0] || "" })}
                            className="cursor-pointer hover:text-blue-600 underline-offset-2 hover:underline"
                            title="Click to edit expiration date"
                          >
                            {formatDate(item.expirationDate)}
                          </span>
                          {getExpiryLabel(item.expirationDate) && (
                            <span className="text-xs ml-1">{getExpiryLabel(item.expirationDate)}</span>
                          )}
                          {tooltipItem === item.id && item.expiryEstimateReason && (
                            <div className="absolute z-20 bottom-full left-0 mb-1 w-64 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                              {item.expiryEstimateReason}
                              <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                            </div>
                          )}
                        </div>
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

            {/* Mobile card view — hidden on desktop */}
            <div className="md:hidden divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium">{item.name}</span>
                    <button
                      onClick={() => setEditingExpiry({ id: item.id, date: item.expirationDate?.split("T")[0] || "" })}
                      className="text-blue-600 text-sm py-1 ml-2"
                    >
                      Set Expiry
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{item.category}</span>
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
                  <div className="flex items-center justify-between mt-1.5 text-xs">
                    <span className="text-gray-400">Purchased: {formatDate(item.purchaseDate)}</span>
                    {item.expirationDate && (
                      <span className={getExpiryClass(item.expirationDate)}>
                        Exp: {formatDate(item.expirationDate)} {getExpiryLabel(item.expirationDate)}
                      </span>
                    )}
                  </div>
                  {editingExpiry?.id === item.id && (
                    <div className="flex gap-2 mt-2 items-center">
                      <input
                        type="date"
                        value={editingExpiry.date}
                        onChange={(e) => setEditingExpiry({ ...editingExpiry, date: e.target.value })}
                        className="border rounded px-2 py-1.5 text-sm flex-1"
                      />
                      <button
                        onClick={() => handleUpdateExpiry(item.id, editingExpiry.date)}
                        className="text-emerald-600 text-sm font-medium py-1.5"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingExpiry(null)}
                        className="text-gray-400 text-sm py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {showBarcodeScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
}
