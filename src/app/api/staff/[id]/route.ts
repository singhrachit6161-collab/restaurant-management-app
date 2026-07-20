import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const user = await prisma.user.update({
    where: { id },
    data: {
      active: body.active ?? undefined,
      role: body.role ?? undefined,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user);
}
