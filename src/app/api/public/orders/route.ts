import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/pricing";
import { findOrCreateCustomer, previewRedemption, applyRedemption } from "@/lib/loyalty";
import { validateCoupon, recordCouponRedemption } from "@/lib/coupons";

export async function POST(req: Request) {
  const body = await req.json();
  const { tableCode, items, customerName, notes, phone, referralCode, couponCode, redeemPoints } = body;

  if (!tableCode || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Table and items are required" }, { status: 400 });
  }

  const table = await prisma.table.findUnique({ where: { code: tableCode } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: table.restaurantId } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: table.restaurantId, isAvailable: true },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItemsData = items.map((i: { menuItemId: string; quantity: number; notes?: string }) => {
    const menuItem = menuItemMap.get(i.menuItemId);
    if (!menuItem) throw new Error("Invalid or unavailable menu item");
    const qty = Math.max(1, Number(i.quantity) || 1);
    subtotal += menuItem.price * qty;
    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: qty,
      notes: i.notes || null,
    };
  });

  let customerId: string | null = null;
  if (phone && customerName) {
    const customer = await findOrCreateCustomer(table.restaurantId, phone, customerName, referralCode);
    customerId = customer.id;
  }

  let couponId: string | null = null;
  let couponDiscount = 0;
  if (couponCode) {
    const result = await validateCoupon(table.restaurantId, couponCode, subtotal, customerId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    couponId = result.coupon.id;
    couponDiscount = result.discount;
  }

  let pointsToRedeem = 0;
  let pointsDiscount = 0;
  if (customerId && redeemPoints) {
    const preview = await previewRedemption(customerId, table.restaurantId, Number(redeemPoints), subtotal - couponDiscount);
    pointsToRedeem = preview.points;
    pointsDiscount = preview.discount;
  }

  const totalDiscount = Math.round((couponDiscount + pointsDiscount) * 100) / 100;
  const { taxAmount, serviceCharge, total } = computeTotals({
    subtotal,
    taxRatePercent: restaurant.taxRatePercent,
    serviceChargePercent: restaurant.serviceChargePercent,
    discount: totalDiscount,
  });

  const orderCount = await prisma.order.count({ where: { restaurantId: table.restaurantId } });

  const order = await prisma.order.create({
    data: {
      restaurantId: table.restaurantId,
      orderNumber: orderCount + 1001,
      tableId: table.id,
      type: "ONLINE",
      customerName: customerName || null,
      customerId,
      couponId,
      pointsRedeemed: pointsToRedeem,
      notes: notes || null,
      subtotal,
      taxAmount,
      serviceCharge,
      discount: totalDiscount,
      total,
      items: { create: orderItemsData },
    },
    include: { items: true },
  });

  if (couponId) await recordCouponRedemption(couponId, order.id, customerId, couponDiscount);
  if (customerId && pointsToRedeem > 0) await applyRedemption(customerId, table.restaurantId, pointsToRedeem, order.id);

  await prisma.table.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });

  return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber }, { status: 201 });
}
