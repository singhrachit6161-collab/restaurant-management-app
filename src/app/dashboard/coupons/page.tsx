"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface Coupon {
  id: string;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  minOrderValue: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  active: boolean;
  validUntil: string | null;
  _count: { redemptions: number };
}

const emptyForm = {
  code: "",
  type: "PERCENT" as "PERCENT" | "FLAT",
  value: "",
  minOrderValue: "",
  maxDiscount: "",
  usageLimit: "",
  validUntil: "",
};

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: coupons } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: async () => (await fetch("/api/coupons")).json(),
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: Number(form.value),
          minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
          maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
          validUntil: form.validUntil || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Coupon created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await fetch(`/api/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/coupons/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Coupon removed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coupons & Offers</h1>
          <p className="text-sm text-muted-foreground">Discount codes redeemable at checkout or QR ordering</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Coupon
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons?.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-mono font-semibold">
                  <Tag className="h-4 w-4" /> {c.code}
                </p>
                <Switch checked={c.active} onCheckedChange={(active) => toggleActive.mutate({ id: c.id, active })} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.type === "PERCENT" ? `${c.value}% off` : `${formatCurrency(c.value)} off`}
                {c.maxDiscount ? ` (max ${formatCurrency(c.maxDiscount)})` : ""}
              </p>
              {c.minOrderValue && <p className="text-xs text-muted-foreground">Min order {formatCurrency(c.minOrderValue)}</p>}
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="secondary">
                  {c._count.redemptions} used{c.usageLimit ? ` / ${c.usageLimit}` : ""}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => deleteCoupon.mutate(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {coupons?.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No coupons yet.</p>}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Coupon</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "PERCENT" | "FLAT" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage</SelectItem>
                    <SelectItem value="FLAT">Flat amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Value {form.type === "PERCENT" ? "(%)" : ""}</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Max discount (optional)</Label>
                <Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min order value (optional)</Label>
                <Input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Usage limit (optional)</Label>
                <Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Valid until (optional)</Label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createCoupon.mutate()} disabled={!form.code || !form.value || createCoupon.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
