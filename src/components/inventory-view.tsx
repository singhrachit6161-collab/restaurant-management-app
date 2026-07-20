"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  PackagePlus,
  Trash,
  History,
  AlertTriangle,
  PackageX,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { cn, formatCurrency } from "@/lib/utils";

type IngredientUnit = "G" | "KG" | "ML" | "L" | "PCS";

interface Ingredient {
  id: string;
  name: string;
  unit: IngredientUnit;
  costPerUnit: number;
  currentStock: number;
  lowStockThreshold: number;
  expiryDate: string | null;
  supplierName: string | null;
}

interface Movement {
  id: string;
  type: "PURCHASE" | "CONSUMPTION" | "WASTE" | "ADJUSTMENT";
  quantity: number;
  note: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
}

const emptyForm = {
  id: "",
  name: "",
  unit: "G" as IngredientUnit,
  costPerUnit: "",
  currentStock: "",
  lowStockThreshold: "",
  expiryDate: "",
  supplierName: "",
};

const EXPIRING_SOON_DAYS = 3;

function ingredientStatus(ingredient: Ingredient) {
  const now = Date.now();
  const expiry = ingredient.expiryDate ? new Date(ingredient.expiryDate).getTime() : null;
  if (expiry && expiry < now) return { label: "Expired", variant: "destructive" as const };
  if (ingredient.currentStock <= 0) return { label: "Out of stock", variant: "destructive" as const };
  if (ingredient.currentStock <= ingredient.lowStockThreshold)
    return { label: "Low stock", variant: "warning" as const };
  if (expiry && expiry - now < EXPIRING_SOON_DAYS * 86400000)
    return { label: "Expiring soon", variant: "warning" as const };
  return { label: "OK", variant: "success" as const };
}

export function InventoryView() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [movementDialog, setMovementDialog] = useState<{ ingredient: Ingredient; type: "PURCHASE" | "WASTE" } | null>(
    null
  );
  const [movementQty, setMovementQty] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [historyIngredient, setHistoryIngredient] = useState<Ingredient | null>(null);

  const { data: ingredients } = useQuery<Ingredient[]>({
    queryKey: ["ingredients"],
    queryFn: async () => (await fetch("/api/inventory/ingredients")).json(),
    refetchInterval: 15000,
  });

  const { data: movements } = useQuery<Movement[]>({
    queryKey: ["ingredient-movements", historyIngredient?.id],
    queryFn: async () => (await fetch(`/api/inventory/ingredients/${historyIngredient!.id}/movements`)).json(),
    enabled: !!historyIngredient,
  });

  const stats = useMemo(() => {
    if (!ingredients) return { low: 0, out: 0, expiring: 0 };
    let low = 0;
    let out = 0;
    let expiring = 0;
    for (const ing of ingredients) {
      const status = ingredientStatus(ing);
      if (status.label === "Out of stock") out += 1;
      else if (status.label === "Low stock") low += 1;
      if (status.label === "Expiring soon" || status.label === "Expired") expiring += 1;
    }
    return { low, out, expiring };
  }, [ingredients]);

  const saveIngredient = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        unit: form.unit,
        costPerUnit: Number(form.costPerUnit),
        currentStock: form.currentStock ? Number(form.currentStock) : 0,
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : 0,
        expiryDate: form.expiryDate || null,
        supplierName: form.supplierName || null,
      };
      const url = form.id ? `/api/inventory/ingredients/${form.id}` : "/api/inventory/ingredients";
      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Ingredient saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteIngredient = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/ingredients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingredient removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordMovement = useMutation({
    mutationFn: async () => {
      if (!movementDialog) return;
      const res = await fetch(`/api/inventory/ingredients/${movementDialog.ingredient.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: movementDialog.type, quantity: Number(movementQty), note: movementNote || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      setMovementDialog(null);
      setMovementQty("");
      setMovementNote("");
      toast.success("Stock updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(ingredient: Ingredient) {
    setForm({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      costPerUnit: String(ingredient.costPerUnit),
      currentStock: "",
      lowStockThreshold: String(ingredient.lowStockThreshold),
      expiryDate: ingredient.expiryDate ? ingredient.expiryDate.slice(0, 10) : "",
      supplierName: ingredient.supplierName ?? "",
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Raw materials, stock levels and purchases</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Ingredient
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Low Stock" value={stats.low} icon={AlertTriangle} accent="warning" />
        <StatCard label="Out of Stock" value={stats.out} icon={PackageX} accent="destructive" />
        <StatCard label="Expiring / Expired" value={stats.expiring} icon={CalendarClock} accent="warning" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingredient</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Cost/Unit</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients?.map((ingredient) => {
                const status = ingredientStatus(ingredient);
                return (
                  <TableRow key={ingredient.id}>
                    <TableCell className="font-medium">{ingredient.name}</TableCell>
                    <TableCell>
                      {ingredient.currentStock} {ingredient.unit.toLowerCase()}
                    </TableCell>
                    <TableCell>{formatCurrency(ingredient.costPerUnit)}</TableCell>
                    <TableCell className="text-muted-foreground">{ingredient.supplierName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ingredient.expiryDate ? new Date(ingredient.expiryDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Record purchase"
                          onClick={() => setMovementDialog({ ingredient, type: "PURCHASE" })}
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Log waste"
                          onClick={() => setMovementDialog({ ingredient, type: "WASTE" })}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="History" onClick={() => setHistoryIngredient(ingredient)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(ingredient)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteIngredient.mutate(ingredient.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {ingredients?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No ingredients yet. Add your first raw material to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Ingredient" : "Add Ingredient"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setForm({ ...form, unit: v as IngredientUnit })}
                  disabled={!!form.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="G">Grams (g)</SelectItem>
                    <SelectItem value="KG">Kilograms (kg)</SelectItem>
                    <SelectItem value="ML">Millilitres (ml)</SelectItem>
                    <SelectItem value="L">Litres (l)</SelectItem>
                    <SelectItem value="PCS">Pieces (pcs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cost per unit</Label>
                <Input
                  type="number"
                  value={form.costPerUnit}
                  onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{form.id ? "Adjust stock via Purchase/Waste actions" : "Initial stock"}</Label>
                <Input
                  type="number"
                  disabled={!!form.id}
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Low stock threshold</Label>
                <Input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Input
                value={form.supplierName}
                onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveIngredient.mutate()}
              disabled={!form.name || !form.costPerUnit || saveIngredient.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementDialog} onOpenChange={(open) => !open && setMovementDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movementDialog?.type === "PURCHASE" ? "Record Purchase" : "Log Waste"} — {movementDialog?.ingredient.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Quantity ({movementDialog?.ingredient.unit.toLowerCase()})</Label>
              <Input type="number" value={movementQty} onChange={(e) => setMovementQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={movementNote} onChange={(e) => setMovementNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => recordMovement.mutate()} disabled={!movementQty || recordMovement.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyIngredient} onOpenChange={(open) => !open && setHistoryIngredient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock History — {historyIngredient?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {movements?.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <div>
                  <p className="font-medium">
                    {m.type} {m.note ? `— ${m.note}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()} {m.createdBy ? `· ${m.createdBy.name}` : ""}
                  </p>
                </div>
                <span className={cn("font-medium", m.quantity < 0 ? "text-red-600" : "text-emerald-600")}>
                  {m.quantity > 0 ? "+" : ""}
                  {m.quantity}
                </span>
              </div>
            ))}
            {movements?.length === 0 && <p className="text-sm text-muted-foreground">No movements yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
