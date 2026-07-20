import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { CRM_ADMIN_ROLES } from "@/lib/crm";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;
  const { id } = await params;

  const reservation = await prisma.reservation.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
    include: { table: true, customer: true },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  return NextResponse.json(reservation);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession(CRM_ADMIN_ROLES);
  if (error) return error;
  const { id } = await params;

  const reservation = await prisma.reservation.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const body = await req.json();
  const { status, tableId, partySize, reservationDate, reservationTime, specialRequest } = body;

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: Prisma.ReservationUpdateInput = {};

  if (status) data.status = status;
  if (tableId !== undefined) data.table = tableId ? { connect: { id: tableId } } : { disconnect: true };
  if (partySize !== undefined) data.partySize = Number(partySize);
  if (reservationDate !== undefined) data.reservationDate = new Date(`${reservationDate}T00:00:00`);
  if (reservationTime !== undefined) data.reservationTime = reservationTime;
  if (specialRequest !== undefined) data.specialRequest = specialRequest || null;

  const effectiveTableId = tableId !== undefined ? tableId : reservation.tableId;
  if (status === "SEATED") {
    if (!effectiveTableId) {
      return NextResponse.json({ error: "Assign a table before seating" }, { status: 400 });
    }
    await prisma.table.update({ where: { id: effectiveTableId }, data: { status: "OCCUPIED" } });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data,
    include: { table: true, customer: true },
  });

  return NextResponse.json(updated);
}
