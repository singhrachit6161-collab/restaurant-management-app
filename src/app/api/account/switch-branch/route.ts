import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.restaurantId) return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });

  const target = await prisma.restaurant.findFirst({
    where: { id: body.restaurantId, accountId: session.user.accountId },
  });
  if (!target) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { restaurantId: target.id },
  });

  return NextResponse.json({ restaurantId: target.id, name: target.name });
}
