import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const MANAGE_ROLES = ["OWNER", "MANAGER", "INVENTORY_MANAGER"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(MANAGE_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const ingredient = await prisma.ingredient.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      costPerUnit: body.costPerUnit != null ? Number(body.costPerUnit) : undefined,
      lowStockThreshold: body.lowStockThreshold != null ? Number(body.lowStockThreshold) : undefined,
      expiryDate: body.expiryDate !== undefined ? (body.expiryDate ? new Date(body.expiryDate) : null) : undefined,
      supplierName: body.supplierName !== undefined ? body.supplierName || null : undefined,
    },
  });
  return NextResponse.json(ingredient);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(MANAGE_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const recipeUseCount = await prisma.recipeIngredient.count({ where: { ingredientId: id } });
  if (recipeUseCount > 0) {
    return NextResponse.json(
      { error: "This ingredient is used in one or more recipes. Remove it from those recipes first." },
      { status: 400 }
    );
  }

  await prisma.stockMovement.deleteMany({ where: { ingredientId: id } });
  await prisma.ingredient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
