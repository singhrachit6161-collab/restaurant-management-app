import { prisma } from "@/lib/prisma";

export async function getAccountUsage(accountId: string) {
  const [subscription, branchCount, staffCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { accountId }, include: { plan: true } }),
    prisma.restaurant.count({ where: { accountId } }),
    prisma.user.count({ where: { accountId } }),
  ]);
  return { subscription, branchCount, staffCount };
}

export async function assertCanAddBranch(accountId: string) {
  const { subscription, branchCount } = await getAccountUsage(accountId);
  const maxBranches = subscription?.plan.maxBranches;
  if (maxBranches != null && branchCount >= maxBranches) {
    return {
      ok: false as const,
      error: `Your ${subscription!.plan.name} plan allows up to ${maxBranches} branch${maxBranches === 1 ? "" : "es"}. Upgrade your plan to add more.`,
    };
  }
  return { ok: true as const };
}

export async function assertCanAddStaff(accountId: string) {
  const { subscription, staffCount } = await getAccountUsage(accountId);
  const maxStaff = subscription?.plan.maxStaff;
  if (maxStaff != null && staffCount >= maxStaff) {
    return {
      ok: false as const,
      error: `Your ${subscription!.plan.name} plan allows up to ${maxStaff} staff accounts. Upgrade your plan to add more.`,
    };
  }
  return { ok: true as const };
}
