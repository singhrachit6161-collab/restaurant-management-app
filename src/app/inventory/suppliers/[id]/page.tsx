import { SupplierDetailView } from "@/components/supplier-detail-view";

export default function InventorySupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <SupplierDetailView params={params} basePath="/inventory" />;
}
