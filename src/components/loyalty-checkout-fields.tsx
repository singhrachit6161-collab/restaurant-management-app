"use client";

import { useState } from "react";
import { Search, Gift, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface LoyaltyCheckoutValue {
  customerPhone: string;
  customerName: string;
  couponCode: string;
  redeemPoints: string;
}

interface LookupResult {
  found: boolean;
  customer?: { id: string; name: string; loyaltyPoints: number; membershipTier: string };
}

export function LoyaltyCheckoutFields({
  value,
  onChange,
}: {
  value: LoyaltyCheckoutValue;
  onChange: (value: LoyaltyCheckoutValue) => void;
}) {
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookedUpPhone, setLookedUpPhone] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  if (lookup && lookedUpPhone !== value.customerPhone) {
    setLookup(null);
    setLookedUpPhone(null);
  }

  async function doLookup() {
    if (!value.customerPhone || value.customerPhone.length < 6) return;
    setLooking(true);
    try {
      const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(value.customerPhone)}`);
      const data: LookupResult = await res.json();
      setLookup(data);
      setLookedUpPhone(value.customerPhone);
      if (data.found && data.customer && !value.customerName) {
        onChange({ ...value, customerName: data.customer.name });
      }
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Gift className="h-4 w-4" /> Customer & Loyalty (optional)
      </p>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input
            value={value.customerPhone}
            onChange={(e) => onChange({ ...value, customerPhone: e.target.value })}
            onBlur={doLookup}
            placeholder="10-digit phone"
          />
        </div>
        <Button variant="outline" size="sm" className="mt-5" onClick={doLookup} disabled={looking}>
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      {lookup?.found && lookup.customer && (
        <div className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2 text-sm">
          <span>
            {lookup.customer.name} <Badge variant="secondary">{lookup.customer.membershipTier}</Badge>
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Star className="h-3.5 w-3.5" /> {lookup.customer.loyaltyPoints} pts
          </span>
        </div>
      )}

      {lookup && !lookup.found && (
        <div className="space-y-1.5">
          <Label className="text-xs">New customer name</Label>
          <Input
            value={value.customerName}
            onChange={(e) => onChange({ ...value, customerName: e.target.value })}
            placeholder="Name"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Coupon code</Label>
          <Input
            value={value.couponCode}
            onChange={(e) => onChange({ ...value, couponCode: e.target.value.toUpperCase() })}
            placeholder="e.g. WELCOME10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Redeem points {lookup?.found && lookup.customer ? `(max ${Math.floor(lookup.customer.loyaltyPoints)})` : ""}
          </Label>
          <Input
            type="number"
            value={value.redeemPoints}
            onChange={(e) => onChange({ ...value, redeemPoints: e.target.value })}
            disabled={!lookup?.found}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}

export const emptyLoyaltyCheckoutValue: LoyaltyCheckoutValue = {
  customerPhone: "",
  customerName: "",
  couponCode: "",
  redeemPoints: "",
};
