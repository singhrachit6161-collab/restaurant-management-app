import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const items = await prisma.menuItem.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: { category: true },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.name || !body.categoryId || body.price == null) {
    return NextResponse.json({ error: "name, categoryId and price are required" }, { status: 400 });
  }

  const category = await prisma.menuCategory.findUnique({ where: { id: body.categoryId } });
  if (!category || category.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: {
      restaurantId: session.user.restaurantId,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || null,
      price: Number(body.price),
      imageUrl: body.imageUrl || null,
      isVeg: body.isVeg ?? true,
      spicyLevel: body.spicyLevel ?? "NONE",
      prepTimeMinutes: body.prepTimeMinutes ? Number(body.prepTimeMinutes) : 10,
      calories: body.calories ? Number(body.calories) : null,
      isBestseller: body.isBestseller ?? false,
      isAvailable: body.isAvailable ?? true,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
