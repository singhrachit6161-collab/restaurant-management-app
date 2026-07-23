"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Building2, Users2, Check, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  pricePerMonth: number;
  maxBranches: number | null;
  maxStaff: number | null;
}

interface Subscription {
  id: string;
  planId: string;
  status: "ACTIVE" | "CANCELLED";
  currentPeriodEnd: string;
  plan: Plan;
}

interface Invoice {
  id: string;
  planName: string;
  amount: number;
  status: "PAID" | "UNPAID";
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

interface BillingData {
  plans: Plan[];
  subscription: Subscription | null;
  branchCount: number;
  staffCount: number;
  invoices: Invoice[];
}

function UsageBar({ label, used, limit, icon: Icon }: { label: string; used: number; limit: number | null; icon: typeof Building2 }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const atLimit = limit != null && used >= limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" /> {label}
        </span>
        <span className="text-muted-foreground">
          {used} / {limit ?? "Unlimited"}
        </span>
      </div>
      {limit != null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", atLimit ? "bg-destructive" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [switchingPlanId, setSwitchingPlanId] = useState<string | null>(null);

  const { data } = useQuery<BillingData>({
    queryKey: ["billing"],
    queryFn: async () => (await fetch("/api/account/billing")).json(),
  });

  const changePlan = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch("/api/account/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (result: { planName: string }) => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      setSwitchingPlanId(null);
      toast.success(`Switched to ${result.planName}`);
    },
    onError: (e: Error) => {
      setSwitchingPlanId(null);
      toast.error(e.message);
    },
  });

  if (!data) return null;
  const { plans, subscription, branchCount, staffCount, invoices } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription plan and usage</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xl font-semibold">{subscription?.plan.name ?? "No plan"}</p>
              <Badge variant={subscription?.status === "ACTIVE" ? "success" : "destructive"}>
                {subscription?.status ?? "NONE"}
              </Badge>
            </div>
            {subscription && (
              <>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(subscription.plan.pricePerMonth)}/month · renews{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Branches" used={branchCount} limit={subscription?.plan.maxBranches ?? null} icon={Building2} />
            <UsageBar label="Staff accounts" used={staffCount} limit={subscription?.plan.maxStaff ?? null} icon={Users2} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Plans</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === subscription?.planId;
            return (
              <Card key={p.id} className={isCurrent ? "border-primary" : undefined}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{p.name}</p>
                    {isCurrent && (
                      <Badge variant="success" className="gap-1">
                        <Check className="h-3 w-3" /> Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(p.pricePerMonth)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>{p.maxBranches ?? "Unlimited"} branch{p.maxBranches === 1 ? "" : "es"}</li>
                    <li>{p.maxStaff ?? "Unlimited"} staff accounts</li>
                  </ul>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={changePlan.isPending && switchingPlanId === p.id}
                      onClick={() => {
                        setSwitchingPlanId(p.id);
                        changePlan.mutate(p.id);
                      }}
                    >
                      Switch to this plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
              <div>
                <p className="font-medium">{inv.planName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(inv.amount)}</p>
                <Badge variant={inv.status === "PAID" ? "success" : "outline"}>{inv.status}</Badge>
              </div>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
