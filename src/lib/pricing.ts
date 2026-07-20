export function computeTotals({
  subtotal,
  taxRatePercent,
  serviceChargePercent,
  discount = 0,
}: {
  subtotal: number;
  taxRatePercent: number;
  serviceChargePercent: number;
  discount?: number;
}) {
  const discounted = Math.max(subtotal - discount, 0);
  const taxAmount = round2((discounted * taxRatePercent) / 100);
  const serviceCharge = round2((discounted * serviceChargePercent) / 100);
  const total = round2(discounted + taxAmount + serviceCharge);
  return { taxAmount, serviceCharge, total };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
