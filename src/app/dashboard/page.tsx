"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IndianRupee,
  ShoppingBag,
  Table2,
  CheckCircle2,
  ChefHat,
  XCircle,
  Smartphone,
  TrendingUp,
  Clock,
  AlertTriangle,
  PackageX,
  CalendarClock,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/utils";

interface DashboardStats {
  scope: "branch" | "all";
  revenue: number;
  ordersCount: number;
  tablesOccupied: number;
  tablesAvailable: number;
  totalTables: number;
  kitchenPending: number;
  readyCount: number;
  cancelledCount: number;
  onlineCount: number;
  aov: number;
  topItems: { name: string; qty: number }[];
  peakHour: string;
  revenueGraph: { hour: string; revenue: number; orders: number }[];
  lowStockCount: number;
  outOfStockCount: number;
  expiringCount: number;
}

function AiInsightsCard({ scope }: { scope: "branch" | "all" }) {
  const insights = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dashboard/insights${scope === "all" ? "?scope=all" : ""}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      return body.text as string;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.data && <p className="text-sm leading-relaxed">{insights.data}</p>}
        {insights.isError && (
          <p className="text-sm text-muted-foreground">{(insights.error as Error).message}</p>
        )}
        {!insights.data && !insights.isError && !insights.isPending && (
          <p className="text-sm text-muted-foreground">
            Get a quick, AI-generated read on today&apos;s business — what&apos;s working and what needs attention.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={insights.isPending}
          onClick={() => insights.mutate()}
        >
          {insights.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : insights.data || insights.isError ? (
            <>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate Insights
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: sessionData } = useSession();
  const isOwner = sessionData?.user?.role === "OWNER";
  const [scope, setScope] = useState<"branch" | "all">("branch");
  const effectiveScope = isOwner ? scope : "branch";

  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", effectiveScope],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats${effectiveScope === "all" ? "?scope=all" : ""}`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {effectiveScope === "all" ? "Live overview across all branches, today" : "Live overview of today's business"}
          </p>
        </div>
        {isOwner && (
          <Tabs value={scope} onValueChange={(v) => setScope(v as "branch" | "all")}>
            <TabsList>
              <TabsTrigger value="branch">This Branch</TabsTrigger>
              <TabsTrigger value="all">All Branches</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <AiInsightsCard scope={effectiveScope} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={data ? formatCurrency(data.revenue) : "…"}
          icon={IndianRupee}
          accent="success"
        />
        <StatCard label="Today's Orders" value={data?.ordersCount ?? "…"} icon={ShoppingBag} />
        <StatCard
          label="Tables Occupied"
          value={data ? `${data.tablesOccupied}/${data.totalTables}` : "…"}
          icon={Table2}
          accent="warning"
        />
        <StatCard
          label="Tables Available"
          value={data?.tablesAvailable ?? "…"}
          icon={Table2}
          accent="success"
        />
        <StatCard
          label="Kitchen Orders Pending"
          value={data?.kitchenPending ?? "…"}
          icon={ChefHat}
          accent="warning"
        />
        <StatCard label="Orders Ready" value={data?.readyCount ?? "…"} icon={CheckCircle2} accent="success" />
        <StatCard
          label="Cancelled Orders"
          value={data?.cancelledCount ?? "…"}
          icon={XCircle}
          accent="destructive"
        />
        <StatCard label="Online Orders" value={data?.onlineCount ?? "…"} icon={Smartphone} />
        <StatCard
          label="Average Order Value"
          value={data ? formatCurrency(data.aov) : "…"}
          icon={TrendingUp}
        />
        <StatCard label="Peak Hours" value={data?.peakHour ?? "…"} icon={Clock} />
        <StatCard
          label="Low Stock Ingredients"
          value={data?.lowStockCount ?? "…"}
          icon={AlertTriangle}
          accent={data && data.lowStockCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Out of Stock"
          value={data?.outOfStockCount ?? "…"}
          icon={PackageX}
          accent={data && data.outOfStockCount > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Expiring / Expired"
          value={data?.expiringCount ?? "…"}
          icon={CalendarClock}
          accent={data && data.expiringCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Today (by hour)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!isLoading && data && data.revenueGraph.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueGraph}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={40} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--primary)"
                    fill="url(#revFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No orders yet today
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data && data.topItems.length > 0 ? (
              data.topItems.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium text-muted-foreground">{item.qty} sold</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No sales yet today</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
