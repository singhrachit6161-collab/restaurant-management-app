"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Plus, QrCode, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, formatCurrency } from "@/lib/utils";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "DISABLED";

interface OrderSummary {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  items: { id: string }[];
}

interface RestaurantTable {
  id: string;
  name: string;
  code: string;
  capacity: number;
  status: TableStatus;
  orders: OrderSummary[];
}

const STATUS_STYLE: Record<TableStatus, string> = {
  AVAILABLE: "bg-emerald-50 border-emerald-300 text-emerald-800",
  OCCUPIED: "bg-red-50 border-red-300 text-red-800",
  RESERVED: "bg-amber-50 border-amber-300 text-amber-800",
  CLEANING: "bg-blue-50 border-blue-300 text-blue-800",
  DISABLED: "bg-slate-100 border-slate-300 text-slate-500",
};

export default function TablesPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const { data: tables } = useQuery<RestaurantTable[]>({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
    refetchInterval: 8000,
  });

  const createTable = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, capacity: Number(capacity) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setAddOpen(false);
      setName("");
      toast.success("Table added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TableStatus }) => {
      await fetch(`/api/tables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/tables/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Table removed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Table Management</h1>
          <p className="text-sm text-muted-foreground">Floor map, status and QR codes for ordering</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Table
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "DISABLED"] as TableStatus[]).map((s) => (
          <span key={s} className={cn("rounded-full border px-2.5 py-1 font-medium", STATUS_STYLE[s])}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tables?.map((table) => {
          const activeOrder = table.orders[0];
          return (
            <Card key={table.id} className={cn("border-2", STATUS_STYLE[table.status])}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold">{table.name}</p>
                    <p className="flex items-center gap-1 text-xs opacity-80">
                      <Users className="h-3 w-3" /> {table.capacity} guests
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setQrTable(table)}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                </div>

                {activeOrder && (
                  <p className="mt-2 text-xs opacity-80">
                    Bill: {formatCurrency(activeOrder.total)} · {activeOrder.items.length} items
                  </p>
                )}

                <div className="mt-3">
                  <Select
                    value={table.status}
                    onValueChange={(v) => updateStatus.mutate({ id: table.id, status: v as TableStatus })}
                  >
                    <SelectTrigger className="h-8 bg-background text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">Available</SelectItem>
                      <SelectItem value="OCCUPIED">Occupied</SelectItem>
                      <SelectItem value="RESERVED">Reserved</SelectItem>
                      <SelectItem value="CLEANING">Cleaning</SelectItem>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs opacity-70"
                  onClick={() => deleteTable.mutate(table.id)}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Table</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Table name / number</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="T7" />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createTable.mutate()} disabled={!name.trim() || createTable.isPending}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrTable} onOpenChange={(open) => !open && setQrTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{qrTable?.name} — QR Code</DialogTitle>
          </DialogHeader>
          {qrTable && origin && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="rounded-lg border bg-white p-4">
                <QRCodeSVG value={`${origin}/order/${qrTable.code}`} size={200} />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground">
                {origin}/order/{qrTable.code}
              </p>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
