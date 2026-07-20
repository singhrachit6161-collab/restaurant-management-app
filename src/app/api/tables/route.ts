import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { generateTableCode } from "@/lib/utils";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const tables = await prisma.table.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(tables);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  let code = generateTableCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.table.findUnique({ where: { code } });
    if (!clash) break;
    code = generateTableCode();
  }

  const table = await prisma.table.create({
    data: {
      restaurantId: session.user.restaurantId,
      name: body.name,
      capacity: body.capacity ? Number(body.capacity) : 4,
      code,
    },
  });
  return NextResponse.json(table, { status: 201 });
}
