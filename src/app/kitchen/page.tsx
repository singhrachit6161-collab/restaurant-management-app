"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Check, X, ChefHat, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
}

interface KitchenOrder {
  id: string;
  orderNumber: number;
  status: string;
  notes: string | null;
  createdAt: string;
  table: { name: string } | null;
  type: string;
  items: OrderItem[];
}

function useElapsedMinutes(createdAt: string) {
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    function tick() {
      setMinutes(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [createdAt]);
  return minutes;
}

function ageColor(minutes: number) {
  if (minutes < 5) return "border-emerald-500";
  if (minutes < 10) return "border-yellow-500";
  if (minutes < 15) return "border-orange-500";
  return "border-red-500 animate-pulse";
}

function OrderCard({ order, onAction }: { order: KitchenOrder; onAction: (id: string, status: string) => void }) {
  const minutes = useElapsedMinutes(order.createdAt);

  return (
    <div className={cn("rounded-lg border-2 bg-slate-900 p-3 shadow-lg", ageColor(minutes))}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{order.table ? `Table ${order.table.name}` : order.type}</p>
          <p className="text-xs text-slate-400">Order #{order.orderNumber}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs">
          <Clock className="h-3 w-3" /> {minutes}m
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm">
            <span className="font-medium">{item.quantity}×</span> {item.name}
            {item.notes && <p className="pl-4 text-xs text-orange-300">Note: {item.notes}</p>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="mt-2 rounded bg-slate-800 p-1.5 text-xs text-orange-300">{order.notes}</p>}

      <div className="mt-3 flex gap-2">
        {order.status === "PENDING" && (
          <>
            <Button size="sm" className="flex-1" onClick={() => onAction(order.id, "PREPARING")}>
              <Check className="h-3.5 w-3.5" /> Accept
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onAction(order.id, "CANCELLED")}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {order.status === "PREPARING" && (
          <Button size="sm" className="flex-1" onClick={() => onAction(order.id, "READY")}>
            Mark Ready
          </Button>
        )}
        {order.status === "READY" && (
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => onAction(order.id, "SERVED")}>
            Mark Served
          </Button>
        )}
      </div>
    </div>
  );
}

const COLUMNS = [
  { status: "PENDING", label: "New Orders" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY", label: "Ready" },
  { status: "SERVED", label: "Served" },
  { status: "CANCELLED", label: "Cancelled" },
];

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const knownPendingIds = useRef<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(false);

  const { data: orders } = useQuery<KitchenOrder[]>({
    queryKey: ["kitchen-orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders?status=PENDING,PREPARING,READY,SERVED,CANCELLED&take=60");
      return res.json();
    },
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!orders || !soundEnabled) return;
    const currentPending = orders.filter((o) => o.status === "PENDING").map((o) => o.id);
    const isNew = currentPending.some((id) => !knownPendingIds.current.has(id));
    if (isNew && knownPendingIds.current.size > 0) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 880;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          ctx.close();
        }, 200);
      } catch {
        // ignore audio errors
      }
    }
    knownPendingIds.current = new Set(currentPending);
  }, [orders, soundEnabled]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <ChefHat className="h-4 w-4" /> Auto-refreshing every few seconds
        </p>
        <Button variant="outline" size="sm" onClick={() => setSoundEnabled((s) => !s)}>
          <Bell className="h-3.5 w-3.5" /> {soundEnabled ? "Sound On" : "Enable Sound"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const columnOrders = (orders ?? []).filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="flex min-h-40 flex-col gap-3">
              <div className="flex items-center justify-between rounded-md bg-slate-800 px-3 py-2">
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="rounded-full bg-slate-700 px-2 text-xs">{columnOrders.length}</span>
              </div>
              {columnOrders.map((order) => (
                <OrderCard key={order.id} order={order} onAction={(id, status) => updateStatus.mutate({ id, status })} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
