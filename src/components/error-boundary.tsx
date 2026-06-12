'use client';

import React from 'react';

import { IconAlertTriangle } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[300px] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-lg bg-card p-6 text-center text-card-foreground">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <IconAlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-medium leading-snug">Something went wrong</h3>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. You can try again or refresh the page.
          </p>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="w-full overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback ?? ErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}
