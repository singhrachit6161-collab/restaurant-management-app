import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier || supplier.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(supplier);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      contactPerson: body.contactPerson !== undefined ? body.contactPerson || null : undefined,
      phone: body.phone !== undefined ? body.phone || null : undefined,
      email: body.email !== undefined ? body.email || null : undefined,
      address: body.address !== undefined ? body.address || null : undefined,
      gstNumber: body.gstNumber !== undefined ? body.gstNumber || null : undefined,
    },
  });
  return NextResponse.json(supplier);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [ingredientCount, poCount] = await Promise.all([
    prisma.ingredient.count({ where: { supplierId: id } }),
    prisma.purchaseOrder.count({ where: { supplierId: id } }),
  ]);
  if (ingredientCount > 0 || poCount > 0) {
    return NextResponse.json(
      { error: "This supplier has linked ingredients or purchase orders and can't be deleted." },
      { status: 400 }
    );
  }

  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
