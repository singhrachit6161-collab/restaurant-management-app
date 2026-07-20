import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function GET(req: Request) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      restaurantId: session.user.restaurantId,
      status: statusParam ? { in: statusParam.split(",") as never[] } : undefined,
    },
    include: { supplier: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(purchaseOrders);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;

  const body = await req.json();
  const restaurantId = session.user.restaurantId;

  if (!body.supplierId || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "supplierId and items are required" }, { status: 400 });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: body.supplierId } });
  if (!supplier || supplier.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Invalid supplier" }, { status: 400 });
  }

  const ingredientIds = body.items.map((i: { ingredientId: string }) => i.ingredientId);
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds }, restaurantId },
  });
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  const itemsData = body.items.map((i: { ingredientId: string; quantityOrdered: number; unitCost: number }) => {
    if (!ingredientMap.has(i.ingredientId)) throw new Error("Invalid ingredient");
    return {
      ingredientId: i.ingredientId,
      quantityOrdered: Number(i.quantityOrdered),
      unitCost: Number(i.unitCost),
    };
  });

  const poCount = await prisma.purchaseOrder.count({ where: { restaurantId } });

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      restaurantId,
      poNumber: poCount + 7001,
      supplierId: body.supplierId,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      notes: body.notes || null,
      createdById: session.user.id,
      items: { create: itemsData },
    },
    include: { supplier: true, items: true },
  });

  return NextResponse.json(purchaseOrder, { status: 201 });
}
