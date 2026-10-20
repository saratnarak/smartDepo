import { PendingStatus } from '@/features/auth/pending-status';

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string | string[] }>;
}) {
  const params = await searchParams;
  return <PendingStatus registered={params.registered === '1'} />;
}
