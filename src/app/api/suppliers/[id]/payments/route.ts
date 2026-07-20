import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier || supplier.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const amount = Number(body.amount);
  if (!amount || amount <= 0 || !body.method) {
    return NextResponse.json({ error: "A positive amount and method are required" }, { status: 400 });
  }

  let invoice = null;
  if (body.invoiceId) {
    invoice = await prisma.supplierInvoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice || invoice.supplierId !== id) {
      return NextResponse.json({ error: "Invalid invoice" }, { status: 400 });
    }
  }

  const payment = await prisma.supplierPayment.create({
    data: {
      restaurantId: session.user.restaurantId,
      supplierId: id,
      invoiceId: body.invoiceId || null,
      amount,
      method: body.method,
      note: body.note || null,
      createdById: session.user.id,
    },
  });

  if (invoice) {
    const newPaid = invoice.amountPaid + amount;
    await prisma.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newPaid,
        status: newPaid >= invoice.amount ? "PAID" : newPaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
      },
    });
  }

  return NextResponse.json(payment, { status: 201 });
}
