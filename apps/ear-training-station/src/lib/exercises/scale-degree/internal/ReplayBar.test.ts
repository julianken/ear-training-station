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
});
