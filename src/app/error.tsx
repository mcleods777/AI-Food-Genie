"use client";

import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Auto-retry once after 2 seconds (handles Neon cold-start)
  useEffect(() => {
    if (retryCount === 0) {
      const timer = setTimeout(() => {
        setRetryCount(1);
        reset();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [retryCount, reset]);

  function handleRetry() {
    setRetrying(true);
    setRetryCount((c) => c + 1);
    setTimeout(() => {
      reset();
      setRetrying(false);
    }, 500);
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4">Something went wrong</p>
        <p className="text-gray-500 text-sm mb-6">
          {error.message ||
            "This is usually caused by a database cold-start or connection timeout. Please try again."}
        </p>
        {error.digest && (
          <p className="text-gray-300 text-xs mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {retrying ? "Retrying..." : "Try Again"}
        </button>
        {retryCount > 1 && (
          <p className="text-gray-400 text-xs mt-4">
            If the problem persists, check that DATABASE_URL is set correctly in Vercel
            environment variables and that your database is accessible.
          </p>
        )}
      </div>
    </div>
  );
}
