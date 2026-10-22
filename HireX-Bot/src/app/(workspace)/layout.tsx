import { WorkspaceChrome } from '@/components/navigation/WorkspaceChrome';

export default function WorkspaceLayout({ children }: { readonly children: React.ReactNode }) {
  return <WorkspaceChrome>{children}</WorkspaceChrome>;
}
