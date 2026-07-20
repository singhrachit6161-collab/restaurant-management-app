import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const table = await prisma.table.findUnique({ where: { code } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: table.restaurantId } });
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: table.restaurantId, active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({
    restaurant: { name: restaurant?.name, currency: restaurant?.currency },
    table: { id: table.id, name: table.name },
    categories,
  });
}
