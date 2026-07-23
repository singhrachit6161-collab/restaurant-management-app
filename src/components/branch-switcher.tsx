"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, ChevronsUpDown, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Branch {
  id: string;
  name: string;
}

export function BranchSwitcher({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { update } = useSession();

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => (await fetch("/api/account/branches")).json(),
  });

  const switchBranch = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await fetch("/api/account/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: targetId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: async (data: { restaurantId: string; name: string }) => {
      await update({ restaurantId: data.restaurantId });
      queryClient.invalidateQueries();
      router.refresh();
      toast.success(`Switched to ${data.name}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!branches || branches.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-1">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <p className="truncate text-sm font-medium">{restaurantName}</p>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm font-medium">{restaurantName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => b.id !== restaurantId && switchBranch.mutate(b.id)}
            className="flex items-center justify-between"
          >
            {b.name}
            {b.id === restaurantId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/branches" className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" /> Manage branches
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
