"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Star, Gift, PlusCircle, MinusCircle } from "lucide-react";
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
import { cn, formatCurrency } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  anniversary: string | null;
  loyaltyPoints: number;
  lifetimePoints: number;
  membershipTier: string;
  referralCode: string;
  referredByCustomer: { id: string; name: string } | null;
  referrals: { id: string; name: string; createdAt: string }[];
}

interface Order {
  id: string;
  orderNumber: number;
  total: number;
  paymentStatus: string;
  createdAt: string;
  items: { id: string }[];
  table: { name: string } | null;
  restaurant: { name: string };
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  note: string | null;
  createdAt: string;
}

interface CustomerProfile {
  customer: Customer;
  orders: Order[];
  loyaltyTransactions: LoyaltyTransaction[];
  favoriteItems: { name: string; qty: number }[];
  totalSpent: number;
  visitCount: number;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const { data } = useQuery<CustomerProfile>({
    queryKey: ["customer-profile", id],
    queryFn: async () => (await fetch(`/api/customers/${id}`)).json(),
  });

  const adjust = useMutation({
    mutationFn: async (points: number) => {
      const res = await fetch(`/api/customers/${id}/adjust-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, note: adjustNote || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile", id] });
      setAdjustOpen(false);
      setAdjustPoints("");
      setAdjustNote("");
      toast.success("Points adjusted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;
  const { customer, orders, loyaltyTransactions, favoriteItems, totalSpent, visitCount } = data;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers">
        <Button variant="ghost">
          <ArrowLeft className="h-4 w-4" /> All customers
        </Button>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {customer.name} <Badge variant="secondary">{customer.membershipTier}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Referral code: <span className="font-mono">{customer.referralCode}</span>
            {customer.referredByCustomer && ` · Referred by ${customer.referredByCustomer.name}`}
          </p>
        </div>
        <Button onClick={() => setAdjustOpen(true)}>
          <Gift className="h-4 w-4" /> Adjust Points
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Points Balance</p>
            <p className="flex items-center gap-1 text-xl font-semibold">
              <Star className="h-4 w-4" /> {customer.loyaltyPoints}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lifetime Points</p>
            <p className="text-xl font-semibold">{customer.lifetimePoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Visits</p>
            <p className="text-xl font-semibold">{visitCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-xl font-semibold">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Favorite Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {favoriteItems.length > 0 ? (
              favoriteItems.map((item) => (
                <div key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">{item.qty} ordered</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referrals ({customer.referrals.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.referrals.length > 0 ? (
              customer.referrals.map((r) => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Hasn&apos;t referred anyone yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visit History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
              <div>
                <p className="font-medium">Order #{o.orderNumber} {o.table && `· ${o.table.name}`}</p>
                <p className="text-xs text-muted-foreground">
                  {o.restaurant.name} · {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(o.total)}</p>
                <Badge variant={o.paymentStatus === "PAID" ? "success" : "outline"}>{o.paymentStatus}</Badge>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-sm text-muted-foreground">No visits yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loyalty Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loyaltyTransactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
              <div>
                <p className="font-medium">
                  {t.type} {t.note ? `— ${t.note}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
              <span className={cn("flex items-center gap-1 font-medium", t.points < 0 ? "text-red-600" : "text-emerald-600")}>
                {t.points > 0 ? <PlusCircle className="h-3.5 w-3.5" /> : <MinusCircle className="h-3.5 w-3.5" />}
                {Math.abs(t.points)}
              </span>
            </div>
          ))}
          {loyaltyTransactions.length === 0 && <p className="text-sm text-muted-foreground">No loyalty activity yet.</p>}
        </CardContent>
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Points — {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Points (positive to add, negative to deduct)</Label>
              <Input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. Referral bonus, goodwill gesture" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => adjust.mutate(Number(adjustPoints))}
              disabled={!adjustPoints || Number(adjustPoints) === 0 || adjust.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
