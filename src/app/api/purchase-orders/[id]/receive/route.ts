import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { PURCHASING_ROLES } from "@/lib/purchasing";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(PURCHASING_ROLES);
  if (error) return error;
  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { include: { ingredient: true } } },
  });
  if (!po || po.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (["RECEIVED", "CANCELLED"].includes(po.status)) {
    return NextResponse.json({ error: `Cannot receive against a ${po.status} purchase order` }, { status: 400 });
  }

  const body = await req.json();
  const lines: { purchaseOrderItemId: string; quantityReceived: number; unitCost?: number }[] = Array.isArray(
    body.items
  )
    ? body.items
    : [];

  const poItemMap = new Map(po.items.map((i) => [i.id, i]));
  const operations = [];
  let receivedValue = 0;
  let anyReceived = false;

  for (const line of lines) {
    const qty = Number(line.quantityReceived);
    if (!qty || qty <= 0) continue;
    const poItem = poItemMap.get(line.purchaseOrderItemId);
    if (!poItem) return NextResponse.json({ error: "Invalid purchase order item" }, { status: 400 });

    const unitCost = line.unitCost != null ? Number(line.unitCost) : poItem.unitCost;
    anyReceived = true;
    receivedValue += qty * unitCost;

    operations.push(
      prisma.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { quantityReceived: poItem.quantityReceived + qty },
      }),
      prisma.stockMovement.create({
        data: {
          ingredientId: poItem.ingredientId,
          type: "PURCHASE",
          quantity: qty,
          note: `PO #${po.poNumber}`,
          purchaseOrderId: po.id,
          createdById: session.user.id,
        },
      }),
      prisma.ingredient.update({
        where: { id: poItem.ingredientId },
        data: {
          currentStock: poItem.ingredient.currentStock + qty,
          costPerUnit: unitCost,
        },
      })
    );
  }

  if (!anyReceived) {
    return NextResponse.json({ error: "No quantities to receive" }, { status: 400 });
  }

  await prisma.$transaction(operations);

  const refreshedItems = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
  const fullyReceived = refreshedItems.every((i) => i.quantityReceived >= i.quantityOrdered);
  const newStatus = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus } });

  let invoice = null;
  if (body.invoiceNumber) {
    invoice = await prisma.supplierInvoice.create({
      data: {
        restaurantId: session.user.restaurantId,
        invoiceNumber: String(body.invoiceNumber),
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        amount: body.invoiceAmount != null ? Number(body.invoiceAmount) : Math.round(receivedValue * 100) / 100,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
  }

  const refreshed = await prisma.purchaseOrder.findUnique({
    where: { id: po.id },
    include: { supplier: true, items: { include: { ingredient: true } }, invoices: true },
  });

  return NextResponse.json({ purchaseOrder: refreshed, invoice });
}
