import { ReportsManager } from '@/features/reports/reports-manager';
import {
  reportKeyForSalesView,
  SALES_VIEWS,
  type SalesView,
} from '@/features/reports/report-registry';

function normalizeView(value: string | string[] | undefined): SalesView {
  const raw = Array.isArray(value) ? value[0] : value;

  return SALES_VIEWS.includes(raw as SalesView) ? (raw as SalesView) : 'period';
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = normalizeView(params.view);

  return <ReportsManager reportKey={reportKeyForSalesView(view)} salesView={view} />;
}
