"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);

  // Keep the ref current without re-running the effect
  onDetectedRef.current = onDetected;

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let stopped = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        const html5QrCode = new Html5Qrcode("barcode-reader");
        html5QrCodeRef.current = html5QrCode;
        scanner = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          (decodedText: string) => {
            // Mark as stopped to prevent cleanup from double-stopping
            stopped = true;
            html5QrCode.stop().then(() => {
              try { html5QrCode.clear(); } catch { /* already cleaned */ }
            }).catch(() => {});
            onDetectedRef.current(decodedText);
          },
          () => {
            // Ignore scan failures (happens every frame without a barcode)
          }
        );
      } catch (err) {
        if (stopped) return;
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Permission")) {
          setError("Camera permission denied. Please allow camera access and try again.");
        } else if (message.includes("NotFound") || message.includes("no camera")) {
          setError("No camera found on this device.");
        } else {
          setError("Could not start camera: " + message);
        }
      }
    }

    startScanner();

    return () => {
      if (stopped) return; // Already cleaned up by successful scan
      stopped = true;
      if (scanner) {
        scanner.stop().then(() => {
          try { scanner!.clear(); } catch { /* ignore */ }
        }).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Scan Barcode</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg p-4 text-center">
              <p>{error}</p>
              <button
                onClick={onClose}
                className="mt-3 bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div
                id="barcode-reader"
                ref={scannerRef}
                className="w-full rounded-lg overflow-hidden"
              />
              <p className="text-xs text-gray-500 text-center mt-3">
                Point your camera at a barcode on the product
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
