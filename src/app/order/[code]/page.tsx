"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Minus, ShoppingCart, Flame, Star, Clock, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  spicyLevel: "NONE" | "MILD" | "MEDIUM" | "HOT";
  prepTimeMinutes: number;
  calories: number | null;
  isBestseller: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface MenuResponse {
  restaurant: { name: string; currency: string };
  table: { id: string; name: string };
  categories: MenuCategory[];
}

interface CartLine {
  item: MenuItem;
  quantity: number;
  notes: string;
}

export default function OrderMenuPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [notesItem, setNotesItem] = useState<MenuItem | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [placing, setPlacing] = useState(false);

  const { data, isLoading, error } = useQuery<MenuResponse>({
    queryKey: ["public-menu", code],
    queryFn: async () => {
      const res = await fetch(`/api/public/menu/${code}`);
      if (!res.ok) throw new Error("Table not found");
      return res.json();
    },
  });

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    return data.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [data, search]);

  const cartLines = Object.values(cart);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => ({
      ...prev,
      [item.id]: {
        item,
        quantity: (prev[item.id]?.quantity ?? 0) + 1,
        notes: prev[item.id]?.notes ?? "",
      },
    }));
  }

  function changeQty(itemId: string, delta: number) {
    setCart((prev) => {
      const line = prev[itemId];
      if (!line) return prev;
      const qty = line.quantity + delta;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { ...line, quantity: qty } };
    });
  }

  function saveNotes(itemId: string, notes: string) {
    setCart((prev) => (prev[itemId] ? { ...prev, [itemId]: { ...prev[itemId], notes } } : prev));
  }

  async function placeOrder() {
    if (cartLines.length === 0) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode: code,
          customerName: customerName || undefined,
          items: cartLines.map((l) => ({
            menuItemId: l.item.id,
            quantity: l.quantity,
            notes: l.notes || undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to place order");
      const { orderId } = await res.json();
      router.push(`/order/track/${orderId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPlacing(false);
    }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading menu…</div>;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
        This QR code / table link isn&apos;t valid. Please ask a staff member for help.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="sticky top-0 z-10 border-b bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{data.restaurant.name}</p>
            <p className="text-xs text-muted-foreground">Table {data.table.name}</p>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filteredCategories.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                activeCategory === cat.id ? "border-primary bg-primary text-primary-foreground" : "bg-background"
              )}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.name}
            </a>
          ))}
        </div>
      </header>

      <main className="space-y-6 p-4">
        {filteredCategories.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No items match your search.</p>
        )}
        {filteredCategories.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.name}
            </h2>
            <div className="space-y-3">
              {cat.items.map((item) => {
                const inCart = cart[item.id];
                return (
                  <div key={item.id} className="flex gap-3 rounded-xl border bg-card p-3 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <span
                          className={cn(
                            "mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border",
                            item.isVeg ? "border-emerald-600" : "border-red-600"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", item.isVeg ? "bg-emerald-600" : "bg-red-600")} />
                        </span>
                        <p className="font-medium">{item.name}</p>
                      </div>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.isBestseller && (
                          <Badge variant="warning" className="gap-1">
                            <Star className="h-3 w-3" /> Bestseller
                          </Badge>
                        )}
                        {item.spicyLevel !== "NONE" && (
                          <span className="flex items-center gap-0.5">
                            <Flame className="h-3 w-3" /> {item.spicyLevel}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {item.prepTimeMinutes}m
                        </span>
                        {item.calories && <span>{item.calories} kcal</span>}
                      </div>
                      <p className="mt-1.5 font-semibold">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      {inCart ? (
                        <div className="flex items-center gap-2 rounded-full border bg-background px-1.5 py-1">
                          <button
                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent"
                            onClick={() => changeQty(item.id, -1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-4 text-center text-sm font-medium">{inCart.quantity}</span>
                          <button
                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent"
                            onClick={() => changeQty(item.id, 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => addToCart(item)}>
                          Add
                        </Button>
                      )}
                      {inCart && (
                        <button
                          className="mt-2 text-xs text-primary underline underline-offset-2"
                          onClick={() => setNotesItem(item)}
                        >
                          {inCart.notes ? "Edit note" : "Add note"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3 shadow-lg">
          <Button className="w-full justify-between" size="lg" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> {cartCount} item{cartCount > 1 ? "s" : ""}
            </span>
            <span>{formatCurrency(cartTotal)}</span>
          </Button>
        </div>
      )}

      <Dialog open={!!notesItem} onOpenChange={(open) => !open && setNotesItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note for {notesItem?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="e.g. No onion, extra cheese, less spicy"
            defaultValue={notesItem ? cart[notesItem.id]?.notes : ""}
            onChange={(e) => notesItem && saveNotes(notesItem.id, e.target.value)}
          />
          <DialogFooter>
            <Button onClick={() => setNotesItem(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Order — Table {data.table.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {cartLines.map((line) => (
              <div key={line.item.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">
                    {line.quantity} × {line.item.name}
                  </p>
                  {line.notes && <p className="text-xs text-muted-foreground">Note: {line.notes}</p>}
                </div>
                <span className="shrink-0 font-medium">{formatCurrency(line.item.price * line.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Input
              placeholder="Your name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(cartTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Payment: Pay at counter (cash / UPI / card) after your meal.
          </p>
          <DialogFooter>
            <Button className="w-full" size="lg" onClick={placeOrder} disabled={placing}>
              {placing ? "Placing order…" : "Place Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
