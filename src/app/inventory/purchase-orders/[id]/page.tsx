import { PurchaseOrderDetailView } from "@/components/purchase-order-detail-view";

export default function InventoryPurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <PurchaseOrderDetailView params={params} basePath="/inventory" />;
}
