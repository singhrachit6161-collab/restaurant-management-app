import { prisma } from "@/lib/prisma";

export async function deductStockForOrder(orderId: string, orderNumber: number, staffUserId: string | null) {
  const items = await prisma.orderItem.findMany({
    where: { orderId, status: { not: "CANCELLED" }, stockDeducted: false },
  });
  if (items.length === 0) return;

  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  const recipeLines = await prisma.recipeIngredient.findMany({
    where: { menuItemId: { in: menuItemIds } },
  });

  const consumptionByIngredient = new Map<string, number>();
  for (const item of items) {
    for (const line of recipeLines.filter((r) => r.menuItemId === item.menuItemId)) {
      const current = consumptionByIngredient.get(line.ingredientId) ?? 0;
      consumptionByIngredient.set(line.ingredientId, current + line.quantity * item.quantity);
    }
  }

  const operations = [];

  if (consumptionByIngredient.size > 0) {
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: [...consumptionByIngredient.keys()] } },
    });

    for (const ingredient of ingredients) {
      const consumed = consumptionByIngredient.get(ingredient.id) ?? 0;
      if (consumed <= 0) continue;
      const newStock = Math.max(0, ingredient.currentStock - consumed);
      operations.push(
        prisma.stockMovement.create({
          data: {
            ingredientId: ingredient.id,
            type: "CONSUMPTION",
            quantity: -consumed,
            note: `Order #${orderNumber}`,
            createdById: staffUserId,
          },
        }),
        prisma.ingredient.update({ where: { id: ingredient.id }, data: { currentStock: newStock } })
      );
    }
  }

  // Mark every non-cancelled item as processed, even ones with no recipe,
  // so this function stays a no-op the next time it's called for this order.
  operations.push(
    prisma.orderItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { stockDeducted: true },
    })
  );

  await prisma.$transaction(operations);
}
