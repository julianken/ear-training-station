import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StepWarmupRound from './StepWarmupRound.svelte';

// getDeps is async and touches IDB/AudioContext; stub it so jsdom doesn't choke.
vi.mock('$lib/shell/deps', () => ({
  getDeps: vi.fn().mockResolvedValue({
    items: { listAll: vi.fn().mockResolvedValue([]) },
    attempts: { append: vi.fn().mockResolvedValue(undefined) },
    sessions: {
      start: vi.fn().mockResolvedValue({
        id: 'warmup-session',
        target_items: 1,
        started_at: 0,
        ended_at: null,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
      }),
      complete: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
      getOrDefault: vi.fn().mockResolvedValue({ onboarded: false }),
      update: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

describe('StepWarmupRound', () => {
  it('renders the warmup headline', () => {
    render(StepWarmupRound, { onBack: () => {} });
    expect(screen.getByRole('heading', { name: /your first round/i })).toBeInTheDocument();
  });

  it('renders the body copy', () => {
    render(StepWarmupRound, { onBack: () => {} });
    expect(screen.getByText(/hear the key, then sing/i)).toBeInTheDocument();
  });

  it('renders a Back button', () => {
    const onBack = vi.fn();
    render(StepWarmupRound, { onBack });
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });
});
