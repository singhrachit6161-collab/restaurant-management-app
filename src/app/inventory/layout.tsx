import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { InventoryNav } from "@/components/inventory-nav";
import { Warehouse } from "lucide-react";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-card px-5 py-3">
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-primary" />
          <span className="font-semibold">Inventory</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{session?.user.name}</span>
          <SignOutButton />
        </div>
      </header>
      <InventoryNav />
      <main className="flex-1 bg-muted/30 p-4">{children}</main>
    </div>
  );
}
