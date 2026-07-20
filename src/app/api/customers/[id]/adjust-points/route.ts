import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CRM_ADMIN_ROLES } from "@/lib/crm";
import { computeTier } from "@/lib/loyalty";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer || customer.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const points = Number(body.points);
  if (!points) return NextResponse.json({ error: "A non-zero points value is required" }, { status: 400 });

  const newBalance = Math.max(0, customer.loyaltyPoints + points);
  const newLifetime = points > 0 ? customer.lifetimePoints + points : customer.lifetimePoints;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        customerId: id,
        restaurantId: session.user.restaurantId,
        type: "ADJUSTMENT",
        points,
        note: body.note || null,
      },
    }),
    prisma.customer.update({
      where: { id },
      data: { loyaltyPoints: newBalance, lifetimePoints: newLifetime, membershipTier: computeTier(newLifetime) },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
