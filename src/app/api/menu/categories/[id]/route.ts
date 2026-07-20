import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.menuCategory.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const category = await prisma.menuCategory.update({
    where: { id },
    data: {
      name: body.name,
      active: body.active,
      sortOrder: body.sortOrder,
    },
  });
  return NextResponse.json(category);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.menuCategory.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const itemCount = await prisma.menuItem.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: "Move or delete items in this category first" },
      { status: 400 }
    );
  }

  await prisma.menuCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
