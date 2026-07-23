import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { getAccountUsage } from "@/lib/billing";

export async function GET() {
  const { session, error } = await requireSession(["OWNER"]);
  if (error) return error;

  const [plans, usage, invoices] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    getAccountUsage(session.user.accountId),
    prisma.billingInvoice.findMany({
      where: { accountId: session.user.accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    plans,
    subscription: usage.subscription,
    branchCount: usage.branchCount,
    staffCount: usage.staffCount,
    invoices,
  });
}
