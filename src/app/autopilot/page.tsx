"use client";

import { useState, useEffect, useCallback } from "react";
import { TonightsMeal } from "@/components/TonightsMeal";
import { NotificationSetup } from "@/components/NotificationSetup";

interface Assignment {
  id: string;
  date: string;
  mealName: string;
  ingredients: { name: string; fromPantry: boolean; expiring: boolean }[];
  steps: string[];
  prepMinutes: number;
  usesExpiring: string[];
  reason: string | null;
  status: string;
  respondedAt: string | null;
}

export default function AutopilotPage() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [yesterdayMeal, setYesterdayMeal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const fetchAssignment = useCallback(async () => {
    try {
      const res = await fetch("/api/assignments?limit=2");
      if (!res.ok) return;

      const assignments: Assignment[] = await res.json();

      // Find today's assignment
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const todayAssignment = assignments.find(a =>
        new Date(a.date).toISOString().split("T")[0] === todayStr
      );

      if (todayAssignment) {
        setAssignment(todayAssignment);
      }

      // Find yesterday's meal for the empty state
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const yesterdayAssignment = assignments.find(a =>
        new Date(a.date).toISOString().split("T")[0] === yesterdayStr
      );
      if (yesterdayAssignment) {
        setYesterdayMeal(yesterdayAssignment.mealName);
      }
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    }
  }, []);

  const checkOnboarding = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) {
        setNeedsOnboarding(true);
        return;
      }
      const prefs = await res.json();
      // If no preferences exist (no id field), needs onboarding
      if (!prefs.id) {
        setNeedsOnboarding(true);
      }
    } catch {
      setNeedsOnboarding(true);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAssignment(), checkOnboarding()]).finally(() =>
      setLoading(false)
    );
  }, [fetchAssignment, checkOnboarding]);

  const handleRespond = async (response: "accept" | "skip") => {
    if (!assignment) return;

    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: assignment.id,
        response,
        channel: "app",
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setAssignment(updated);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Finding your dinner...</p>
        </div>
      </div>
    );
  }

  // Onboarding flow (first visit)
  if (needsOnboarding && !onboardingComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <NotificationSetup onComplete={() => {
          setOnboardingComplete(true);
          setNeedsOnboarding(false);
          fetchAssignment();
        }} />
      </div>
    );
  }

  // Main autopilot view
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4 pb-24">
        <TonightsMeal
          assignment={assignment}
          yesterdayMeal={yesterdayMeal}
          onRespond={handleRespond}
        />
      </div>
    </div>
  );
}
