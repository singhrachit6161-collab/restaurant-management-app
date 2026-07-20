"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Flame, Leaf, Star, Clock, X, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatCurrency, cn } from "@/lib/utils";

interface MenuCategory {
  id: string;
  name: string;
  active: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  category: MenuCategory;
  isVeg: boolean;
  spicyLevel: "NONE" | "MILD" | "MEDIUM" | "HOT";
  prepTimeMinutes: number;
  calories: number | null;
  isBestseller: boolean;
  isAvailable: boolean;
  foodCost: number | null;
  margin: number | null;
}

type SpicyLevel = "NONE" | "MILD" | "MEDIUM" | "HOT";

interface ItemForm {
  id: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isVeg: boolean;
  spicyLevel: SpicyLevel;
  prepTimeMinutes: string;
  calories: string;
  isBestseller: boolean;
  isAvailable: boolean;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

interface RecipeLine {
  ingredientId: string;
  quantity: string;
}

interface RecipeResponse {
  recipe: { ingredientId: string; quantity: number }[];
  foodCost: number;
  margin: number | null;
}

const emptyItemForm: ItemForm = {
  id: "",
  name: "",
  description: "",
  price: "",
  categoryId: "",
  isVeg: true,
  spicyLevel: "NONE",
  prepTimeMinutes: "10",
  calories: "",
  isBestseller: false,
  isAvailable: true,
};

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [form, setForm] = useState(emptyItemForm);

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ["categories"],
    queryFn: async () => (await fetch("/api/menu/categories")).json(),
  });

  const { data: items } = useQuery<MenuItem[]>({
    queryKey: ["items"],
    queryFn: async () => (await fetch("/api/menu/items")).json(),
  });

  const { data: ingredients } = useQuery<Ingredient[]>({
    queryKey: ["ingredients"],
    queryFn: async () => (await fetch("/api/inventory/ingredients")).json(),
  });

  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);
  const [recipeInitializedId, setRecipeInitializedId] = useState<string | null>(null);

  const { data: recipeData } = useQuery<RecipeResponse>({
    queryKey: ["item-recipe", form.id],
    queryFn: async () => (await fetch(`/api/menu/items/${form.id}/recipe`)).json(),
    enabled: itemDialogOpen && !!form.id,
  });

  if (recipeData && form.id && recipeInitializedId !== form.id) {
    setRecipeLines(recipeData.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: String(r.quantity) })));
    setRecipeInitializedId(form.id);
  } else if (!form.id && recipeInitializedId !== null) {
    setRecipeLines([]);
    setRecipeInitializedId(null);
  }

  const ingredientMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);

  const livePreview = useMemo(() => {
    const cost = recipeLines.reduce((sum, line) => {
      const ing = ingredientMap.get(line.ingredientId);
      const qty = Number(line.quantity) || 0;
      return sum + (ing ? ing.costPerUnit * qty : 0);
    }, 0);
    const price = Number(form.price) || 0;
    const margin = price > 0 ? ((price - cost) / price) * 100 : null;
    return { cost, margin };
  }, [recipeLines, ingredientMap, form.price]);

  const saveRecipe = useMutation({
    mutationFn: async () => {
      const lines = recipeLines.filter((l) => l.ingredientId && Number(l.quantity) > 0);
      const res = await fetch(`/api/menu/items/${form.id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: lines.map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-recipe", form.id] });
      toast.success("Recipe saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    if (!items || !categories) return [];
    return categories.map((cat) => ({
      category: cat,
      items: items.filter((i) => i.categoryId === cat.id),
    }));
  }, [items, categories]);

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      toast.success("Category added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        categoryId: form.categoryId,
        isVeg: form.isVeg,
        spicyLevel: form.spicyLevel,
        prepTimeMinutes: Number(form.prepTimeMinutes) || 10,
        calories: form.calories ? Number(form.calories) : null,
        isBestseller: form.isBestseller,
        isAvailable: form.isAvailable,
      };
      const url = form.id ? `/api/menu/items/${form.id}` : "/api/menu/items";
      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setItemDialogOpen(false);
      setForm(emptyItemForm);
      toast.success("Menu item saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      await fetch(`/api/menu/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/menu/items/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item removed");
    },
  });

  function openEdit(item: MenuItem) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      categoryId: item.categoryId,
      isVeg: item.isVeg,
      spicyLevel: item.spicyLevel,
      prepTimeMinutes: String(item.prepTimeMinutes),
      calories: item.calories ? String(item.calories) : "",
      isBestseller: item.isBestseller,
      isAvailable: item.isAvailable,
    });
    setItemDialogOpen(true);
  }

  function openNew() {
    setForm({ ...emptyItemForm, categoryId: categories?.[0]?.id ?? "" });
    setItemDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menu Management</h1>
          <p className="text-sm text-muted-foreground">Manage categories and menu items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Category
          </Button>
          <Button onClick={openNew} disabled={!categories?.length}>
            <Plus className="h-4 w-4" /> Menu Item
          </Button>
        </div>
      </div>

      {grouped.map(({ category, items: catItems }) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle className="text-base">{category.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {catItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items in this category yet.</p>
            ) : (
              <div className="divide-y">
                {catItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 items-center justify-center border",
                            item.isVeg ? "border-emerald-600" : "border-red-600"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              item.isVeg ? "bg-emerald-600" : "bg-red-600"
                            )}
                          />
                        </span>
                        <p className="font-medium">{item.name}</p>
                        {item.isBestseller && (
                          <Badge variant="warning" className="gap-1">
                            <Star className="h-3 w-3" /> Bestseller
                          </Badge>
                        )}
                        {!item.isAvailable && <Badge variant="destructive">Unavailable</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatCurrency(item.price)}</span>
                        {item.spicyLevel !== "NONE" && (
                          <span className="flex items-center gap-0.5">
                            <Flame className="h-3 w-3" /> {item.spicyLevel}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {item.prepTimeMinutes}m
                        </span>
                        {item.calories && <span>{item.calories} kcal</span>}
                        {item.foodCost != null && (
                          <span>
                            Food cost {formatCurrency(item.foodCost)}
                            {item.margin != null && ` · ${item.margin.toFixed(0)}% margin`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.isAvailable}
                        onCheckedChange={(checked) => toggleAvailability.mutate({ id: item.id, isAvailable: checked })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {!categories?.length && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Start by adding a menu category (e.g. Starters, Main Course).
          </CardContent>
        </Card>
      )}

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cat-name">Category name</Label>
            <Input id="cat-name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              onClick={() => createCategory.mutate(newCategoryName)}
              disabled={!newCategoryName.trim() || createCategory.isPending}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prep time (min)</Label>
                <Input
                  type="number"
                  value={form.prepTimeMinutes}
                  onChange={(e) => setForm({ ...form, prepTimeMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Calories</Label>
                <Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Spicy level</Label>
              <Select
                value={form.spicyLevel}
                onValueChange={(v) => setForm({ ...form, spicyLevel: v as typeof form.spicyLevel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Not spicy</SelectItem>
                  <SelectItem value="MILD">Mild</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HOT">Hot</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isVeg} onCheckedChange={(v) => setForm({ ...form, isVeg: v })} />
                <Leaf className="h-4 w-4 text-emerald-600" /> Vegetarian
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isBestseller} onCheckedChange={(v) => setForm({ ...form, isBestseller: v })} />
                <Star className="h-4 w-4 text-amber-500" /> Bestseller
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isAvailable} onCheckedChange={(v) => setForm({ ...form, isAvailable: v })} />
                Available
              </label>
            </div>

            {form.id && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <ChefHat className="h-4 w-4" /> Recipe & Food Cost
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecipeLines([...recipeLines, { ingredientId: "", quantity: "" }])}
                    disabled={!ingredients?.length}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ingredient
                  </Button>
                </div>

                {!ingredients?.length && (
                  <p className="text-xs text-muted-foreground">
                    Add ingredients under Inventory before building a recipe.
                  </p>
                )}

                {recipeLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={line.ingredientId}
                      onValueChange={(v) => {
                        const next = [...recipeLines];
                        next[idx] = { ...next[idx], ingredientId: v };
                        setRecipeLines(next);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients?.map((ing) => (
                          <SelectItem key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit.toLowerCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-24"
                      type="number"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...recipeLines];
                        next[idx] = { ...next[idx], quantity: e.target.value };
                        setRecipeLines(next);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRecipeLines(recipeLines.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">
                    Food cost: <span className="font-medium text-foreground">{formatCurrency(livePreview.cost)}</span>
                    {livePreview.margin != null && (
                      <>
                        {" "}
                        · Margin: <span className="font-medium text-foreground">{livePreview.margin.toFixed(0)}%</span>
                      </>
                    )}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => saveRecipe.mutate()} disabled={saveRecipe.isPending}>
                    Save Recipe
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveItem.mutate()}
              disabled={!form.name || !form.categoryId || !form.price || saveItem.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
