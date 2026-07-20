"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}
interface Order {
  id: string;
  orderNumber: number;
  type: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  table: { name: string } | null;
  items: OrderItem[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
  PENDING: "warning",
  ACCEPTED: "secondary",
  PREPARING: "secondary",
  READY: "success",
  SERVED: "success",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export default function OrdersPage() {
  const { data: orders } = useQuery<Order[]>({
    queryKey: ["all-orders"],
    queryFn: async () => (await fetch("/api/orders?take=100")).json(),
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">All recent orders across dine-in, takeaway and online</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                  <TableCell>{order.table?.name ?? "—"}</TableCell>
                  <TableCell>{order.type}</TableCell>
                  <TableCell>{order.items.length}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.paymentStatus === "PAID" ? "success" : "outline"}>
                      {order.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
