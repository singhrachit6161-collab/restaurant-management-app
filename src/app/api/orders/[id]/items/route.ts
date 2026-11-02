import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { computeTotals } from "@/lib/pricing";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(["OWNER", "MANAGER", "WAITER", "CASHIER"]);
  if (error) return error;
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (["COMPLETED", "CANCELLED"].includes(order.status)) {
    return NextResponse.json({ error: "Order is already closed" }, { status: 400 });
  }

  const body = await req.json();
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  const menuItemIds = body.items.map((i: { menuItemId: string }) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: session.user.restaurantId },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const newItemsData = body.items.map((i: { menuItemId: string; quantity: number; notes?: string }) => {
    const menuItem = menuItemMap.get(i.menuItemId);
    if (!menuItem) throw new Error("Invalid menu item");
    const qty = Math.max(1, Number(i.quantity) || 1);
    return {
      orderId: id,
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: qty,
      notes: i.notes || null,
    };
  });

  await prisma.orderItem.createMany({ data: newItemsData });

  const allItems = await prisma.orderItem.findMany({ where: { orderId: id, status: { not: "CANCELLED" } } });
  const subtotal = allItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const restaurant = await prisma.restaurant.findUnique({ where: { id: session.user.restaurantId } });
  const { taxAmount, serviceCharge, total } = computeTotals({
    subtotal,
    taxRatePercent: restaurant!.taxRatePercent,
    serviceChargePercent: restaurant!.serviceChargePercent,
    discount: order.discount,
  });

  const updated = await prisma.order.update({
    where: { id },
    data: {
      subtotal,
      taxAmount,
      serviceCharge,
      total,
      status: order.status === "READY" || order.status === "SERVED" ? "PREPARING" : order.status,
    },
    include: { items: true, table: true },
  });

  return NextResponse.json(updated);
}
