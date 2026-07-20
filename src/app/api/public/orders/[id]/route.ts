import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, table: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    tableName: order.table?.name,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, notes: i.notes })),
    total: order.total,
    createdAt: order.createdAt,
  });
}
