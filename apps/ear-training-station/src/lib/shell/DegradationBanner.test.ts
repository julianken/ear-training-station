import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import DegradationBanner from './DegradationBanner.svelte';
import { degradationState } from './stores';

describe('DegradationBanner', () => {
  beforeEach(() => {
    degradationState.set({ kwsUnavailable: false, persistenceFailing: false, micLost: false });
  });

  it('renders nothing when no degradation is active', () => {
    const { container } = render(DegradationBanner);
    expect(container.querySelector('.degradation-banner')).toBeNull();
  });

  it('renders when KWS is unavailable', async () => {
    render(DegradationBanner);
    await act(() => degradationState.update((s) => ({ ...s, kwsUnavailable: true })));
    expect(screen.getByText(/speech recognition unavailable/i)).toBeInTheDocument();
  });

  it('lists multiple active signals', async () => {
    render(DegradationBanner);
    await act(() =>
      degradationState.set({ kwsUnavailable: true, persistenceFailing: true, micLost: false }),
    );
    expect(screen.getByText(/speech recognition unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/saving locally failed/i)).toBeInTheDocument();
  });
});
