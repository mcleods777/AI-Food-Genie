"use client";

import { useState, useEffect, useMemo } from "react";

interface MeatPrice {
  id: string;
  store: string;
  productName: string;
  cut: string;
  grade: string;
  pricePerLb: number | null;
  totalPrice: number | null;
  packSize: string | null;
  onSale: boolean;
  saleNote: string | null;
  sourceNote: string | null;
  confidence: number;
  linkUrl: string;
  fetchedAt: string;
}

interface PricesResponse {
  prices: MeatPrice[];
  lastFetched: string | null;
  zipCode: string | null;
  cuts: string[];
  stores: string[];
  gradeRank: Record<string, number>;
}

type SortMode = "price" | "quality";

const GRADE_STYLES: Record<string, string> = {
  Wagyu: "bg-amber-100 text-amber-800 border-amber-300",
  Prime: "bg-purple-100 text-purple-800 border-purple-300",
  Choice: "bg-blue-100 text-blue-800 border-blue-300",
  Angus: "bg-indigo-100 text-indigo-800 border-indigo-300",
  Select: "bg-slate-100 text-slate-700 border-slate-300",
  Ungraded: "bg-gray-100 text-gray-600 border-gray-300",
};

export default function PricesPage() {
  const [data, setData] = useState<PricesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [zipSaved, setZipSaved] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const [cutFilter, setCutFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");

  useEffect(() => {
    fetchPrices();
  }, []);

  async function fetchPrices() {
    try {
      const res = await fetch("/api/prices");
      const json: PricesResponse = await res.json();
      setData(json);
      setZipInput(json.zipCode || "");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveZip() {
    const res = await fetch("/api/prices/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zipCode: zipInput }),
    });
    if (res.ok) {
      setZipSaved(true);
      setTimeout(() => setZipSaved(false), 2000);
    } else {
      const err = await res.json().catch(() => null);
      setRefreshMessage(err?.error || "Could not save zip code");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setRefreshMessage(json.error || "Refresh failed");
      } else if (json.saved === 0) {
        setRefreshMessage(
          "No prices found this run. " +
            (json.errors?.length
              ? `Store errors: ${json.errors.map((e: { store: string }) => e.store).join(", ")}`
              : "Try again in a few minutes.")
        );
      } else {
        setRefreshMessage(`Found ${json.saved} prices.`);
        await fetchPrices();
      }
    } catch {
      setRefreshMessage("Refresh failed — network error");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = [...data.prices];
    if (cutFilter !== "all") rows = rows.filter((p) => p.cut === cutFilter);
    if (storeFilter !== "all") rows = rows.filter((p) => p.store === storeFilter);

    const rank = (g: string) => data.gradeRank[g] ?? 0;
    if (sortMode === "quality") {
      rows.sort(
        (a, b) =>
          rank(b.grade) - rank(a.grade) ||
          (a.pricePerLb ?? Infinity) - (b.pricePerLb ?? Infinity)
      );
    } else {
      rows.sort(
        (a, b) =>
          (a.pricePerLb ?? Infinity) - (b.pricePerLb ?? Infinity) ||
          rank(b.grade) - rank(a.grade)
      );
    }
    return rows;
  }, [data, cutFilter, storeFilter, sortMode]);

  // Cuts that actually have prices, for the filter dropdown
  const cutsWithPrices = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.prices.map((p) => p.cut))].sort();
  }, [data]);

  if (loading) {
    return <div className="text-gray-500 p-8">Loading prices…</div>;
  }

  const lastFetched = data?.lastFetched
    ? new Date(data.lastFetched).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Meat Prices</h1>
        <p className="text-gray-600 mt-1">
          Daily price comparison across ALDI and Hy-Vee, sorted by price or USDA quality grade.
        </p>
      </div>

      {/* Settings + refresh bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="zip" className="text-sm font-medium text-gray-700">
            Zip code
          </label>
          <input
            id="zip"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 50310"
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            onClick={handleSaveZip}
            className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            {zipSaved ? "Saved ✓" : "Save"}
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-gray-500">Updated {lastFetched}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {refreshing ? "Checking stores… (~30s)" : "Refresh prices"}
          </button>
        </div>
      </div>

      {refreshMessage && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          {refreshMessage}
        </div>
      )}

      {/* Sort + filter controls */}
      {data && data.prices.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setSortMode("price")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                sortMode === "price"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Best price
            </button>
            <button
              onClick={() => setSortMode("quality")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                sortMode === "quality"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Best quality
            </button>
          </div>

          <select
            value={cutFilter}
            onChange={(e) => setCutFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All cuts</option>
            {cutsWithPrices.map((cut) => (
              <option key={cut} value={cut}>
                {cut}
              </option>
            ))}
          </select>

          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All stores</option>
            {data.stores.map((store) => (
              <option key={store} value={store}>
                {store}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Price list */}
      {!data || data.prices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">🥩</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No prices yet</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Set your zip code and hit <strong>Refresh prices</strong>. The genie checks
            ALDI and Hy-Vee weekly ads and store pages, then updates automatically every
            morning.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center gap-3"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{p.productName}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      GRADE_STYLES[p.grade] || GRADE_STYLES.Ungraded
                    }`}
                  >
                    {p.grade}
                  </span>
                  {p.onSale && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
                      Sale
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                  <span className="font-medium text-gray-700">{p.store}</span>
                  <span>{p.cut}</span>
                  {p.packSize && <span>{p.packSize}</span>}
                  {p.saleNote && <span className="text-red-600">{p.saleNote}</span>}
                </div>
                {p.confidence < 0.5 && (
                  <div className="text-xs text-amber-600 mt-1">
                    ⚠ Price from a third-party report — verify at the store
                  </div>
                )}
              </div>

              <div className="text-right">
                {p.pricePerLb != null && (
                  <div className="text-lg font-bold text-gray-900">
                    ${p.pricePerLb.toFixed(2)}
                    <span className="text-sm font-normal text-gray-500">/lb</span>
                  </div>
                )}
                {p.totalPrice != null && (
                  <div className={p.pricePerLb != null ? "text-sm text-gray-500" : "text-lg font-bold text-gray-900"}>
                    ${p.totalPrice.toFixed(2)}
                    {p.pricePerLb == null && (
                      <span className="text-sm font-normal text-gray-500"> each</span>
                    )}
                  </div>
                )}
              </div>

              <a
                href={p.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
              >
                View at store ↗
              </a>
            </div>
          ))}
        </div>
      )}

      {data && data.prices.length > 0 && (
        <p className="text-xs text-gray-400 mt-6">
          Prices come from store weekly ads and websites via AI search and can lag the
          shelf price. Store links open a live search at the store&apos;s site so you
          always land on current products — set your store there once and prices shown
          on their site will match your location.
        </p>
      )}
    </div>
  );
}
