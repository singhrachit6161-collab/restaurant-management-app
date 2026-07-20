"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Table2,
  ChefHat,
  Users2,
  ClipboardList,
  Warehouse,
  Truck,
  ShoppingCart,
  Contact,
  Tag,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/tables", label: "Tables", icon: Table2 },
  { href: "/dashboard/reservations", label: "Reservations", icon: CalendarCheck },
  { href: "/dashboard/orders", label: "Orders", icon: ClipboardList },
  { href: "/dashboard/customers", label: "Customers", icon: Contact },
  { href: "/dashboard/coupons", label: "Coupons", icon: Tag },
  { href: "/dashboard/inventory", label: "Inventory", icon: Warehouse },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/staff", label: "Staff", icon: Users2 },
];

const OPERATIONS = [
  { href: "/kitchen", label: "Kitchen Display" },
  { href: "/waiter", label: "Waiter Panel" },
  { href: "/pos", label: "POS Billing" },
  { href: "/inventory", label: "Inventory (Manager view)" },
];

export function DashboardShell({
  restaurantName,
  userName,
  role,
  children,
}: {
  restaurantName: string;
  userName: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{restaurantName}</p>
            <p className="text-xs text-muted-foreground">RestaurantOS</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Operations
          </p>
          {OPERATIONS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <Badge variant="secondary" className="mt-0.5">
                {role}
              </Badge>
            </div>
          </div>
          <SignOutButton variant="outline" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <p className="font-semibold">{restaurantName}</p>
          <SignOutButton />
        </header>
        <main className="flex-1 bg-muted/30 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
