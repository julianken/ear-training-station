import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ChordBlocks from './ChordBlocks.svelte';
import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';

const cadence: ChordEvent[] = [
  { notes: [60, 64, 67], startSec: 0.0, durationSec: 0.7, romanNumeral: 'I'  },
  { notes: [65, 69, 72], startSec: 0.8, durationSec: 0.7, romanNumeral: 'IV' },
  { notes: [67, 71, 74], startSec: 1.6, durationSec: 0.7, romanNumeral: 'V'  },
  { notes: [60, 64, 67], startSec: 2.4, durationSec: 0.7, romanNumeral: 'I'  },
];

describe('ChordBlocks', () => {
  it('renders 4 blocks labeled I, IV, V, I', () => {
    render(ChordBlocks, { cadence, cadenceStartAcTime: 0, getCurrentTime: () => 0 });
    const blocks = screen.getAllByRole('listitem');
    expect(blocks.length).toBe(4);
  });

  it('marks the currently-playing chord as active based on currentTime', () => {
    const { container } = render(ChordBlocks, {
      cadence,
      cadenceStartAcTime: 0,
      getCurrentTime: () => 1.0,  // block 2 (IV, 0.8–1.5) active
    });
    const active = container.querySelectorAll('.active');
    expect(active.length).toBe(1);
  });
});
