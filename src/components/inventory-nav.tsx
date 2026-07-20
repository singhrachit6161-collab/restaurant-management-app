"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/inventory", label: "Ingredients" },
  { href: "/inventory/purchase-orders", label: "Purchase Orders" },
  { href: "/inventory/suppliers", label: "Suppliers" },
];

export function InventoryNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b bg-card px-5">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
