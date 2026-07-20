import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CRM_ADMIN_ROLES } from "@/lib/crm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      active: body.active ?? undefined,
      value: body.value != null ? Number(body.value) : undefined,
      minOrderValue: body.minOrderValue !== undefined ? (body.minOrderValue != null ? Number(body.minOrderValue) : null) : undefined,
      maxDiscount: body.maxDiscount !== undefined ? (body.maxDiscount != null ? Number(body.maxDiscount) : null) : undefined,
      usageLimit: body.usageLimit !== undefined ? (body.usageLimit != null ? Number(body.usageLimit) : null) : undefined,
      validUntil: body.validUntil !== undefined ? (body.validUntil ? new Date(body.validUntil) : null) : undefined,
    },
  });
  return NextResponse.json(coupon);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uses = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (uses > 0) {
    await prisma.coupon.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
