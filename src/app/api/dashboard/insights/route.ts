import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { generateInsights } from "@/lib/ai-insights";

export async function POST(req: Request) {
  const { session, error } = await requireSession(["OWNER", "MANAGER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const allBranches = searchParams.get("scope") === "all" && session.user.role === "OWNER";

  const restaurantWhere = allBranches
    ? { accountId: session.user.accountId }
    : { id: session.user.restaurantId };

  const stats = await getDashboardStats(restaurantWhere);
  const result = await generateInsights(stats, allBranches ? "all branches" : "this branch");

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503 });
  return NextResponse.json({ text: result.text });
}
