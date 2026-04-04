"use client";

import { useState, useEffect } from "react";
import { subscribeToPush } from "./PWARegister";

interface NotificationSetupProps {
  onComplete: () => void;
}

export function NotificationSetup({ onComplete }: NotificationSetupProps) {
  const [step, setStep] = useState<"info" | "permission" | "done">("info");
  const [headcount, setHeadcount] = useState("2");
  const [allergies, setAllergies] = useState("");
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [saving, setSaving] = useState(false);

  const pushSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    // Check if already set up
    if (typeof window !== "undefined" && Notification.permission === "granted") {
      setPushStatus("granted");
    }
  }, []);

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      // Save household config
      const count = parseInt(headcount) || 1;
      await fetch("/api/meal-plans/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Default",
          scenario: count === 1 ? "solo" : count === 2 ? "with_partner" : "with_kids",
          headcount: count,
          isDefault: true,
          notes: allergies ? `Allergies: ${allergies}` : null,
        }),
      });
      setStep("permission");
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    const success = await subscribeToPush();
    if (success) {
      setPushStatus("granted");
      setStep("done");
      // Save notification preferences
      await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: true }),
      });
    } else {
      setPushStatus("denied");
      setStep("done");
    }
  };

  const handleSkipPush = () => {
    setStep("done");
  };

  // Step 1: Household info
  if (step === "info") {
    return (
      <div className="space-y-6 p-4 max-w-sm mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Food Genie</h1>
          <p className="text-gray-500">
            Every day at 4 PM, we&apos;ll tell you what to make for dinner.
            No decisions needed.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="headcount" className="block text-sm font-medium text-gray-700 mb-1">
              How many people are you feeding?
            </label>
            <input
              id="headcount"
              type="number"
              min={1}
              max={12}
              value={headcount}
              onChange={e => setHeadcount(e.target.value)}
              className="w-full h-12 px-4 border border-gray-300 rounded-xl text-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1">
              Any allergies? (optional)
            </label>
            <input
              id="allergies"
              type="text"
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
              placeholder="e.g., peanuts, dairy"
              className="w-full h-12 px-4 border border-gray-300 rounded-xl text-base focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleSaveInfo}
          disabled={saving}
          className="w-full h-14 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors text-lg"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    );
  }

  // Step 2: Push permission
  if (step === "permission") {
    return (
      <div className="space-y-6 p-4 max-w-sm mx-auto text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">One more thing</h2>
          <p className="text-gray-500">
            Get a daily notification at 4 PM with tonight&apos;s dinner.
            No opening the app, no remembering. We come to you.
          </p>
        </div>

        {pushSupported ? (
          <div className="space-y-3">
            <button
              onClick={handleEnablePush}
              className="w-full h-14 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 transition-colors text-lg"
            >
              Enable daily reminders
            </button>
            <button
              onClick={handleSkipPush}
              className="w-full h-12 text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              Skip for now
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-amber-600">
              Push notifications aren&apos;t available in this browser.
              Open the app at 4 PM to see your meal.
            </p>
            <button
              onClick={() => { setStep("done"); }}
              className="w-full h-14 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-lg"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    );
  }

  // Step 3: Done
  return (
    <div className="space-y-6 p-4 max-w-sm mx-auto text-center py-12">
      <div className="text-4xl">🎉</div>
      <h2 className="text-xl font-bold text-gray-900">
        {pushStatus === "granted" ? "You're all set!" : "You're set up!"}
      </h2>
      <p className="text-gray-500">
        {pushStatus === "granted"
          ? "Your first meal arrives at 4 PM today."
          : "Open the app at 4 PM to see tonight's dinner."}
      </p>
      <button
        onClick={onComplete}
        className="w-full h-14 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-lg"
      >
        Let&apos;s go
      </button>
    </div>
  );
}
