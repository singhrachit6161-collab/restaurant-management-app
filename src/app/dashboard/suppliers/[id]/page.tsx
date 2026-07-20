import { SupplierDetailView } from "@/components/supplier-detail-view";

export default function DashboardSupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <SupplierDetailView params={params} basePath="/dashboard" />;
}
