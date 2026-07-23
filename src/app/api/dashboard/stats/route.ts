import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const allBranches = searchParams.get("scope") === "all" && session.user.role === "OWNER";

  const restaurantWhere = allBranches
    ? { accountId: session.user.accountId }
    : { id: session.user.restaurantId };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayOrders, tables, allTimeItems, ingredients] = await Promise.all([
    prisma.order.findMany({
      where: { restaurant: restaurantWhere, createdAt: { gte: startOfDay } },
      include: { items: true },
    }),
    prisma.table.findMany({ where: { restaurant: restaurantWhere } }),
    prisma.orderItem.findMany({
      where: { order: { restaurant: restaurantWhere, createdAt: { gte: startOfDay }, status: { not: "CANCELLED" } } },
    }),
    prisma.ingredient.findMany({ where: { restaurant: restaurantWhere } }),
  ]);

  const nonCancelled = todayOrders.filter((o) => o.status !== "CANCELLED");
  const revenue = nonCancelled.reduce((sum, o) => sum + o.total, 0);
  const cancelledCount = todayOrders.filter((o) => o.status === "CANCELLED").length;
  const onlineCount = todayOrders.filter((o) => o.type === "ONLINE").length;
  const kitchenPending = todayOrders.filter((o) =>
    ["PENDING", "ACCEPTED", "PREPARING"].includes(o.status)
  ).length;
  const readyCount = todayOrders.filter((o) => o.status === "READY").length;
  const aov = nonCancelled.length ? revenue / nonCancelled.length : 0;

  const occupied = tables.filter((t) => t.status === "OCCUPIED").length;
  const available = tables.filter((t) => t.status === "AVAILABLE").length;

  const itemCounts = new Map<string, number>();
  for (const item of allTimeItems) {
    itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + item.quantity);
  }
  const topItems = [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const hourlyRevenue = new Array(24).fill(0);
  const hourlyOrders = new Array(24).fill(0);
  for (const o of nonCancelled) {
    const hour = new Date(o.createdAt).getHours();
    hourlyRevenue[hour] += o.total;
    hourlyOrders[hour] += 1;
  }
  const revenueGraph = hourlyRevenue
    .map((rev, hour) => ({ hour: `${hour}:00`, revenue: Math.round(rev), orders: hourlyOrders[hour] }))
    .filter((_, hour) => hourlyOrders[hour] > 0 || hour >= new Date().getHours() - 6);

  const peakHourIdx = hourlyOrders.indexOf(Math.max(...hourlyOrders));
  const peakHour = hourlyOrders[peakHourIdx] > 0 ? `${peakHourIdx}:00 - ${peakHourIdx + 1}:00` : "N/A";

  const now = Date.now();
  const EXPIRING_SOON_MS = 3 * 86400000;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let expiringCount = 0;
  for (const ing of ingredients) {
    if (ing.currentStock <= 0) outOfStockCount += 1;
    else if (ing.currentStock <= ing.lowStockThreshold) lowStockCount += 1;
    if (ing.expiryDate && new Date(ing.expiryDate).getTime() - now < EXPIRING_SOON_MS) expiringCount += 1;
  }

  return NextResponse.json({
    scope: allBranches ? "all" : "branch",
    revenue,
    ordersCount: todayOrders.length,
    tablesOccupied: occupied,
    tablesAvailable: available,
    totalTables: tables.length,
    kitchenPending,
    readyCount,
    cancelledCount,
    onlineCount,
    aov,
    topItems,
    peakHour,
    revenueGraph,
    lowStockCount,
    outOfStockCount,
    expiringCount,
  });
}
