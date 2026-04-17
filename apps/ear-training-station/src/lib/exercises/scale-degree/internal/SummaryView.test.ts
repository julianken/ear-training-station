import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SummaryView from './SummaryView.svelte';
import type { Session, Attempt } from '@ear-training/core/types/domain';

const session: Session = {
  id: 's1',
  started_at: 1000000,
  ended_at: 1000000 + 600000, // 10 min
  target_items: 10,
  completed_items: 8,
  pitch_pass_count: 6,
  label_pass_count: 7,
  focus_item_id: null,
};

const makeAttempt = (i: number): Attempt => ({
  id: `a${i}`,
  session_id: 's1',
  item_id: `item-${i}`,
  at: 1000000 + i * 10000,
  target: { hz: 392, degree: 5 },
  sung: { hz: 392, cents_off: 3, confidence: 0.9 },
  spoken: { digit: 5, confidence: 0.95 },
  graded: { pitch: i < 6, label: i < 7, pass: i < 6, at: 1000000 + i * 10000 },
  timbre: 'piano',
  register: 'comfortable',
});

const attempts: Attempt[] = Array.from({ length: 8 }, (_, i) => makeAttempt(i));

describe('SummaryView', () => {
  it('renders the "Done." heading', () => {
    render(SummaryView, { session, attempts });
    expect(screen.getByRole('heading', { name: /done/i })).toBeInTheDocument();
  });

  it('shows pitch and label pass counts', () => {
    render(SummaryView, { session, attempts });
    expect(screen.getByText('6/8')).toBeInTheDocument();
    expect(screen.getByText('7/8')).toBeInTheDocument();
  });

  it('renders Dashboard and Done buttons', () => {
    render(SummaryView, { session, attempts });
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
    // Anchor to avoid matching the "Done." heading
    expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument();
  });
});
