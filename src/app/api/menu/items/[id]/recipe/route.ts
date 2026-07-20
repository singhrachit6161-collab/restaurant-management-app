import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER", "INVENTORY_MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const menuItem = await prisma.menuItem.findUnique({ where: { id } });
  if (!menuItem || menuItem.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const recipe = await prisma.recipeIngredient.findMany({
    where: { menuItemId: id },
    include: { ingredient: true },
  });

  const foodCost = recipe.reduce((sum, r) => sum + r.quantity * r.ingredient.costPerUnit, 0);
  const margin = menuItem.price > 0 ? ((menuItem.price - foodCost) / menuItem.price) * 100 : null;

  return NextResponse.json({ recipe, foodCost, margin });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const menuItem = await prisma.menuItem.findUnique({ where: { id } });
  if (!menuItem || menuItem.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const lines: { ingredientId: string; quantity: number }[] = Array.isArray(body.ingredients)
    ? body.ingredients
    : [];

  if (lines.some((l) => !l.ingredientId || !(Number(l.quantity) > 0))) {
    return NextResponse.json({ error: "Each ingredient needs a positive quantity" }, { status: 400 });
  }

  const ingredientIds = lines.map((l) => l.ingredientId);
  const validIngredients = await prisma.ingredient.count({
    where: { id: { in: ingredientIds }, restaurantId: session.user.restaurantId },
  });
  if (validIngredients !== new Set(ingredientIds).size) {
    return NextResponse.json({ error: "One or more ingredients are invalid" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { menuItemId: id } }),
    prisma.recipeIngredient.createMany({
      data: lines.map((l) => ({
        menuItemId: id,
        ingredientId: l.ingredientId,
        quantity: Number(l.quantity),
      })),
    }),
  ]);

  const recipe = await prisma.recipeIngredient.findMany({
    where: { menuItemId: id },
    include: { ingredient: true },
  });
  const foodCost = recipe.reduce((sum, r) => sum + r.quantity * r.ingredient.costPerUnit, 0);
  const margin = menuItem.price > 0 ? ((menuItem.price - foodCost) / menuItem.price) * 100 : null;

  return NextResponse.json({ recipe, foodCost, margin });
}
