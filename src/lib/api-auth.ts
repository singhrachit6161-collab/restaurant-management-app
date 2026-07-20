import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireSession(allowedRoles?: string[]) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { session } as const;
}
