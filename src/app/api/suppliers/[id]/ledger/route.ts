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

  const [invoices, payments] = await Promise.all([
    prisma.supplierInvoice.findMany({ where: { supplierId: id }, orderBy: { createdAt: "asc" } }),
    prisma.supplierPayment.findMany({
      where: { supplierId: id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const dueAmount = totalInvoiced - totalPaid;

  const entries = [
    ...invoices.map((i) => ({
      kind: "INVOICE" as const,
      id: i.id,
      date: i.createdAt,
      label: `Invoice #${i.invoiceNumber}`,
      amount: i.amount,
      status: i.status,
    })),
    ...payments.map((p) => ({
      kind: "PAYMENT" as const,
      id: p.id,
      date: p.paidAt,
      label: `Payment (${p.method})${p.note ? ` — ${p.note}` : ""}`,
      amount: -p.amount,
      createdBy: p.createdBy?.name ?? null,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const ledger = entries.map((e) => {
    running += e.amount;
    return { ...e, balance: running };
  });

  return NextResponse.json({ supplier, totalInvoiced, totalPaid, dueAmount, ledger });
}
