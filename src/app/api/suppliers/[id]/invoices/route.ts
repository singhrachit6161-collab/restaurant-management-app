import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier || supplier.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const invoices = await prisma.supplierInvoice.findMany({
    where: { supplierId: id },
    include: { purchaseOrder: { select: { poNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier || supplier.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  if (!body.invoiceNumber || body.amount == null) {
    return NextResponse.json({ error: "invoiceNumber and amount are required" }, { status: 400 });
  }

  const invoice = await prisma.supplierInvoice.create({
    data: {
      restaurantId: session.user.restaurantId,
      supplierId: id,
      invoiceNumber: String(body.invoiceNumber),
      amount: Number(body.amount),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
  });
  return NextResponse.json(invoice, { status: 201 });
}
