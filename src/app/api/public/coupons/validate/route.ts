import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCoupon } from "@/lib/coupons";

export async function POST(req: Request) {
  const body = await req.json();
  const { tableCode, code, subtotal, phone } = body;
  if (!tableCode || !code || subtotal == null) {
    return NextResponse.json({ error: "tableCode, code and subtotal are required" }, { status: 400 });
  }

  const table = await prisma.table.findUnique({ where: { code: tableCode } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  let customerId: string | undefined;
  if (phone) {
    const customer = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId: table.restaurantId, phone } },
    });
    customerId = customer?.id;
  }

  const result = await validateCoupon(table.restaurantId, code, Number(subtotal), customerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ discount: result.discount });
}
