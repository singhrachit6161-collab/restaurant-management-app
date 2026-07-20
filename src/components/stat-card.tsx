import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "default" | "warning" | "success" | "destructive";
  hint?: string;
}) {
  const accentClasses = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-500/10 text-emerald-600",
    destructive: "bg-red-500/10 text-red-600",
  } as const;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", accentClasses[accent ?? "default"])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
