"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4">Something went wrong</p>
        <p className="text-gray-500 text-sm mb-6">
          {error.message || "An unexpected error occurred. This is often caused by a temporary database connection issue."}
        </p>
        <button
          onClick={reset}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
