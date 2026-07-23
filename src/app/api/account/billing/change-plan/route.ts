import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });

  const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const subscription = await prisma.subscription.upsert({
    where: { accountId: session.user.accountId },
    update: { planId: plan.id, status: "ACTIVE", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    create: {
      accountId: session.user.accountId,
      planId: plan.id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  await prisma.billingInvoice.create({
    data: {
      accountId: session.user.accountId,
      subscriptionId: subscription.id,
      planName: plan.name,
      amount: plan.pricePerMonth,
      status: "PAID",
      periodStart,
      periodEnd,
    },
  });

  return NextResponse.json({ ok: true, planName: plan.name });
}
