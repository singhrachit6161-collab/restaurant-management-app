"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Clock, Soup, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

interface TrackedOrder {
  orderNumber: number;
  status: string;
  tableName?: string;
  items: { name: string; quantity: number; notes: string | null }[];
  total: number;
  createdAt: string;
}

const STEPS = [
  { key: "PENDING", label: "Order Placed", icon: Clock },
  { key: "ACCEPTED", label: "Accepted", icon: CheckCircle2 },
  { key: "PREPARING", label: "Preparing", icon: ChefHat },
  { key: "READY", label: "Ready", icon: Soup },
  { key: "SERVED", label: "Served", icon: Truck },
];

export default function TrackOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);

  const { data } = useQuery<TrackedOrder>({
    queryKey: ["track-order", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/public/orders/${orderId}`);
      if (!res.ok) throw new Error("Order not found");
      return res.json();
    },
    refetchInterval: 4000,
  });

  const stepIndex = data ? STEPS.findIndex((s) => s.key === data.status) : -1;
  const cancelled = data?.status === "CANCELLED";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {!data ? (
            <p className="text-center text-sm text-muted-foreground">Loading order…</p>
          ) : (
            <>
              <div className="mb-4 text-center">
                <p className="text-sm text-muted-foreground">Order #{data.orderNumber}</p>
                <h1 className="text-xl font-semibold">Table {data.tableName}</h1>
              </div>

              {cancelled ? (
                <p className="rounded-md bg-red-50 p-3 text-center text-sm font-medium text-red-700">
                  This order was cancelled.
                </p>
              ) : (
                <div className="mb-6 space-y-4">
                  {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const reached = idx <= stepIndex;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={cn("text-sm", reached ? "font-medium" : "text-muted-foreground")}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5 border-t pt-4 text-sm">
                {data.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t pt-3 text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(data.total)}</span>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Please pay at the counter when your meal is served.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
