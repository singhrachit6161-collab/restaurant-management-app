import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { computeTotals } from "@/lib/pricing";

export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const tableId = searchParams.get("tableId");
  const take = searchParams.get("take");

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: session.user.restaurantId,
      status: statusParam ? { in: statusParam.split(",") as never[] } : undefined,
      tableId: tableId ?? undefined,
    },
    include: { items: true, table: true },
    orderBy: { createdAt: "desc" },
    take: take ? Number(take) : 100,
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER", "WAITER", "CASHIER"]);
  if (error) return error;

  const body = await req.json();
  const restaurantId = session.user.restaurantId;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const menuItemIds = body.items.map((i: { menuItemId: string }) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItemsData = body.items.map((i: { menuItemId: string; quantity: number; notes?: string }) => {
    const menuItem = menuItemMap.get(i.menuItemId);
    if (!menuItem) throw new Error("Invalid menu item");
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

  const discount = Number(body.discount) || 0;
  const { taxAmount, serviceCharge, total } = computeTotals({
    subtotal,
    taxRatePercent: restaurant.taxRatePercent,
    serviceChargePercent: restaurant.serviceChargePercent,
    discount,
  });

  const orderCount = await prisma.order.count({ where: { restaurantId } });

  const order = await prisma.order.create({
    data: {
      restaurantId,
      orderNumber: orderCount + 1001,
      tableId: body.tableId || null,
      type: body.type || (body.tableId ? "DINE_IN" : "TAKEAWAY"),
      customerName: body.customerName || null,
      notes: body.notes || null,
      subtotal,
      taxAmount,
      serviceCharge,
      discount,
      total,
      createdById: session.user.id,
      items: { create: orderItemsData },
    },
    include: { items: true, table: true },
  });

  if (body.tableId) {
    await prisma.table.update({ where: { id: body.tableId }, data: { status: "OCCUPIED" } });
  }

  return NextResponse.json(order, { status: 201 });
}
