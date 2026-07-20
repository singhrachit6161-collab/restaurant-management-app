import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { computeTotals } from "@/lib/pricing";
import { deductStockForOrder } from "@/lib/inventory";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, table: true, invoice: true },
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

  if (body.discount != null) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: existing.restaurantId } });
    const { taxAmount, serviceCharge, total } = computeTotals({
      subtotal: existing.subtotal,
      taxRatePercent: restaurant!.taxRatePercent,
      serviceChargePercent: restaurant!.serviceChargePercent,
      discount: Number(body.discount),
    });
    data.discount = Number(body.discount);
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
    include: { items: true, table: true, invoice: true },
  });
  return NextResponse.json(refreshed);
}
