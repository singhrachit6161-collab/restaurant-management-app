import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CRM_ADMIN_ROLES } from "@/lib/crm";
import { findOrCreateCustomer } from "@/lib/loyalty";

export async function GET(req: Request) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  const where: {
    restaurantId: string;
    reservationDate?: { gte: Date; lt: Date };
  } = { restaurantId: session.user.restaurantId };

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.reservationDate = { gte: start, lt: end };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: { table: true, customer: true },
    orderBy: [{ reservationDate: "asc" }, { reservationTime: "asc" }],
  });
  return NextResponse.json(reservations);
}

export async function POST(req: Request) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;

  const body = await req.json();
  const { customerName, customerPhone, partySize, reservationDate, reservationTime, tableId, specialRequest } = body;

  if (!customerName || !customerPhone || !partySize || !reservationDate || !reservationTime) {
    return NextResponse.json(
      { error: "customerName, customerPhone, partySize, reservationDate and reservationTime are required" },
      { status: 400 }
    );
  }

  let customerId: string | null = null;
  const customer = await findOrCreateCustomer(session.user.restaurantId, customerPhone, customerName);
  customerId = customer.id;

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId: session.user.restaurantId,
      customerId,
      customerName,
      customerPhone,
      partySize: Number(partySize),
      reservationDate: new Date(`${reservationDate}T00:00:00`),
      reservationTime,
      tableId: tableId || null,
      specialRequest: specialRequest || null,
      createdById: session.user.id,
      status: "CONFIRMED",
    },
    include: { table: true, customer: true },
  });

  return NextResponse.json(reservation, { status: 201 });
}
