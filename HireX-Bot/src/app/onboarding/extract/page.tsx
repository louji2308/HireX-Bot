import { ExtractScreen } from '@/components/onboarding/ExtractScreen';

export const dynamic = 'force-dynamic';

export default async function ExtractPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly sample?: string }>;
}) {
  const params = await searchParams;
  return <ExtractScreen sample={params.sample === '1'} />;
}
