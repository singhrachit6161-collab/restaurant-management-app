"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Minus, Printer, ShoppingBag, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";

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
interface Restaurant {
  name: string;
  address: string | null;
  gstNumber: string | null;
  taxRatePercent: number;
  serviceChargePercent: number;
}
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}
interface OpenOrder {
  id: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discount: number;
  total: number;
  items: OrderItem[];
  table: { name: string } | null;
}

export default function PosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [cart, setCart] = useState<Record<string, { item: MenuItem; qty: number }>>({});
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedOpenOrder, setSelectedOpenOrder] = useState<OpenOrder | null>(null);
  const [receipt, setReceipt] = useState<{ order: OpenOrder; invoiceNumber?: number } | null>(null);

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ["categories"],
    queryFn: async () => (await fetch("/api/menu/categories")).json(),
  });
  const { data: items } = useQuery<MenuItem[]>({
    queryKey: ["items"],
    queryFn: async () => (await fetch("/api/menu/items")).json(),
  });
  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["restaurant"],
    queryFn: async () => (await fetch("/api/restaurant")).json(),
  });
  const { data: openOrders } = useQuery<OpenOrder[]>({
    queryKey: ["open-orders"],
    queryFn: async () => (await fetch("/api/orders?status=PENDING,ACCEPTED,PREPARING,READY,SERVED")).json(),
    refetchInterval: 8000,
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(
      (i) =>
        i.isAvailable &&
        i.name.toLowerCase().includes(search.toLowerCase()) &&
        (activeCategory === "all" || i.categoryId === activeCategory)
    );
  }, [items, search, activeCategory]);

  const cartLines = Object.values(cart);
  const subtotal = cartLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const discountNum = Number(discount) || 0;
  const taxRate = restaurant?.taxRatePercent ?? 0;
  const serviceRate = restaurant?.serviceChargePercent ?? 0;
  const discounted = Math.max(subtotal - discountNum, 0);
  const taxAmount = Math.round(((discounted * taxRate) / 100) * 100) / 100;
  const serviceCharge = Math.round(((discounted * serviceRate) / 100) * 100) / 100;
  const total = Math.round((discounted + taxAmount + serviceCharge) * 100) / 100;

  function addToCart(item: MenuItem) {
    setCart((prev) => ({ ...prev, [item.id]: { item, qty: (prev[item.id]?.qty ?? 0) + 1 } }));
  }
  function changeQty(itemId: string, delta: number) {
    setCart((prev) => {
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

  const checkoutNewSale = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TAKEAWAY",
          items: cartLines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
          discount: discountNum,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const order = await res.json();
      const res2 = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, paymentStatus: "PAID" }),
      });
      if (!res2.ok) throw new Error((await res2.json()).error);
      return res2.json();
    },
    onSuccess: (order) => {
      setCart({});
      setDiscount("0");
      setReceipt({ order, invoiceNumber: order.invoice?.invoiceNumber });
      toast.success("Payment received");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkoutOpenOrder = useMutation({
    mutationFn: async () => {
      if (!selectedOpenOrder) return;
      const res = await fetch(`/api/orders/${selectedOpenOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: discountNum, paymentMethod, paymentStatus: "PAID" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["open-orders"] });
      setSelectedOpenOrder(null);
      setDiscount("0");
      setReceipt({ order, invoiceNumber: order.invoice?.invoiceNumber });
      toast.success("Payment received");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sale">
        <TabsList>
          <TabsTrigger value="sale">
            <ShoppingBag className="h-4 w-4" /> New Sale
          </TabsTrigger>
          <TabsTrigger value="open">
            <Table2 className="h-4 w-4" /> Open Bills ({openOrders?.filter((o) => o.paymentStatus === "UNPAID").length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sale">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search item…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                    activeCategory === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                  )}
                  onClick={() => setActiveCategory("all")}
                >
                  All
                </button>
                {categories?.map((c) => (
                  <button
                    key={c.id}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                      activeCategory === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                    )}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="rounded-lg border bg-card p-3 text-left shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    <p className="text-sm font-medium leading-tight">{item.name}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(item.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            <Card className="h-fit">
              <CardContent className="space-y-3 p-4">
                <h3 className="font-semibold">Cart</h3>
                {cartLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items added</p>
                ) : (
                  <div className="space-y-2">
                    {cartLines.map((l) => (
                      <div key={l.item.id} className="flex items-center justify-between text-sm">
                        <span className="min-w-0 flex-1 truncate">{l.item.name}</span>
                        <div className="flex items-center gap-1">
                          <button className="rounded-full border p-1" onClick={() => changeQty(l.item.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-4 text-center">{l.qty}</span>
                          <button className="rounded-full border p-1" onClick={() => changeQty(l.item.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="w-16 shrink-0 text-right font-medium">{formatCurrency(l.item.price * l.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Discount</label>
                  <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>

                <div className="space-y-1 border-t pt-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Charge ({serviceRate}%)</span>
                    <span>{formatCurrency(serviceCharge)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

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

                <Button
                  className="w-full"
                  size="lg"
                  disabled={cartLines.length === 0 || checkoutNewSale.isPending}
                  onClick={() => checkoutNewSale.mutate()}
                >
                  Charge {formatCurrency(total)}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="open">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openOrders
              ?.filter((o) => o.paymentStatus === "UNPAID")
              .map((order) => (
                <button key={order.id} onClick={() => { setSelectedOpenOrder(order); setDiscount(String(order.discount)); }} className="text-left">
                  <Card className="transition-transform hover:scale-[1.01]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{order.table ? order.table.name : `Order #${order.orderNumber}`}</p>
                        <Badge variant="secondary">{order.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{order.items.length} items</p>
                      <p className="mt-1 font-semibold">{formatCurrency(order.total)}</p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            {openOrders?.filter((o) => o.paymentStatus === "UNPAID").length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">No open bills right now.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedOpenOrder} onOpenChange={(open) => !open && setSelectedOpenOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Checkout — {selectedOpenOrder?.table ? selectedOpenOrder.table.name : `Order #${selectedOpenOrder?.orderNumber}`}
            </DialogTitle>
          </DialogHeader>
          {selectedOpenOrder && (
            <div className="space-y-3">
              <div className="space-y-1 text-sm">
                {selectedOpenOrder.items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>{i.quantity} × {i.name}</span>
                    <span>{formatCurrency(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Discount</label>
                <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
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
              <Button className="w-full" size="lg" onClick={() => checkoutOpenOrder.mutate()} disabled={checkoutOpenOrder.isPending}>
                Confirm Payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receipt && restaurant && (
            <div id="receipt-print" className="space-y-2 font-mono text-sm">
              <div className="text-center">
                <p className="font-semibold">{restaurant.name}</p>
                {restaurant.address && <p className="text-xs">{restaurant.address}</p>}
                {restaurant.gstNumber && <p className="text-xs">GSTIN: {restaurant.gstNumber}</p>}
              </div>
              <div className="border-t border-dashed pt-2 text-xs">
                <p>Invoice #{receipt.invoiceNumber ?? "-"}</p>
                <p>Order #{receipt.order.orderNumber}</p>
                <p>{new Date().toLocaleString()}</p>
              </div>
              <div className="space-y-1 border-t border-dashed pt-2">
                {receipt.order.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-xs">
                    <span>{i.quantity} × {i.name}</span>
                    <span>{formatCurrency(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5 border-t border-dashed pt-2 text-xs">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(receipt.order.subtotal)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(receipt.order.discount)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(receipt.order.taxAmount)}</span></div>
                <div className="flex justify-between"><span>Service Charge</span><span>{formatCurrency(receipt.order.serviceCharge)}</span></div>
                <div className="flex justify-between border-t pt-1 text-sm font-semibold"><span>Total</span><span>{formatCurrency(receipt.order.total)}</span></div>
              </div>
              <p className="border-t border-dashed pt-2 text-center text-xs">Thank you for dining with us!</p>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
