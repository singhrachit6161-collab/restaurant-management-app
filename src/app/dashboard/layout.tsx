import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session!.user.restaurantId },
  });

  return (
    <DashboardShell
      restaurantName={restaurant?.name ?? "RestaurantOS"}
      userName={session!.user.name ?? "User"}
      role={session!.user.role}
    >
      {children}
    </DashboardShell>
  );
}
