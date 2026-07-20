import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { ChefHat } from "lucide-react";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-orange-400" />
          <span className="font-semibold">Kitchen Display System</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span>{session?.user.name}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 overflow-x-auto p-4">{children}</main>
    </div>
  );
}
