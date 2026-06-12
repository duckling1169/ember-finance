import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast, type ToastType } from './toast';

function Trigger({ type, message }: { type: ToastType; message: string }) {
  const toast = useToast();
  return <button onClick={() => toast(type, message)}>fire</button>;
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast when fired and auto-dismisses after 5s', async () => {
    render(
      <ToastProvider>
        <Trigger type="success" message="Saved!" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('fire').click();
    });
    expect(screen.getByText('Saved!')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Saved!')).toBeNull();
  });

  it('dismisses on click', () => {
    render(
      <ToastProvider>
        <Trigger type="info" message="Heads up" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('fire').click();
    });
    expect(screen.getByText('Heads up')).toBeDefined();

    act(() => {
      screen.getByLabelText('Dismiss').click();
    });
    expect(screen.queryByText('Heads up')).toBeNull();
  });

  it('stacks multiple toasts', () => {
    render(
      <ToastProvider>
        <Trigger type="success" message="One" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('fire').click();
      screen.getByText('fire').click();
    });
    expect(screen.getAllByLabelText('Dismiss')).toHaveLength(2);
  });

  it('caps the stack at three toasts (oldest dropped)', () => {
    render(
      <ToastProvider>
        <Trigger type="success" message="Again" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('fire').click();
      screen.getByText('fire').click();
      screen.getByText('fire').click();
      screen.getByText('fire').click();
    });
    expect(screen.getAllByLabelText('Dismiss')).toHaveLength(3);
  });

  it('throws when used outside a provider', () => {
    expect(() => render(<Trigger type="success" message="x" />)).toThrow(
      'useToast must be used within a ToastProvider',
    );
  });
});
