import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DashboardView from './DashboardView.svelte';
import { allItems, settings } from '$lib/shell/stores';
import { DEFAULT_SETTINGS } from '@ear-training/core/types/domain';

// Shared mocks for `getDeps` — the Dashboard's Start button calls
// `getDeps().sessions.start()`, so we capture the call to assert on
// its `target_items` argument. `vi.hoisted` is required because
// `vi.mock` factories are hoisted above top-level consts.
const { startSpy } = vi.hoisted(() => ({
  startSpy: vi.fn(async (input: { id: string; target_items: number; started_at: number }) => ({
    id: input.id,
    target_items: input.target_items,
    started_at: input.started_at,
    ended_at: null,
    completed_items: 0,
    pitch_pass_count: 0,
    label_pass_count: 0,
  })),
}));

vi.mock('$lib/shell/deps', () => ({
  getDeps: vi.fn().mockResolvedValue({
    sessions: { start: startSpy },
    // The other repos on the deps object are unused by the Start CTA path,
    // so leaving them undefined keeps the stub minimal.
  }),
}));

describe('DashboardView', () => {
  it('renders a Start CTA', () => {
    allItems.set([]);
    render(DashboardView);
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('shows 7 mastery bars (one per degree)', () => {
    allItems.set([]);
    const { container } = render(DashboardView);
    expect(container.querySelectorAll('.mastery-bar').length).toBe(7);
  });
});

describe('DashboardView — session_length → target_items wiring (GitHub #114 / Plan C2 Task 6)', () => {
  // Regression pin for the settings read path. DashboardView.svelte reads
  // `session_length` from the shell's `settings` store and passes it as
  // `target_items` when starting a session. A silent revert to a hardcoded
  // `target_items: 30` (the pre-fix shape) would flip these assertions.

  it('passes session_length=45 from the settings store as target_items to sessions.start()', async () => {
    allItems.set([]);
    settings.set({ ...DEFAULT_SETTINGS, session_length: 45 });
    startSpy.mockClear();

    const user = userEvent.setup();
    render(DashboardView);
    await user.click(screen.getByRole('button', { name: /start/i }));

    expect(startSpy).toHaveBeenCalledOnce();
    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({ target_items: 45 }),
    );
  });

  it('passes session_length=20 from the settings store as target_items to sessions.start()', async () => {
    // Two values so a hardcoded `target_items: 30` (or any single constant)
    // would fail at least one assertion regardless of which constant was used.
    allItems.set([]);
    settings.set({ ...DEFAULT_SETTINGS, session_length: 20 });
    startSpy.mockClear();

    const user = userEvent.setup();
    render(DashboardView);
    await user.click(screen.getByRole('button', { name: /start/i }));

    expect(startSpy).toHaveBeenCalledOnce();
    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({ target_items: 20 }),
    );
  });
});
