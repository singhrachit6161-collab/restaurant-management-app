import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateCustomer } from "@/lib/loyalty";

export async function POST(req: Request) {
  const body = await req.json();
  const { restaurantId, customerName, customerPhone, partySize, reservationDate, reservationTime, specialRequest } = body;

  if (!restaurantId || !customerName || !customerPhone || !partySize || !reservationDate || !reservationTime) {
    return NextResponse.json(
      { error: "restaurantId, customerName, customerPhone, partySize, reservationDate and reservationTime are required" },
      { status: 400 }
    );
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const customer = await findOrCreateCustomer(restaurantId, customerPhone, customerName);

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId,
      customerId: customer.id,
      customerName,
      customerPhone,
      partySize: Number(partySize),
      reservationDate: new Date(`${reservationDate}T00:00:00`),
      reservationTime,
      specialRequest: specialRequest || null,
      status: "PENDING",
    },
  });

  return NextResponse.json(
    { id: reservation.id, status: reservation.status, reservationDate: reservation.reservationDate, reservationTime: reservation.reservationTime },
    { status: 201 }
  );
}
