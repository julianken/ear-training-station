import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ReplayBar from './ReplayBar.svelte';

function fakeBuffer(): AudioBuffer {
  return {
    duration: 1.5,
    sampleRate: 48000,
    numberOfChannels: 1,
    length: 72000,
    getChannelData: () => new Float32Array(72000),
    copyToChannel: () => {},
    copyFromChannel: () => {},
  } as unknown as AudioBuffer;
}

describe('ReplayBar', () => {
  it('renders three mode buttons', () => {
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: fakeBuffer() });
    expect(screen.getByRole('button', { name: /you/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /both/i })).toBeInTheDocument();
  });

  it('renders a play button', () => {
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: fakeBuffer() });
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('renders disabled state when userBuffer is null', () => {
    render(ReplayBar, { userBuffer: null, targetBuffer: fakeBuffer() });
    const youBtn = screen.getByRole('button', { name: /you/i }) as HTMLButtonElement;
    expect(youBtn.disabled).toBe(true);
  });

  it('switches mode when user clicks Target', async () => {
    const user = userEvent.setup();
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: fakeBuffer() });
    await user.click(screen.getByRole('button', { name: /target/i }));
    // Target button should now have active class
    expect(screen.getByRole('button', { name: /target/i })).toHaveClass('active');
  });

  it('play button is disabled when current mode has no buffer; enabled after switching to a mode with a buffer', async () => {
    const user = userEvent.setup();
    // Production-initial state: userBuffer present, targetBuffer null.
    // Default mode is 'target', so Play should be disabled.
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: null });
    const playBtn = screen.getByRole('button', { name: /play/i }) as HTMLButtonElement;
    expect(playBtn.disabled).toBe(true);

    // Click 'You' — now mode=you and userBuffer is available; Play should be enabled.
    await user.click(screen.getByRole('button', { name: /you/i }));
    expect(playBtn.disabled).toBe(false);
  });
});
