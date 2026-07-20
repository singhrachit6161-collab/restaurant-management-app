import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { computeTotals } from "@/lib/pricing";
import { deductStockForOrder } from "@/lib/inventory";
import { findOrCreateCustomer, previewRedemption, applyRedemption, earnPointsForOrder } from "@/lib/loyalty";
import { validateCoupon, recordCouponRedemption } from "@/lib/coupons";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, table: true, invoice: true, customer: true },
  });
  if (!order || order.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(order);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.order.findUnique({ where: { id }, include: { table: true, invoice: true } });
  if (!existing || existing.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.paymentStatus) data.paymentStatus = body.paymentStatus;
  if (body.paymentMethod) data.paymentMethod = body.paymentMethod;
  if (body.tableId !== undefined) data.tableId = body.tableId;

  let customerId = existing.customerId;
  if (body.customerPhone) {
    const customer = await findOrCreateCustomer(
      existing.restaurantId,
      body.customerPhone,
      body.customerName || existing.customerName || "Guest",
      body.referralCode
    );
    customerId = customer.id;
    data.customerId = customerId;
    if (!existing.customerName) data.customerName = customer.name;
  }

  let newCouponId: string | null = null;
  let pointsToRedeem = 0;

  if (body.discount != null || body.couponCode || body.redeemPoints) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: existing.restaurantId } });
    const manualDiscount = body.discount != null ? Number(body.discount) : existing.discount;

    let couponDiscount = 0;
    if (body.couponCode) {
      const result = await validateCoupon(existing.restaurantId, body.couponCode, existing.subtotal, customerId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      newCouponId = result.coupon.id;
      couponDiscount = result.discount;
      data.couponId = newCouponId;
    }

    let pointsDiscount = 0;
    if (body.redeemPoints && customerId) {
      const preview = await previewRedemption(
        customerId,
        existing.restaurantId,
        Number(body.redeemPoints),
        Math.max(0, existing.subtotal - manualDiscount - couponDiscount)
      );
      pointsToRedeem = preview.points;
      pointsDiscount = preview.discount;
      data.pointsRedeemed = existing.pointsRedeemed + pointsToRedeem;
    }

    const totalDiscount = Math.round((manualDiscount + couponDiscount + pointsDiscount) * 100) / 100;
    const { taxAmount, serviceCharge, total } = computeTotals({
      subtotal: existing.subtotal,
      taxRatePercent: restaurant!.taxRatePercent,
      serviceChargePercent: restaurant!.serviceChargePercent,
      discount: totalDiscount,
    });
    data.discount = totalDiscount;
    data.taxAmount = taxAmount;
    data.serviceCharge = serviceCharge;
    data.total = total;
  }

  if (body.tableId && body.tableId !== existing.tableId) {
    const newTable = await prisma.table.findUnique({ where: { id: body.tableId } });
    if (!newTable || newTable.restaurantId !== session.user.restaurantId) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }
    await prisma.table.update({ where: { id: body.tableId }, data: { status: "OCCUPIED" } });
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: { items: true, table: true },
  });

  if (newCouponId) await recordCouponRedemption(newCouponId, order.id, customerId, order.discount);
  if (customerId && pointsToRedeem > 0) await applyRedemption(customerId, existing.restaurantId, pointsToRedeem, order.id);

  if (body.status === "PREPARING") {
    await deductStockForOrder(order.id, order.orderNumber, session.user.id);
  }

  if (body.paymentStatus === "PAID" && !existing.invoice) {
    const invoiceCount = await prisma.invoice.count({ where: { restaurantId: existing.restaurantId } });
    await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceCount + 5001,
        restaurantId: existing.restaurantId,
        orderId: order.id,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        serviceCharge: order.serviceCharge,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.paymentMethod,
      },
    });
    await prisma.order.update({ where: { id }, data: { status: "COMPLETED" } });
    if (customerId) await earnPointsForOrder(order.id, customerId, existing.restaurantId);
  }

  if (["COMPLETED", "CANCELLED"].includes(body.status ?? "") && existing.tableId) {
    const otherActive = await prisma.order.count({
      where: {
        tableId: existing.tableId,
        id: { not: id },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });
    if (otherActive === 0) {
      await prisma.table.update({ where: { id: existing.tableId }, data: { status: "AVAILABLE" } });
    }
  }

  const refreshed = await prisma.order.findUnique({
    where: { id },
    include: { items: true, table: true, invoice: true, customer: true },
  });
  return NextResponse.json(refreshed);
}
