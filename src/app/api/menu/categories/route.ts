import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const count = await prisma.menuCategory.count({ where: { restaurantId: session.user.restaurantId } });

  const category = await prisma.menuCategory.create({
    data: {
      name: body.name,
      restaurantId: session.user.restaurantId,
      sortOrder: count,
    },
  });
  return NextResponse.json(category, { status: 201 });
}
