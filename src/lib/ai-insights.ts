import Anthropic from "@anthropic-ai/sdk";
import type { getDashboardStats } from "@/lib/dashboard-stats";

const MODEL = "claude-haiku-4-5-20251001";

function buildPrompt(stats: Awaited<ReturnType<typeof getDashboardStats>>, scopeLabel: string) {
  return `You are a business analyst for a restaurant. Based on today's data for ${scopeLabel}, write a short, actionable summary (2-4 sentences, plain prose, no headers or bullet points) highlighting what's going well, what needs attention, and one concrete suggestion. Be specific with numbers where useful.

Data:
- Revenue today: ₹${stats.revenue.toFixed(0)}
- Orders today: ${stats.ordersCount} (${stats.cancelledCount} cancelled, ${stats.onlineCount} online)
- Average order value: ₹${stats.aov.toFixed(0)}
- Peak hour: ${stats.peakHour}
- Top selling items: ${stats.topItems.map((i) => `${i.name} (${i.qty})`).join(", ") || "none yet"}
- Tables: ${stats.tablesOccupied}/${stats.totalTables} occupied
- Kitchen orders pending: ${stats.kitchenPending}, ready: ${stats.readyCount}
- Low stock ingredients: ${stats.lowStockItems.join(", ") || "none"}
- Out of stock ingredients: ${stats.outOfStockCount}
- Ingredients expiring soon: ${stats.expiringCount}`;
}

export async function generateInsights(
  stats: Awaited<ReturnType<typeof getDashboardStats>>,
  scopeLabel: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI insights unavailable — add ANTHROPIC_API_KEY to your .env to enable this feature.",
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(stats, scopeLabel) }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Empty response from model");

    return { ok: true, text };
  } catch (err) {
    console.error("AI insights generation failed", err);
    return { ok: false, error: "Couldn't generate insights right now — please try again in a moment." };
  }
}
