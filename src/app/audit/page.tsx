"use client";

import { useState, useEffect } from "react";

interface AuditFindings {
  expired: { id: string; name: string; expirationDate: string }[];
  expiringSoon: { id: string; name: string; expirationDate: string; daysLeft: number }[];
  needsRestock: { id: string; name: string; quantity: number; unit: string }[];
  lowQuantity: { id: string; name: string; quantity: number; unit: string }[];
  totalItems: number;
}

interface AuditLog {
  id: string;
  type: string;
  summary: string | null;
  details: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentFindings, setCurrentFindings] = useState<AuditFindings | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    const res = await fetch("/api/audit");
    const data = await res.json();
    setLogs(data);
    setLoading(false);
  }

  async function runAudit(type: string) {
    setRunning(true);
    setCurrentFindings(null);

    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    const data = await res.json();
    setRunning(false);
    setCurrentFindings(data.findings);
    fetchLogs();
  }

  async function addToShoppingList(items: { name: string; quantity: number; unit: string }[]) {
    for (const item of items) {
      await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    }
    alert(`Added ${items.length} items to shopping list`);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inventory Audit</h1>
        <p className="text-gray-500 mt-1">
          Run periodic audits to check expiration dates and restock needs
        </p>
      </div>

      {/* Audit Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => runAudit("full_audit")}
          disabled={running}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow text-left disabled:opacity-50"
        >
          <div className="text-2xl mb-2">🔍</div>
          <h3 className="font-semibold">Full Audit</h3>
          <p className="text-sm text-gray-500 mt-1">
            Check all items for expiration, low stock, and restock needs
          </p>
        </button>
        <button
          onClick={() => runAudit("expiration_check")}
          disabled={running}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow text-left disabled:opacity-50"
        >
          <div className="text-2xl mb-2">⏰</div>
          <h3 className="font-semibold">Expiration Check</h3>
          <p className="text-sm text-gray-500 mt-1">
            Find items that are expired or expiring soon
          </p>
        </button>
        <button
          onClick={() => runAudit("restock_check")}
          disabled={running}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow text-left disabled:opacity-50"
        >
          <div className="text-2xl mb-2">📦</div>
          <h3 className="font-semibold">Restock Check</h3>
          <p className="text-sm text-gray-500 mt-1">
            Identify items running low that need to be restocked
          </p>
        </button>
      </div>

      {running && (
        <div className="bg-blue-50 rounded-xl p-6 mb-6 flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-blue-700">Running audit...</span>
        </div>
      )}

      {/* Current Audit Results */}
      {currentFindings && (
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">Audit Results</h2>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{currentFindings.totalItems}</p>
              <p className="text-xs text-gray-500">Total Items</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-100 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{currentFindings.expired.length}</p>
              <p className="text-xs text-red-500">Expired</p>
            </div>
            <div className="bg-amber-50 rounded-lg border border-amber-100 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{currentFindings.expiringSoon.length}</p>
              <p className="text-xs text-amber-500">Expiring Soon</p>
            </div>
            <div className="bg-orange-50 rounded-lg border border-orange-100 p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{currentFindings.needsRestock.length}</p>
              <p className="text-xs text-orange-500">Needs Restock</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{currentFindings.lowQuantity.length}</p>
              <p className="text-xs text-blue-500">Low Quantity</p>
            </div>
          </div>

          {/* Expired Items */}
          {currentFindings.expired.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center justify-between">
                <h3 className="font-semibold text-red-700">Expired Items</h3>
              </div>
              <ul>
                {currentFindings.expired.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-red-500">Expired {formatDate(item.expirationDate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expiring Soon */}
          {currentFindings.expiringSoon.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
                <h3 className="font-semibold text-amber-700">Expiring Within 7 Days</h3>
              </div>
              <ul>
                {currentFindings.expiringSoon.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-amber-600">
                      {item.daysLeft === 0 ? "Expires today" : `${item.daysLeft} day${item.daysLeft !== 1 ? "s" : ""} left`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Needs Restock */}
          {currentFindings.needsRestock.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center justify-between">
                <h3 className="font-semibold text-orange-700">Needs Restock</h3>
                <button
                  onClick={() => addToShoppingList(currentFindings.needsRestock)}
                  className="text-xs bg-orange-600 text-white px-3 py-1 rounded-lg hover:bg-orange-700"
                >
                  Add all to Shopping List
                </button>
              </div>
              <ul>
                {currentFindings.needsRestock.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-gray-500">
                      {item.quantity} {item.unit} remaining
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentFindings.expired.length === 0 &&
            currentFindings.expiringSoon.length === 0 &&
            currentFindings.needsRestock.length === 0 &&
            currentFindings.lowQuantity.length === 0 && (
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-green-700 font-medium">Everything looks good! No issues found.</p>
              </div>
            )}
        </div>
      )}

      {/* Audit History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-600">Audit History</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No audits have been run yet. Click one of the buttons above to start.</p>
          </div>
        ) : (
          <ul>
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium capitalize">
                      {log.type.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">{log.summary}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
