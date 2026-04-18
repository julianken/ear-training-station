import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import DegradationBanner from './DegradationBanner.svelte';
import { degradationState } from './stores';

describe('DegradationBanner', () => {
  beforeEach(() => {
    degradationState.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micPermissionDenied: false,
      micLost: false,
    });
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
      degradationState.set({
        kwsUnavailable: true,
        persistenceFailing: true,
        micPermissionDenied: false,
        micLost: false,
      }),
    );
    expect(screen.getByText(/speech recognition unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/saving locally failed/i)).toBeInTheDocument();
  });

  // GitHub #106 follow-up / Plan C2 Task 3 code review: `micPermissionDenied`
  // and `micLost` are distinct states — the first is "never granted access",
  // the second is "mic dropped mid-session". Copy must not conflate them.
  it('renders permission-denied copy, NOT the reconnect copy, for micPermissionDenied', async () => {
    render(DegradationBanner);
    await act(() =>
      degradationState.set({
        kwsUnavailable: false,
        persistenceFailing: false,
        micPermissionDenied: true,
        micLost: false,
      }),
    );
    expect(screen.getByText(/microphone access blocked/i)).toBeInTheDocument();
    // The older "reconnect" copy must NOT appear — that message is for a
    // device that was connected and then dropped, which did not happen here.
    expect(screen.queryByText(/microphone disconnected/i)).not.toBeInTheDocument();
  });

  it('renders disconnect copy for micLost (runtime drop scenario)', async () => {
    render(DegradationBanner);
    await act(() =>
      degradationState.set({
        kwsUnavailable: false,
        persistenceFailing: false,
        micPermissionDenied: false,
        micLost: true,
      }),
    );
    expect(screen.getByText(/microphone disconnected/i)).toBeInTheDocument();
    expect(screen.queryByText(/microphone access blocked/i)).not.toBeInTheDocument();
  });
});
