"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Clock, Users, Phone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  status: "PENDING" | "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  specialRequest: string | null;
  table: Table | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  CONFIRMED: "default",
  SEATED: "success",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

const emptyForm = {
  customerName: "",
  customerPhone: "",
  partySize: "2",
  reservationTime: "19:00",
  specialRequest: "",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [tableDialogFor, setTableDialogFor] = useState<Reservation | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string>("");

  const { data: reservations } = useQuery<Reservation[]>({
    queryKey: ["reservations", date],
    queryFn: async () => (await fetch(`/api/reservations?date=${date}`)).json(),
    refetchInterval: 15000,
  });

  const { data: tables } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
  });

  const createReservation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, partySize: Number(form.partySize), reservationDate: date }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Reservation created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateReservation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; tableId?: string }) => {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const isToday = date === todayStr();

  function isOverdue(r: Reservation) {
    if (r.status !== "PENDING" || !isToday) return false;
    const [h, m] = r.reservationTime.split(":").map(Number);
    const resTime = new Date();
    resTime.setHours(h, m, 0, 0);
    return now.getTime() - resTime.getTime() > 15 * 60 * 1000;
  }

  function openSeat(r: Reservation) {
    setTableDialogFor(r);
    setSelectedTableId(r.table?.id || "");
  }

  const availableTables = tables?.filter((t) => t.status === "AVAILABLE" || t.id === tableDialogFor?.table?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reservations</h1>
          <p className="text-sm text-muted-foreground">Manage table bookings for the day</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Reservation
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {reservations?.map((r) => (
          <Card key={r.id} className={cn(isOverdue(r) && "border-destructive")}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    <Clock className="h-3.5 w-3.5" /> {r.reservationTime}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {r.customerName}
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    {isOverdue(r) && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Overdue
                      </Badge>
                    )}
                  </p>
                  <p className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.customerPhone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {r.partySize}
                    </span>
                    {r.table && <span>Table {r.table.name}</span>}
                    {r.specialRequest && <span>· {r.specialRequest}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {r.status === "PENDING" && (
                  <>
                    <Button size="sm" onClick={() => updateReservation.mutate({ id: r.id, status: "CONFIRMED" })}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateReservation.mutate({ id: r.id, status: "NO_SHOW" })}
                    >
                      No-show
                    </Button>
                  </>
                )}
                {r.status === "CONFIRMED" && (
                  <>
                    <Button size="sm" onClick={() => openSeat(r)}>
                      Seat
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateReservation.mutate({ id: r.id, status: "NO_SHOW" })}
                    >
                      No-show
                    </Button>
                  </>
                )}
                {r.status === "SEATED" && (
                  <Button size="sm" onClick={() => updateReservation.mutate({ id: r.id, status: "COMPLETED" })}>
                    Complete
                  </Button>
                )}
                {["PENDING", "CONFIRMED"].includes(r.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => updateReservation.mutate({ id: r.id, status: "CANCELLED" })}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {reservations?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No reservations for this date.</p>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reservation — {date}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Customer name</Label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Party size</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={form.reservationTime}
                  onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Special request (optional)</Label>
              <Textarea
                value={form.specialRequest}
                onChange={(e) => setForm({ ...form, specialRequest: e.target.value })}
                placeholder="e.g. Window seat, birthday cake"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createReservation.mutate()}
              disabled={!form.customerName || !form.customerPhone || createReservation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tableDialogFor} onOpenChange={(open) => !open && setTableDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat {tableDialogFor?.customerName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Assign table</Label>
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {availableTables?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} (seats {t.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              disabled={!selectedTableId || updateReservation.isPending}
              onClick={() => {
                if (!tableDialogFor) return;
                updateReservation.mutate(
                  { id: tableDialogFor.id, tableId: selectedTableId, status: "SEATED" },
                  { onSuccess: () => setTableDialogFor(null) }
                );
              }}
            >
              Confirm Seating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
