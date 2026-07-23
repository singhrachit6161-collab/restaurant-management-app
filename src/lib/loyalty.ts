import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const TIER_THRESHOLDS: { tier: "PLATINUM" | "GOLD" | "SILVER"; min: number }[] = [
  { tier: "PLATINUM", min: 3000 },
  { tier: "GOLD", min: 1000 },
  { tier: "SILVER", min: 200 },
];

export function computeTier(lifetimePoints: number): "NONE" | "SILVER" | "GOLD" | "PLATINUM" {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (lifetimePoints >= min) return tier;
  }
  return "NONE";
}

export function generateReferralCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function computeEarnedPoints(orderTotal: number, loyaltyPointsPerAmount: number) {
  return Math.floor((orderTotal * loyaltyPointsPerAmount) / 100);
}

/**
 * Loyalty program parameters live on Account (shared across a chain's
 * branches), while a Restaurant row is a single branch — resolve the
 * account through the branch so callers can keep passing restaurantId.
 */
async function getAccountForRestaurant(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { account: true },
  });
  return restaurant?.account ?? null;
}

/**
 * Called once per order, at the same moment invoice creation happens (first
 * transition to paymentStatus=PAID) — reuses that transition as the
 * idempotency guard so points aren't double-credited on repeat PATCHes.
 */
export async function earnPointsForOrder(orderId: string, customerId: string, restaurantId: string) {
  const [order, account, customer] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    getAccountForRestaurant(restaurantId),
    prisma.customer.findUnique({ where: { id: customerId } }),
  ]);
  if (!order || !account || !customer) return;

  const points = computeEarnedPoints(order.total, account.loyaltyPointsPerAmount);
  if (points <= 0) return;

  const newLifetime = customer.lifetimePoints + points;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        customerId,
        restaurantId,
        orderId,
        type: "EARNED",
        points,
        note: `Order #${order.orderNumber}`,
      },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: customer.loyaltyPoints + points,
        lifetimePoints: newLifetime,
        membershipTier: computeTier(newLifetime),
      },
    }),
  ]);

  await maybeAwardReferralBonus(customerId, restaurantId);
}

async function maybeAwardReferralBonus(customerId: string, restaurantId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer?.referredByCustomerId) return;

  const paidOrderCount = await prisma.order.count({
    where: { customerId, paymentStatus: "PAID" },
  });
  if (paidOrderCount !== 1) return; // not their first paid order

  const account = await getAccountForRestaurant(restaurantId);
  const referrer = await prisma.customer.findUnique({ where: { id: customer.referredByCustomerId } });
  if (!account || !referrer) return;

  const bonus = account.referralBonusPoints;
  const newLifetime = referrer.lifetimePoints + bonus;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        customerId: referrer.id,
        restaurantId,
        type: "REFERRAL_BONUS",
        points: bonus,
        note: `Referral bonus for ${customer.name}'s first order`,
      },
    }),
    prisma.customer.update({
      where: { id: referrer.id },
      data: {
        loyaltyPoints: referrer.loyaltyPoints + bonus,
        lifetimePoints: newLifetime,
        membershipTier: computeTier(newLifetime),
      },
    }),
  ]);
}

/**
 * Read-only: caps a requested redemption against the customer's balance and
 * the order's remaining discountable amount, without mutating anything.
 * Call this while computing an order's total; call applyRedemption once the
 * order actually exists to post the ledger entry and deduct the balance.
 */
export async function previewRedemption(
  customerId: string,
  restaurantId: string,
  requestedPoints: number,
  orderMaxDiscount: number
) {
  if (requestedPoints <= 0) return { points: 0, discount: 0 };

  const [customer, account] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    getAccountForRestaurant(restaurantId),
  ]);
  if (!customer || !account) return { points: 0, discount: 0 };

  const maxRedeemableByBalance = Math.floor(customer.loyaltyPoints);
  const maxRedeemableByOrder = Math.floor(orderMaxDiscount / account.loyaltyRedemptionValue);
  const points = Math.max(0, Math.min(requestedPoints, maxRedeemableByBalance, maxRedeemableByOrder));
  if (points <= 0) return { points: 0, discount: 0 };

  const discount = Math.round(points * account.loyaltyRedemptionValue * 100) / 100;
  return { points, discount };
}

export async function applyRedemption(customerId: string, restaurantId: string, points: number, orderId: string) {
  if (points <= 0) return;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        customerId,
        restaurantId,
        orderId,
        type: "REDEEMED",
        points: -points,
        note: "Redeemed at checkout",
      },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: Math.max(0, customer.loyaltyPoints - points) },
    }),
  ]);
}

/**
 * Customers are scoped to the Account (shared across a chain's branches),
 * not the individual branch — a phone number is looked up/created once per
 * account so the same customer is recognized at any branch. Callers still
 * pass restaurantId since that's what they have on hand; it's resolved to
 * the owning account here.
 */
export async function findOrCreateCustomer(
  restaurantId: string,
  phone: string,
  name: string,
  referralCode?: string
) {
  const account = await getAccountForRestaurant(restaurantId);
  if (!account) throw new Error("Restaurant not found");
  const accountId = account.id;

  const existing = await prisma.customer.findUnique({
    where: { accountId_phone: { accountId, phone } },
  });
  if (existing) return existing;

  let referredByCustomerId: string | null = null;
  if (referralCode) {
    const referrer = await prisma.customer.findFirst({
      where: { accountId, referralCode: referralCode.toUpperCase() },
    });
    if (referrer) referredByCustomerId = referrer.id;
  }

  let code = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.customer.findUnique({ where: { referralCode: code } });
    if (!clash) break;
    code = generateReferralCode();
  }

  return prisma.customer.create({
    data: {
      accountId,
      phone,
      name,
      referralCode: code,
      referredByCustomerId,
    },
  });
}
