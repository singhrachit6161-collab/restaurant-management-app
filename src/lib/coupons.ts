import { prisma } from "@/lib/prisma";

export async function validateCoupon(
  restaurantId: string,
  code: string,
  subtotal: number,
  customerId?: string | null
) {
  const coupon = await prisma.coupon.findUnique({
    where: { restaurantId_code: { restaurantId, code: code.toUpperCase() } },
  });
  if (!coupon || !coupon.active) return { ok: false as const, error: "Invalid or inactive coupon" };

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) return { ok: false as const, error: "Coupon is not active yet" };
  if (coupon.validUntil && now > coupon.validUntil) return { ok: false as const, error: "Coupon has expired" };
  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return { ok: false as const, error: `Minimum order value is ${coupon.minOrderValue}` };
  }

  if (coupon.usageLimit != null) {
    const totalUses = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    if (totalUses >= coupon.usageLimit) return { ok: false as const, error: "Coupon usage limit reached" };
  }

  if (coupon.usageLimitPerCustomer != null && customerId) {
    const customerUses = await prisma.couponRedemption.count({ where: { couponId: coupon.id, customerId } });
    if (customerUses >= coupon.usageLimitPerCustomer) {
      return { ok: false as const, error: "You've already used this coupon the maximum number of times" };
    }
  }

  let discount = coupon.type === "PERCENT" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal);
  discount = Math.round(discount * 100) / 100;

  return { ok: true as const, coupon, discount };
}

export async function recordCouponRedemption(
  couponId: string,
  orderId: string,
  customerId: string | null,
  discountApplied: number
) {
  await prisma.couponRedemption.create({
    data: { couponId, orderId, customerId, discountApplied },
  });
}
