import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER", "WAITER", "CASHIER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.table.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const isBasicFieldEdit = body.name !== undefined || body.capacity !== undefined;
  if (isBasicFieldEdit && !["OWNER", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const table = await prisma.table.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      capacity: body.capacity != null ? Number(body.capacity) : undefined,
      status: body.status ?? undefined,
    },
  });
  return NextResponse.json(table);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.table.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.table.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
