import { PurchaseOrderDetailView } from "@/components/purchase-order-detail-view";

export default function DashboardPurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <PurchaseOrderDetailView params={params} basePath="/dashboard" />;
}
