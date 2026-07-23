import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CHECKOUT_ROLES } from "@/lib/crm";

export async function GET(req: Request) {
  const { session, error } = await requireSession(CHECKOUT_ROLES);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });

  const customer = await prisma.customer.findUnique({
    where: { accountId_phone: { accountId: session.user.accountId, phone } },
  });

  if (!customer) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, customer });
}
