import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const MANAGE_ROLES = ["OWNER", "MANAGER", "INVENTORY_MANAGER"];
const MANUAL_TYPES = ["PURCHASE", "WASTE", "ADJUSTMENT"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(MANAGE_ROLES);
  if (error) return error;
  const { id } = await params;

  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient || ingredient.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const movements = await prisma.stockMovement.findMany({
    where: { ingredientId: id },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(movements);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(MANAGE_ROLES);
  if (error) return error;
  const { id } = await params;

  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient || ingredient.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!MANUAL_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "type must be PURCHASE, WASTE or ADJUSTMENT" }, { status: 400 });
  }
  const rawQuantity = Number(body.quantity);
  if (!rawQuantity) {
    return NextResponse.json({ error: "quantity is required" }, { status: 400 });
  }

  let delta = rawQuantity;
  if (body.type === "PURCHASE") delta = Math.abs(rawQuantity);
  if (body.type === "WASTE") delta = -Math.abs(rawQuantity);
  // ADJUSTMENT: use the signed value as given

  const newStock = Math.max(0, ingredient.currentStock + delta);

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        ingredientId: id,
        type: body.type,
        quantity: delta,
        note: body.note || null,
        createdById: session.user.id,
      },
    }),
    prisma.ingredient.update({ where: { id }, data: { currentStock: newStock } }),
  ]);

  return NextResponse.json(movement, { status: 201 });
}
