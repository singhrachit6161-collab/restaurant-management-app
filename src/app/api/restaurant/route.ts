import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const restaurant = await prisma.restaurant.findUnique({ where: { id: session.user.restaurantId } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: restaurant.name,
    address: restaurant.address,
    gstNumber: restaurant.gstNumber,
    currency: restaurant.currency,
    taxRatePercent: restaurant.taxRatePercent,
    serviceChargePercent: restaurant.serviceChargePercent,
  });
}
