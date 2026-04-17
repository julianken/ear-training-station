import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ActiveRound from './ActiveRound.svelte';

const stubController = {
  state: { kind: 'idle' as const },
  session: { id: 's' },
  currentItem: { id: 'i', degree: 5, key: { tonic: 'C', quality: 'major' } },
  capturedAudio: null,
  targetAudio: null,
  startRound: async () => {},
  cancelRound: () => {},
  next: async () => {},
  dispose: () => {},
  _forceState: () => {},
} as never;

describe('ActiveRound', () => {
  it('renders a Start Round button in idle state', () => {
    render(ActiveRound, { controller: stubController });
    expect(screen.getByRole('button', { name: /start round/i })).toBeInTheDocument();
  });
});
