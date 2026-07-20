import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function GET() {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;

  const suppliers = await prisma.supplier.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { name: "asc" },
  });

  const [invoices, payments] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { supplierId: true, amount: true },
    }),
    prisma.supplierPayment.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { supplierId: true, amount: true },
    }),
  ]);

  const invoicedMap = new Map<string, number>();
  for (const i of invoices) invoicedMap.set(i.supplierId, (invoicedMap.get(i.supplierId) ?? 0) + i.amount);
  const paidMap = new Map<string, number>();
  for (const p of payments) paidMap.set(p.supplierId, (paidMap.get(p.supplierId) ?? 0) + p.amount);

  const withDue = suppliers.map((s) => ({
    ...s,
    dueAmount: (invoicedMap.get(s.id) ?? 0) - (paidMap.get(s.id) ?? 0),
  }));

  return NextResponse.json(withDue);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: {
      restaurantId: session.user.restaurantId,
      name: body.name,
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      gstNumber: body.gstNumber || null,
    },
  });
  return NextResponse.json(supplier, { status: 201 });
}
