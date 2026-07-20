"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Star, ChevronRight } from "lucide-react";
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

interface Customer {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  membershipTier: string;
}

const TIER_VARIANT: Record<string, "default" | "secondary" | "success" | "warning"> = {
  NONE: "secondary",
  SILVER: "default",
  GOLD: "warning",
  PLATINUM: "success",
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", referralCode: "" });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers", search],
    queryFn: async () => (await fetch(`/api/customers?q=${encodeURIComponent(search)}`)).json(),
  });

  const createCustomer = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setFormOpen(false);
      setForm({ name: "", phone: "", referralCode: "" });
      toast.success("Customer added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">CRM, loyalty points and membership</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {customers?.map((c) => (
          <Link key={c.id} href={`/dashboard/customers/${c.id}`}>
            <Card className="transition-transform hover:scale-[1.01]">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                  <Badge variant={TIER_VARIANT[c.membershipTier]} className="mt-1.5">
                    {c.membershipTier}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    <Star className="h-3.5 w-3.5" /> {c.loyaltyPoints}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {customers?.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No customers yet.</p>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Referral code (optional)</Label>
              <Input
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createCustomer.mutate()} disabled={!form.name || !form.phone || createCustomer.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
