import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const staff = await prisma.user.findMany({
    where: { restaurantId: session.user.restaurantId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(staff);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const body = await req.json();
  if (!body.name || !body.email || !body.role || !body.password) {
    return NextResponse.json({ error: "name, email, role and password are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash,
      restaurantId: session.user.restaurantId,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
