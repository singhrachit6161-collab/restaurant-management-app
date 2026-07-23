import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CHECKOUT_ROLES } from "@/lib/crm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CHECKOUT_ROLES);
  if (error) return error;
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      referredByCustomer: { select: { id: true, name: true } },
      referrals: { select: { id: true, name: true, createdAt: true } },
    },
  });
  if (!customer || customer.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [orders, loyaltyTransactions] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id, status: { not: "CANCELLED" } },
      include: { items: true, table: true, restaurant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.loyaltyTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const itemCounts = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + item.quantity);
    }
  }
  const favoriteItems = [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const totalSpent = orders.filter((o) => o.paymentStatus === "PAID").reduce((sum, o) => sum + o.total, 0);

  return NextResponse.json({
    customer,
    orders,
    loyaltyTransactions,
    favoriteItems,
    totalSpent,
    visitCount: orders.length,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CHECKOUT_ROLES);
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing || existing.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      email: body.email !== undefined ? body.email || null : undefined,
      birthday: body.birthday !== undefined ? (body.birthday ? new Date(body.birthday) : null) : undefined,
      anniversary: body.anniversary !== undefined ? (body.anniversary ? new Date(body.anniversary) : null) : undefined,
    },
  });
  return NextResponse.json(customer);
}
