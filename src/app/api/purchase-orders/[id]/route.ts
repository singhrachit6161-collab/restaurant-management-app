import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { ingredient: true } },
      invoices: { include: { payments: true } },
    },
  });
  if (!po || po.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(po);
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (body.status) {
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot move a ${existing.status} purchase order to ${body.status}` },
        { status: 400 }
      );
    }
  }

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      notes: body.notes !== undefined ? body.notes || null : undefined,
      expectedDate: body.expectedDate !== undefined ? (body.expectedDate ? new Date(body.expectedDate) : null) : undefined,
    },
    include: { supplier: true, items: { include: { ingredient: true } } },
  });
  return NextResponse.json(po);
}
