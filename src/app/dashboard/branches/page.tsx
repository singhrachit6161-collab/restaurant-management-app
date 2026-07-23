"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Building2, Check, MapPin } from "lucide-react";
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

interface Branch {
  id: string;
  name: string;
  address: string | null;
  taxRatePercent: number;
  serviceChargePercent: number;
}

const emptyForm = { name: "", address: "", gstNumber: "", taxRatePercent: "5", serviceChargePercent: "0" };

export default function BranchesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionData, update } = useSession();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => (await fetch("/api/account/branches")).json(),
  });

  const activeRestaurantId = sessionData?.user?.restaurantId;

  const createBranch = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          taxRatePercent: Number(form.taxRatePercent),
          serviceChargePercent: Number(form.serviceChargePercent),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Branch created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const switchBranch = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await fetch("/api/account/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: targetId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: async (data: { restaurantId: string; name: string }) => {
      await update({ restaurantId: data.restaurantId });
      queryClient.invalidateQueries();
      router.refresh();
      toast.success(`Switched to ${data.name}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branches</h1>
          <p className="text-sm text-muted-foreground">Manage the locations under your account</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Branch
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches?.map((b) => {
          const isActive = b.id === activeRestaurantId;
          return (
            <Card key={b.id} className={isActive ? "border-primary" : undefined}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <p className="font-medium">{b.name}</p>
                  </div>
                  {isActive && (
                    <Badge variant="success" className="gap-1">
                      <Check className="h-3 w-3" /> Active
                    </Badge>
                  )}
                </div>
                {b.address && (
                  <p className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {b.address}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Tax {b.taxRatePercent}% · Service charge {b.serviceChargePercent}%
                </p>
                {!isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={switchBranch.isPending}
                    onClick={() => switchBranch.mutate(b.id)}
                  >
                    Switch to this branch
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {branches?.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No branches yet.</p>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Branch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. The Copper Spoon — Koramangala" />
            </div>
            <div className="space-y-1.5">
              <Label>Address (optional)</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>GST number (optional)</Label>
              <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tax rate %</Label>
                <Input
                  type="number"
                  value={form.taxRatePercent}
                  onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Service charge %</Label>
                <Input
                  type="number"
                  value={form.serviceChargePercent}
                  onChange={(e) => setForm({ ...form, serviceChargePercent: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createBranch.mutate()} disabled={!form.name || createBranch.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
