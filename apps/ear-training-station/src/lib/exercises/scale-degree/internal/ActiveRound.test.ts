import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';
import ActiveRound from './ActiveRound.svelte';
import { degradationState } from '$lib/shell/stores';

const baseControllerShape = {
  state: { kind: 'idle' as const },
  session: { id: 's' },
  currentItem: { id: 'i', degree: 5, key: { tonic: 'C', quality: 'major' } },
  capturedAudio: null,
  targetAudio: null,
  cancelRound: () => {},
  next: async () => {},
  dispose: () => {},
  _forceState: () => {},
};

const stubController = {
  ...baseControllerShape,
  startRound: async () => {},
} as never;

describe('ActiveRound', () => {
  it('renders a Start Round button in idle state', () => {
    render(ActiveRound, { controller: stubController });
    expect(screen.getByRole('button', { name: /start round/i })).toBeInTheDocument();
  });
});

describe('ActiveRound — startRound() error surfacing (GitHub #106 / Plan C2 Task 3)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The error handler logs by design for diagnostics; silence it in tests so
    // the terminal output isn't noisy.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reset degradation store so the mic-error assertion is independent of
    // test order.
    degradationState.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micPermissionDenied: false,
      micLost: false,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders an actionable mic-permission message when startRound() rejects with NotAllowedError', async () => {
    const err = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    const controller = {
      ...baseControllerShape,
      startRound: vi.fn(async () => { throw err; }),
    } as never;

    render(ActiveRound, { controller });

    await userEvent.click(screen.getByRole('button', { name: /start round/i }));

    // The alert copy must point the user to the concrete action (re-enable mic
    // access). If this string drifts without thought, the task's AC drifts.
    expect(screen.getByRole('alert')).toHaveTextContent(/microphone access is required/i);
    // The persistent banner mirrors the condition so the user sees context even
    // if they navigate away and come back. We flip `micPermissionDenied`, NOT
    // `micLost` — "disconnected, reconnect" copy is wrong when the mic was
    // never connected in the first place.
    expect(get(degradationState).micPermissionDenied).toBe(true);
    expect(get(degradationState).micLost).toBe(false);
  });

  it('renders a generic message when startRound() rejects with a non-mic error', async () => {
    const err = new Error('AudioContext construction failed');
    const controller = {
      ...baseControllerShape,
      startRound: vi.fn(async () => { throw err; }),
    } as never;

    render(ActiveRound, { controller });

    await userEvent.click(screen.getByRole('button', { name: /start round/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/could not start the round/i);
    // Non-mic errors must NOT flip either mic flag — that would mislead the
    // user into thinking the mic is the problem when it isn't.
    expect(get(degradationState).micPermissionDenied).toBe(false);
    expect(get(degradationState).micLost).toBe(false);
  });

  it('does not render an error message when startRound() resolves successfully', async () => {
    const controller = {
      ...baseControllerShape,
      startRound: vi.fn(async () => { /* resolves */ }),
    } as never;

    render(ActiveRound, { controller });

    await userEvent.click(screen.getByRole('button', { name: /start round/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still renders the Start round button after a failure so the user can retry', async () => {
    const controller = {
      ...baseControllerShape,
      startRound: vi.fn(async () => { throw new Error('boom'); }),
    } as never;

    render(ActiveRound, { controller });

    const button = screen.getByRole('button', { name: /start round/i });
    await userEvent.click(button);

    // Button stays visible — the controller's state is still 'idle' so
    // the template keeps rendering it, and the user can click again.
    expect(screen.getByRole('button', { name: /start round/i })).toBeInTheDocument();
  });

  it('clears the error on the next click so a retry does not show stale copy', async () => {
    // First call throws, second resolves — proves the error state is reset
    // at the top of start() and not sticky after success.
    let attempt = 0;
    const controller = {
      ...baseControllerShape,
      startRound: vi.fn(async () => {
        attempt++;
        if (attempt === 1) throw new Error('transient');
      }),
    } as never;

    render(ActiveRound, { controller });

    const button = screen.getByRole('button', { name: /start round/i });
    await userEvent.click(button);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('matches mic errors by DOMException code "unavailable" (no Permissions API)', async () => {
    // `requestMicStream` throws an Error with `code: 'unavailable'` when the
    // browser lacks the API entirely (e.g. older Safari, insecure context).
    // The UI must treat this as a mic error, not a generic failure.
    const err = Object.assign(new Error('Microphone API unavailable in this browser'), { code: 'unavailable' });
    const controller = {
      ...baseControllerShape,
      startRound: vi.fn(async () => { throw err; }),
    } as never;

    render(ActiveRound, { controller });

    await userEvent.click(screen.getByRole('button', { name: /start round/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/microphone access is required/i);
    expect(get(degradationState).micPermissionDenied).toBe(true);
    expect(get(degradationState).micLost).toBe(false);
  });
});
