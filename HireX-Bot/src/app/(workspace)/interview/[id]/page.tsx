import { DeltaReceiptCard } from '@/components/studio/DeltaReceiptCard';
import { SimulationWorkspace } from '@/components/studio/SimulationWorkspace';
import { sampleBlueprint } from '@/lib/module5/sample-blueprint';

export default async function InterviewSessionPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const blueprint = sampleBlueprint();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <SimulationWorkspace
        blueprint={blueprint}
        mode="Mode_B"
        sessionId={id}
        offlineState={{ status: 'online', latency_ms: 120, queue_depth: 0, last_synced_at: null }}
      />
      <div className="mt-6">
        <DeltaReceiptCard weightedScore={null} baselineDelta={null} mode="Mode_B" canMint={false} />
      </div>
    </div>
  );
}
