import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CRM_ADMIN_ROLES } from "@/lib/crm";

export async function GET() {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;

  const coupons = await prisma.coupon.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(coupons);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;

  const body = await req.json();
  if (!body.code || !body.type || body.value == null) {
    return NextResponse.json({ error: "code, type and value are required" }, { status: 400 });
  }

  const code = String(body.code).toUpperCase();
  const existing = await prisma.coupon.findUnique({
    where: { restaurantId_code: { restaurantId: session.user.restaurantId, code } },
  });
  if (existing) return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 400 });

  const coupon = await prisma.coupon.create({
    data: {
      restaurantId: session.user.restaurantId,
      code,
      type: body.type,
      value: Number(body.value),
      minOrderValue: body.minOrderValue != null ? Number(body.minOrderValue) : null,
      maxDiscount: body.maxDiscount != null ? Number(body.maxDiscount) : null,
      usageLimit: body.usageLimit != null ? Number(body.usageLimit) : null,
      usageLimitPerCustomer: body.usageLimitPerCustomer != null ? Number(body.usageLimitPerCustomer) : null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    },
  });
  return NextResponse.json(coupon, { status: 201 });
}
