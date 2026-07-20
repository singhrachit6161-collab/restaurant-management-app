"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Minus, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

interface POItem {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: number;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  orderDate: string;
  supplier: Supplier;
  items: POItem[];
}

interface Line {
  ingredientId: string;
  quantityOrdered: string;
  unitCost: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "warning",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

export function PurchaseOrdersView({ basePath }: { basePath: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ingredientId: "", quantityOrdered: "", unitCost: "" }]);

  const { data: purchaseOrders } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders"],
    queryFn: async () => (await fetch("/api/purchase-orders")).json(),
    refetchInterval: 10000,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/suppliers")).json(),
  });

  const { data: ingredients } = useQuery<Ingredient[]>({
    queryKey: ["ingredients"],
    queryFn: async () => (await fetch("/api/inventory/ingredients")).json(),
  });

  const createPO = useMutation({
    mutationFn: async () => {
      const items = lines
        .filter((l) => l.ingredientId && Number(l.quantityOrdered) > 0)
        .map((l) => ({
          ingredientId: l.ingredientId,
          quantityOrdered: Number(l.quantityOrdered),
          unitCost: Number(l.unitCost) || 0,
        }));
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, notes: notes || undefined, items }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setCreateOpen(false);
      setSupplierId("");
      setNotes("");
      setLines([{ ingredientId: "", quantityOrdered: "", unitCost: "" }]);
      toast.success("Purchase order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function lineTotal(po: PurchaseOrder) {
    return po.items.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">Order raw materials from suppliers and track receipts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!suppliers?.length || !ingredients?.length}>
          <Plus className="h-4 w-4" /> Purchase Order
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {purchaseOrders?.map((po) => (
          <Link key={po.id} href={`${basePath}/purchase-orders/${po.id}`}>
            <Card className="transition-transform hover:scale-[1.01]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">PO #{po.poNumber}</p>
                  <Badge variant={STATUS_VARIANT[po.status]}>{po.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{po.supplier.name}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{po.items.length} items</span>
                  <span className="font-medium">{formatCurrency(lineTotal(po))}</span>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {purchaseOrders?.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            No purchase orders yet. {!suppliers?.length && "Add a supplier first."}
          </p>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLines([...lines, { ingredientId: "", quantityOrdered: "", unitCost: "" }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Line
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={line.ingredientId} onValueChange={(v) => updateLine(idx, { ingredientId: v })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients?.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit.toLowerCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-20"
                    type="number"
                    placeholder="Qty"
                    value={line.quantityOrdered}
                    onChange={(e) => updateLine(idx, { quantityOrdered: e.target.value })}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                    {lines.length > 1 ? <X className="h-4 w-4" /> : <Minus className="h-4 w-4 opacity-30" />}
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createPO.mutate()}
              disabled={!supplierId || !lines.some((l) => l.ingredientId && l.quantityOrdered) || createPO.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
