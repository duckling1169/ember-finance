import { ErrorBoundary } from '@/components/error-boundary';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { RequireAuth } from '@/lib/require-auth';
import { ScenarioProvider } from '@/lib/scenario-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <ScenarioProvider>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <TopBar />
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </ScenarioProvider>
    </RequireAuth>
  );
}
