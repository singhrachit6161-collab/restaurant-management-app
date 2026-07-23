import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { assertCanAddBranch } from "@/lib/billing";

export async function GET() {
  const { session, error } = await requireSession(["OWNER"]);
  if (error) return error;

  const branches = await prisma.restaurant.findMany({
    where: { accountId: session.user.accountId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(branches);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const canAdd = await assertCanAddBranch(session.user.accountId);
  if (!canAdd.ok) return NextResponse.json({ error: canAdd.error }, { status: 403 });

  const branch = await prisma.restaurant.create({
    data: {
      accountId: session.user.accountId,
      name: body.name,
      address: body.address || null,
      gstNumber: body.gstNumber || null,
      taxRatePercent: body.taxRatePercent != null ? Number(body.taxRatePercent) : 5,
      serviceChargePercent: body.serviceChargePercent != null ? Number(body.serviceChargePercent) : 0,
    },
  });
  return NextResponse.json(branch, { status: 201 });
}
