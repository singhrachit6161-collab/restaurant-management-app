"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Minus,
  Send,
  CreditCard,
  ArrowRightLeft,
  Bell,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "DISABLED";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
}

interface ActiveOrder {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
  discount: number;
  items: OrderItem[];
}

interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  orders: ActiveOrder[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  isAvailable: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
}

const STATUS_STYLE: Record<TableStatus, string> = {
  AVAILABLE: "bg-emerald-50 border-emerald-300",
  OCCUPIED: "bg-red-50 border-red-300",
  RESERVED: "bg-amber-50 border-amber-300",
  CLEANING: "bg-blue-50 border-blue-300",
  DISABLED: "bg-slate-100 border-slate-300",
};

export default function WaiterPage() {
  const queryClient = useQueryClient();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [pendingCart, setPendingCart] = useState<Record<string, { item: MenuItem; qty: number }>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discount, setDiscount] = useState("0");

  const { data: tables } = useQuery<RestaurantTable[]>({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
    refetchInterval: 6000,
  });

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ["categories"],
    queryFn: async () => (await fetch("/api/menu/categories")).json(),
  });

  const { data: items } = useQuery<MenuItem[]>({
    queryKey: ["items"],
    queryFn: async () => (await fetch("/api/menu/items")).json(),
  });

  const selectedTable = tables?.find((t) => t.id === selectedTableId) ?? null;
  const activeOrder = selectedTable?.orders[0] ?? null;

  const cartLines = Object.values(pendingCart);
  const cartTotal = cartLines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const sendOrder = useMutation({
    mutationFn: async () => {
      if (!selectedTable) return;
      const payloadItems = cartLines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty }));
      if (activeOrder) {
        const res = await fetch(`/api/orders/${activeOrder.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payloadItems }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: selectedTable.id, type: "DINE_IN", items: payloadItems }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setPendingCart({});
      toast.success("Sent to kitchen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      if (!activeOrder) return;
      await fetch(`/api/orders/${activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Order updated");
    },
  });

  const collectPayment = useMutation({
    mutationFn: async () => {
      if (!activeOrder) return;
      await fetch(`/api/orders/${activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: Number(discount), paymentMethod, paymentStatus: "PAID" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setCheckoutOpen(false);
      setSelectedTableId(null);
      toast.success("Payment collected, bill closed");
    },
  });

  const transferTable = useMutation({
    mutationFn: async (newTableId: string) => {
      if (!activeOrder) return;
      await fetch(`/api/orders/${activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: newTableId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setTransferOpen(false);
      setSelectedTableId(null);
      toast.success("Table transferred");
    },
  });

  const itemsByCategory = useMemo(() => {
    if (!categories || !items) return [];
    return categories.map((c) => ({
      category: c,
      items: items.filter((i) => i.categoryId === c.id && i.isAvailable),
    }));
  }, [categories, items]);

  function addToPendingCart(item: MenuItem) {
    setPendingCart((prev) => ({
      ...prev,
      [item.id]: { item, qty: (prev[item.id]?.qty ?? 0) + 1 },
    }));
  }

  function changeQty(itemId: string, delta: number) {
    setPendingCart((prev) => {
      const line = prev[itemId];
      if (!line) return prev;
      const qty = line.qty + delta;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { ...line, qty } };
    });
  }

  if (!selectedTable) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tables?.map((table) => (
          <button key={table.id} onClick={() => setSelectedTableId(table.id)} className="text-left">
            <Card className={cn("border-2 transition-transform hover:scale-[1.02]", STATUS_STYLE[table.status])}>
              <CardContent className="p-4">
                <p className="text-lg font-semibold">{table.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {table.capacity} guests
                </p>
                <Badge variant="secondary" className="mt-2">
                  {table.status}
                </Badge>
                {table.orders[0] && (
                  <p className="mt-2 text-xs font-medium">{formatCurrency(table.orders[0].total)}</p>
                )}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => { setSelectedTableId(null); setPendingCart({}); }}>
          <ArrowLeft className="h-4 w-4" /> All tables
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Chef has been notified")}>
            <Bell className="h-3.5 w-3.5" /> Call Chef
          </Button>
          {activeOrder && activeOrder.status === "READY" && (
            <Button size="sm" onClick={() => updateOrderStatus.mutate({ status: "SERVED" })}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Served
            </Button>
          )}
          {activeOrder && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
              </Button>
              <Button size="sm" onClick={() => setCheckoutOpen(true)}>
                <CreditCard className="h-3.5 w-3.5" /> Payment
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">{selectedTable.name} — Add Items</h2>
          {itemsByCategory.map(({ category, items: catItems }) =>
            catItems.length ? (
              <div key={category.id}>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">{category.name}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {catItems.map((item) => {
                    const qty = pendingCart[item.id]?.qty ?? 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-md border bg-card p-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                        </div>
                        {qty > 0 ? (
                          <div className="flex items-center gap-1">
                            <button className="rounded-full border p-1" onClick={() => changeQty(item.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-4 text-center">{qty}</span>
                            <button className="rounded-full border p-1" onClick={() => changeQty(item.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => addToPendingCart(item)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-2 font-semibold">Current Bill</h3>
              {activeOrder && activeOrder.items.length > 0 ? (
                <div className="space-y-1.5 text-sm">
                  {activeOrder.items.map((i) => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.quantity} × {i.name}</span>
                      <span>{formatCurrency(i.price * i.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(activeOrder.total)}</span>
                  </div>
                  <Badge variant={activeOrder.status === "READY" ? "success" : "secondary"}>
                    {activeOrder.status}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active order yet.</p>
              )}
            </CardContent>
          </Card>

          {cartLines.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold">New Items</h3>
                <div className="space-y-1.5 text-sm">
                  {cartLines.map((l) => (
                    <div key={l.item.id} className="flex justify-between">
                      <span>{l.qty} × {l.item.name}</span>
                      <span>{formatCurrency(l.item.price * l.qty)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
                <Button className="mt-3 w-full" onClick={() => sendOrder.mutate()} disabled={sendOrder.isPending}>
                  <Send className="h-4 w-4" /> Send to Kitchen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Payment — {selectedTable.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Discount</label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Payment method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="WALLET">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => collectPayment.mutate()} disabled={collectPayment.isPending}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer {selectedTable.name} to…</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {tables
              ?.filter((t) => t.id !== selectedTable.id && t.status === "AVAILABLE")
              .map((t) => (
                <Button key={t.id} variant="outline" onClick={() => transferTable.mutate(t.id)}>
                  {t.name}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
