import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MicDeniedGate from './MicDeniedGate.svelte';

describe('MicDeniedGate', () => {
  it('renders guidance and a retry button', () => {
    render(MicDeniedGate, { onRetry: () => {} });
    expect(screen.getByText(/microphone access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('fires onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(MicDeniedGate, { onRetry });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
