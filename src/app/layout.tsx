import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { PWARegister } from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "AI Food Genie",
  description: "AI-powered pantry management, meal planning, and recipe tracking",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Food Genie",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <PWARegister />
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 p-4 md:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
