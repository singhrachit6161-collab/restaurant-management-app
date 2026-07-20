"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  dueAmount: number;
}

const emptyForm = {
  id: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstNumber: "",
};

export function SuppliersView({ basePath }: { basePath: string }) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/suppliers")).json(),
  });

  const saveSupplier = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        contactPerson: form.contactPerson || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        gstNumber: form.gstNumber || null,
      };
      const url = form.id ? `/api/suppliers/${form.id}` : "/api/suppliers";
      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Supplier saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(e: React.MouseEvent, supplier: Supplier) {
    e.preventDefault();
    e.stopPropagation();
    setForm({
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: "",
      gstNumber: supplier.gstNumber ?? "",
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Vendors, contact details and outstanding dues</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Supplier
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers?.map((s) => (
          <Link key={s.id} href={`${basePath}/suppliers/${s.id}`}>
            <Card className="transition-transform hover:scale-[1.01]">
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.contactPerson ?? s.phone ?? s.email ?? "No contact on file"}
                  </p>
                  <Badge variant={s.dueAmount > 0 ? "warning" : "success"} className="mt-1.5">
                    Due {formatCurrency(s.dueAmount)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={(e) => openEdit(e, s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteSupplier.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {suppliers?.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No suppliers yet. Add your first vendor.</p>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveSupplier.mutate()} disabled={!form.name || saveSupplier.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
