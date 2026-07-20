"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, PackageCheck, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface POItem {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  ingredient: Ingredient;
}

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: number;
  status: "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  notes: string | null;
  supplier: { id: string; name: string };
  items: POItem[];
  invoices: SupplierInvoice[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "warning",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

export function PurchaseOrderDetailView({
  params,
  basePath,
}: {
  params: Promise<{ id: string }>;
  basePath: string;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");

  const { data: po } = useQuery<PurchaseOrder>({
    queryKey: ["purchase-order", id],
    queryFn: async () => (await fetch(`/api/purchase-orders/${id}`)).json(),
    refetchInterval: 8000,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receiveGoods = useMutation({
    mutationFn: async () => {
      const items = Object.entries(receiveQty)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([purchaseOrderItemId, qty]) => ({ purchaseOrderItemId, quantityReceived: Number(qty) }));
      const res = await fetch(`/api/purchase-orders/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          invoiceNumber: invoiceNumber || undefined,
          invoiceAmount: invoiceAmount ? Number(invoiceAmount) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      setReceiveOpen(false);
      setReceiveQty({});
      setInvoiceNumber("");
      setInvoiceAmount("");
      toast.success("Goods received");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openReceive() {
    if (!po) return;
    const defaults: Record<string, string> = {};
    for (const item of po.items) {
      const remaining = item.quantityOrdered - item.quantityReceived;
      if (remaining > 0) defaults[item.id] = String(remaining);
    }
    setReceiveQty(defaults);
    setReceiveOpen(true);
  }

  if (!po) return null;

  const canReceive = ["SENT", "PARTIALLY_RECEIVED", "DRAFT"].includes(po.status);

  return (
    <div className="space-y-6">
      <Link href={`${basePath}/purchase-orders`}>
        <Button variant="ghost">
          <ArrowLeft className="h-4 w-4" /> All purchase orders
        </Button>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            PO #{po.poNumber} <Badge variant={STATUS_VARIANT[po.status]}>{po.status.replace("_", " ")}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{po.supplier.name}</p>
          {po.notes && <p className="mt-1 text-sm text-muted-foreground">{po.notes}</p>}
        </div>
        <div className="flex gap-2">
          {po.status === "DRAFT" && <Button onClick={() => updateStatus.mutate("SENT")}><Send className="h-4 w-4" /> Send</Button>}
          {["DRAFT", "SENT"].includes(po.status) && (
            <Button variant="outline" onClick={() => updateStatus.mutate("CANCELLED")}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
          {canReceive && (
            <Button onClick={openReceive}>
              <PackageCheck className="h-4 w-4" /> Receive Goods
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.ingredient.name}</TableCell>
                  <TableCell>
                    {item.quantityOrdered} {item.ingredient.unit.toLowerCase()}
                  </TableCell>
                  <TableCell>
                    {item.quantityReceived} {item.ingredient.unit.toLowerCase()}
                  </TableCell>
                  <TableCell>{formatCurrency(item.unitCost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.quantityOrdered * item.unitCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {po.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {po.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <span>Invoice #{inv.invoiceNumber}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(inv.amount)}</span>
                  <Badge variant={inv.status === "PAID" ? "success" : "secondary"}>{inv.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Goods — PO #{po.poNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {po.items
              .filter((item) => item.quantityOrdered - item.quantityReceived > 0)
              .map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {item.ingredient.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      (remaining {item.quantityOrdered - item.quantityReceived} {item.ingredient.unit.toLowerCase()})
                    </span>
                  </span>
                  <Input
                    className="w-24"
                    type="number"
                    value={receiveQty[item.id] ?? ""}
                    onChange={(e) => setReceiveQty({ ...receiveQty, [item.id]: e.target.value })}
                  />
                </div>
              ))}
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label>Supplier invoice # (optional)</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice amount</Label>
                <Input
                  type="number"
                  placeholder="Auto from received qty"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => receiveGoods.mutate()} disabled={receiveGoods.isPending}>
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
