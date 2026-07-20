import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const MANAGE_ROLES = ["OWNER", "MANAGER", "INVENTORY_MANAGER"];

export async function GET() {
  const { session, error } = await requireSession(MANAGE_ROLES);
  if (error) return error;

  const ingredients = await prisma.ingredient.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(ingredients);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(MANAGE_ROLES);
  if (error) return error;

  const body = await req.json();
  if (!body.name || !body.unit || body.costPerUnit == null) {
    return NextResponse.json({ error: "name, unit and costPerUnit are required" }, { status: 400 });
  }

  const initialStock = Number(body.currentStock) || 0;

  const ingredient = await prisma.ingredient.create({
    data: {
      restaurantId: session.user.restaurantId,
      name: body.name,
      unit: body.unit,
      costPerUnit: Number(body.costPerUnit),
      currentStock: initialStock,
      lowStockThreshold: body.lowStockThreshold != null ? Number(body.lowStockThreshold) : 0,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      supplierName: body.supplierName || null,
    },
  });

  if (initialStock > 0) {
    await prisma.stockMovement.create({
      data: {
        ingredientId: ingredient.id,
        type: "ADJUSTMENT",
        quantity: initialStock,
        note: "Initial stock",
        createdById: session.user.id,
      },
    });
  }

  return NextResponse.json(ingredient, { status: 201 });
}
