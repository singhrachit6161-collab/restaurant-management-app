import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      price: body.price != null ? Number(body.price) : undefined,
      imageUrl: body.imageUrl ?? undefined,
      isVeg: body.isVeg ?? undefined,
      spicyLevel: body.spicyLevel ?? undefined,
      prepTimeMinutes: body.prepTimeMinutes != null ? Number(body.prepTimeMinutes) : undefined,
      calories: body.calories != null ? Number(body.calories) : undefined,
      isBestseller: body.isBestseller ?? undefined,
      isAvailable: body.isAvailable ?? undefined,
      categoryId: body.categoryId ?? undefined,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.menuItem.delete({ where: { id } }).catch(() =>
    prisma.menuItem.update({ where: { id }, data: { isAvailable: false } })
  );
  return NextResponse.json({ ok: true });
}
