"use client";

import { useState } from "react";
import { getFallbackMeal } from "@/lib/ai";

interface Ingredient {
  name: string;
  fromPantry: boolean;
  expiring: boolean;
}

interface Assignment {
  id: string;
  date: string;
  mealName: string;
  ingredients: Ingredient[];
  steps: string[];
  prepMinutes: number;
  usesExpiring: string[];
  reason: string | null;
  status: string;
  respondedAt: string | null;
}

interface TonightsMealProps {
  assignment: Assignment | null;
  yesterdayMeal: string | null;
  onRespond: (response: "accept" | "skip") => Promise<void>;
}

export function TonightsMeal({ assignment, yesterdayMeal, onRespond }: TonightsMealProps) {
  const [responding, setResponding] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const handleRespond = async (response: "accept" | "skip") => {
    setResponding(true);
    try {
      await onRespond(response);
      if (response === "skip") {
        setShowAlternatives(true);
      }
    } finally {
      setResponding(false);
    }
  };

  const toggleStep = (index: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Before 4 PM / no assignment state
  if (!assignment) {
    return (
      <div className="space-y-6 text-center py-12">
        {yesterdayMeal && (
          <div className="text-sm text-gray-500">
            Yesterday: {yesterdayMeal} ✓
          </div>
        )}
        <div className="text-xl font-bold text-gray-900">
          Today&apos;s meal arrives at 4 PM
        </div>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          We&apos;ll send you a push notification with tonight&apos;s dinner.
          No decisions needed.
        </p>
      </div>
    );
  }

  // Accepted state
  if (assignment.status === "accepted") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-full px-4 py-2 text-sm font-medium">
            ✓ You&apos;re making dinner tonight
          </div>
        </div>
        <MealCard
          assignment={assignment}
          checkedSteps={checkedSteps}
          onToggleStep={toggleStep}
        />
      </div>
    );
  }

  // Skipped state — show alternatives
  if (assignment.status === "skipped" || showAlternatives) {
    const recentNames = [assignment.mealName];
    const alternatives = [
      getFallbackMeal(recentNames),
      getFallbackMeal([...recentNames, getFallbackMeal(recentNames).mealName]),
      getFallbackMeal([...recentNames, getFallbackMeal(recentNames).mealName, getFallbackMeal([...recentNames, getFallbackMeal(recentNames).mealName]).mealName]),
    ];

    return (
      <div className="space-y-4">
        <p className="text-gray-600 text-center">No worries. Pick one of these:</p>
        {alternatives.map((meal, i) => (
          <button
            key={i}
            onClick={() => {
              // In a full implementation, this would create a new assignment
              // For now, it reloads to show the selection
              window.location.reload();
            }}
            className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">{meal.mealName}</span>
              <span className="text-sm text-gray-500">{meal.prepMinutes} min</span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Pending state — the main zero-decision card
  return (
    <div className="space-y-6">
      <MealCard
        assignment={assignment}
        checkedSteps={checkedSteps}
        onToggleStep={toggleStep}
      />

      {/* Sticky action buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-10">
        <button
          onClick={() => handleRespond("accept")}
          disabled={responding}
          className="flex-1 h-14 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors text-lg"
        >
          {responding ? "..." : "Let's do it"}
        </button>
        <button
          onClick={() => handleRespond("skip")}
          disabled={responding}
          className="flex-1 h-14 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 transition-colors text-lg"
        >
          Not tonight
        </button>
      </div>
      {/* Spacer for sticky buttons */}
      <div className="h-20" />
    </div>
  );
}

function MealCard({
  assignment,
  checkedSteps,
  onToggleStep,
}: {
  assignment: Assignment;
  checkedSteps: Set<number>;
  onToggleStep: (index: number) => void;
}) {
  const ingredients = assignment.ingredients as Ingredient[];
  const steps = assignment.steps as string[];

  return (
    <div className="space-y-6">
      {/* Hero: Meal name */}
      <div>
        <p className="text-sm text-gray-500 mb-1">Tonight&apos;s Dinner</p>
        <h1 className="text-2xl font-bold text-gray-900">{assignment.mealName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {assignment.prepMinutes} min · {ingredients.length} ingredients
        </p>
      </div>

      {/* Expiration callout */}
      {assignment.usesExpiring.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-amber-800 text-sm font-medium">
            ⚠️ Uses your {assignment.usesExpiring.join(", ")} before {assignment.usesExpiring.length === 1 ? "it expires" : "they expire"}
          </p>
        </div>
      )}

      {/* Ingredients */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Ingredients</h2>
        <ul className="space-y-2">
          {ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-3 text-base text-gray-700">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ing.expiring ? "bg-amber-500" : ing.fromPantry ? "bg-emerald-500" : "bg-gray-300"}`} />
              {ing.name}
            </li>
          ))}
        </ul>
      </div>

      {/* Steps */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Steps</h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i}>
              <button
                onClick={() => onToggleStep(i)}
                className="flex items-start gap-3 w-full text-left min-h-[48px] py-2"
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium mt-0.5 ${
                    checkedSteps.has(i)
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {checkedSteps.has(i) ? "✓" : i + 1}
                </span>
                <span
                  className={`text-base leading-relaxed ${
                    checkedSteps.has(i) ? "text-gray-400 line-through" : "text-gray-700"
                  }`}
                >
                  {step}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Reason */}
      {assignment.reason && (
        <p className="text-xs text-gray-400 italic">{assignment.reason}</p>
      )}
    </div>
  );
}
