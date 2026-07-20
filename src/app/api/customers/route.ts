import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CHECKOUT_ROLES } from "@/lib/crm";
import { findOrCreateCustomer } from "@/lib/loyalty";

export async function GET(req: Request) {
  const { session, error } = await requireSession(CHECKOUT_ROLES);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const customers = await prisma.customer.findMany({
    where: {
      restaurantId: session.user.restaurantId,
      ...(q
        ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(CHECKOUT_ROLES);
  if (error) return error;

  const body = await req.json();
  if (!body.name || !body.phone) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({
    where: { restaurantId_phone: { restaurantId: session.user.restaurantId, phone: body.phone } },
  });
  if (existing) return NextResponse.json({ error: "A customer with this phone number already exists" }, { status: 400 });

  const customer = await findOrCreateCustomer(session.user.restaurantId, body.phone, body.name, body.referralCode);
  return NextResponse.json(customer, { status: 201 });
}
