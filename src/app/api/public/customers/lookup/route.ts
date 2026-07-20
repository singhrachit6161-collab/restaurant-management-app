import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tableCode = searchParams.get("tableCode");
  const phone = searchParams.get("phone");
  if (!tableCode || !phone) {
    return NextResponse.json({ error: "tableCode and phone are required" }, { status: 400 });
  }

  const table = await prisma.table.findUnique({ where: { code: tableCode } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const customer = await prisma.customer.findUnique({
    where: { restaurantId_phone: { restaurantId: table.restaurantId, phone } },
  });

  if (!customer) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    name: customer.name,
    loyaltyPoints: customer.loyaltyPoints,
    membershipTier: customer.membershipTier,
  });
}
