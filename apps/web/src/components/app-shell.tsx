"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ImageDown, Map, Plus, Search, TrainFront, Upload } from "lucide-react";
import { cn } from "@trainmap/ui";

const navItems = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/map", label: "Map", icon: Map },
  { href: "/trips", label: "Trips", icon: TrainFront },
  { href: "/trips/new", label: "Add trip", icon: Plus },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/stations", label: "Stations", icon: Search },
  { href: "/export", label: "Export", icon: ImageDown }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-black/10 bg-[#f8f5ef]/92 px-4 py-5 backdrop-blur-xl lg:block">
        <Link href="/" className="block border-b border-black/10 pb-5">
          <div className="font-display text-3xl text-ink">trainmap</div>
          <div className="mt-1 text-xs uppercase text-black/50">rail footprint archive</div>
        </Link>
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-ink text-white shadow-panel"
                    : "text-black/66 hover:bg-white/70 hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-md border border-black/10 bg-white/65 p-3 text-xs leading-5 text-black/62">
          <div className="font-medium text-ink">Saved view</div>
          <div>2025 cross-border rail, manual geometry visible, poster theme dark.</div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f8f5ef]/92 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display text-2xl text-ink">
            trainmap
          </Link>
          <Link href="/trips/new" className="rounded-md bg-ink p-2 text-white" aria-label="Add trip">
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
