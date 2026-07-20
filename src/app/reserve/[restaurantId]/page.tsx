"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Clock, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface RestaurantInfo {
  id: string;
  name: string;
  address: string | null;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PublicReservationPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    partySize: "2",
    reservationDate: todayStr(),
    reservationTime: "19:00",
    specialRequest: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ reservationDate: string; reservationTime: string } | null>(null);

  const { data: restaurant, error } = useQuery<RestaurantInfo>({
    queryKey: ["public-restaurant", restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/public/restaurant/${restaurantId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, restaurantId, partySize: Number(form.partySize) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setConfirmed({ reservationDate: json.reservationDate, reservationTime: json.reservationTime });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Restaurant not found.</p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <h1 className="text-xl font-semibold">Request received!</h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ll confirm your table for {form.partySize} at {restaurant?.name} on{" "}
              {new Date(confirmed.reservationDate).toLocaleDateString()} at {confirmed.reservationTime} shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold">{restaurant?.name || "Loading…"}</p>
              <p className="text-xs text-muted-foreground">Book a table</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Your name</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Party size
              </Label>
              <Input
                type="number"
                min={1}
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Time
              </Label>
              <Input
                type="time"
                value={form.reservationTime}
                onChange={(e) => setForm({ ...form, reservationTime: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              min={todayStr()}
              value={form.reservationDate}
              onChange={(e) => setForm({ ...form, reservationDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Special request (optional)</Label>
            <Textarea
              value={form.specialRequest}
              onChange={(e) => setForm({ ...form, specialRequest: e.target.value })}
              placeholder="e.g. Window seat, birthday cake"
            />
          </div>

          <Button
            className="w-full"
            disabled={!form.customerName || !form.customerPhone || submitting}
            onClick={submit}
          >
            {submitting ? "Booking…" : "Request Reservation"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
