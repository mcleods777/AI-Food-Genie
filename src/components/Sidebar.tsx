"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/pantry", label: "Pantry & Inventory", icon: "🗄️" },
  { href: "/groceries", label: "Grocery Tracker", icon: "🛒" },
  { href: "/recipes", label: "Recipes", icon: "📖" },
  { href: "/meal-planner", label: "Meal Planner", icon: "📅" },
  { href: "/shopping-list", label: "Shopping List", icon: "📝" },
  { href: "/audit", label: "Inventory Audit", icon: "🔍" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-emerald-800 to-emerald-950 text-white shadow-xl z-10">
      <div className="p-6 border-b border-emerald-700">
        <h1 className="text-xl font-bold tracking-tight">AI Food Genie</h1>
        <p className="text-emerald-300 text-sm mt-1">Smart Kitchen Assistant</p>
      </div>
      <nav className="mt-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-emerald-700/60 text-white border-r-4 border-emerald-300"
                  : "text-emerald-200 hover:bg-emerald-700/30 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-emerald-700">
        <p className="text-emerald-400 text-xs text-center">
          Powered by AI Vision
        </p>
      </div>
    </aside>
  );
}
