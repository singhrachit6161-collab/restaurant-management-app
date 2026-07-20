"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
}

interface LedgerEntry {
  kind: "INVOICE" | "PAYMENT";
  id: string;
  date: string;
  label: string;
  amount: number;
  balance: number;
  status?: string;
  createdBy?: string | null;
}

interface LedgerResponse {
  supplier: Supplier;
  totalInvoiced: number;
  totalPaid: number;
  dueAmount: number;
  ledger: LedgerEntry[];
}

interface UnpaidInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  status: string;
}

export function SupplierDetailView({
  params,
  basePath,
}: {
  params: Promise<{ id: string }>;
  basePath: string;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: "", amount: "", dueDate: "" });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ invoiceId: "", amount: "", method: "BANK_TRANSFER", note: "" });

  const { data } = useQuery<LedgerResponse>({
    queryKey: ["supplier-ledger", id],
    queryFn: async () => (await fetch(`/api/suppliers/${id}/ledger`)).json(),
    refetchInterval: 10000,
  });

  const { data: invoices } = useQuery<UnpaidInvoice[]>({
    queryKey: ["supplier-invoices", id],
    queryFn: async () => (await fetch(`/api/suppliers/${id}/invoices`)).json(),
  });

  const addInvoice = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoiceForm.invoiceNumber,
          amount: Number(invoiceForm.amount),
          dueDate: invoiceForm.dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setInvoiceOpen(false);
      setInvoiceForm({ invoiceNumber: "", amount: "", dueDate: "" });
      toast.success("Invoice recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: paymentForm.invoiceId || undefined,
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          note: paymentForm.note || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setPaymentOpen(false);
      setPaymentForm({ invoiceId: "", amount: "", method: "BANK_TRANSFER", note: "" });
      toast.success("Payment recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpaidInvoices = invoices?.filter((i) => i.status !== "PAID") ?? [];

  return (
    <div className="space-y-6">
      <Link href={`${basePath}/suppliers`}>
        <Button variant="ghost">
          <ArrowLeft className="h-4 w-4" /> All suppliers
        </Button>
      </Link>

      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{data.supplier.name}</h1>
              <p className="text-sm text-muted-foreground">
                {data.supplier.contactPerson}
                {data.supplier.phone ? ` · ${data.supplier.phone}` : ""}
                {data.supplier.email ? ` · ${data.supplier.email}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
                <Plus className="h-4 w-4" /> Invoice
              </Button>
              <Button onClick={() => setPaymentOpen(true)}>
                <Wallet className="h-4 w-4" /> Record Payment
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Invoiced</p>
                <p className="text-xl font-semibold">{formatCurrency(data.totalInvoiced)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-xl font-semibold">{formatCurrency(data.totalPaid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Amount Due</p>
                <p className={cn("text-xl font-semibold", data.dueAmount > 0 && "text-amber-600")}>
                  {formatCurrency(data.dueAmount)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ledger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.ledger.map((entry) => (
                <div key={`${entry.kind}-${entry.id}`} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <div>
                    <p className="font-medium">
                      {entry.label}
                      {entry.status && (
                        <Badge variant={entry.status === "PAID" ? "success" : "secondary"} className="ml-2">
                          {entry.status}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()} {entry.createdBy ? `· ${entry.createdBy}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-medium", entry.amount < 0 ? "text-emerald-600" : "text-foreground")}>
                      {entry.amount < 0 ? "-" : "+"}
                      {formatCurrency(Math.abs(entry.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">Balance {formatCurrency(entry.balance)}</p>
                  </div>
                </div>
              ))}
              {data.ledger.length === 0 && (
                <p className="text-sm text-muted-foreground">No invoices or payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Supplier Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Invoice number</Label>
              <Input
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addInvoice.mutate()}
              disabled={!invoiceForm.invoiceNumber || !invoiceForm.amount || addInvoice.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Apply to invoice (optional)</Label>
              <Select
                value={paymentForm.invoiceId || "none"}
                onValueChange={(v) => setPaymentForm({ ...paymentForm, invoiceId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General payment (not tied to an invoice)</SelectItem>
                  {unpaidInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} — due {formatCurrency(inv.amount - inv.amountPaid)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addPayment.mutate()} disabled={!paymentForm.amount || addPayment.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
