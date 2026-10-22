import { ParallelPulseStrip } from '@/components/navigation/ParallelPulseStrip';
import { WorkspacePage } from '@/components/workspace/WorkspacePage';

export default function DashboardPage() {
  return (
    <WorkspacePage tab="command">
      <ParallelPulseStrip />
    </WorkspacePage>
  );
}
