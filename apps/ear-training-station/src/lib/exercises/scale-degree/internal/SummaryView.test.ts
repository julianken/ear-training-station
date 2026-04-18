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

  it('pluralizes "round" correctly for multiple attempts', () => {
    render(SummaryView, { session, attempts });
    expect(screen.getByText(/8 rounds/i)).toBeInTheDocument();
  });

  it('uses singular "round" when exactly 1 attempt', () => {
    const singleAttempt = [makeAttempt(0)];
    render(SummaryView, { session: { ...session, completed_items: 1 }, attempts: singleAttempt });
    expect(screen.getByText(/1 round(?!s)/i)).toBeInTheDocument();
  });

  it('uses dl/dd/dt semantic structure for stats', () => {
    const { container } = render(SummaryView, { session, attempts });
    const dls = container.querySelectorAll('dl.stat');
    expect(dls.length).toBe(2);
    // Each dl should have a dd (value) and dt (label)
    for (const dl of dls) {
      expect(dl.querySelector('dd')).not.toBeNull();
      expect(dl.querySelector('dt')).not.toBeNull();
    }
  });

  it('puts <dt> label before <dd> value in source order', () => {
    const { container } = render(SummaryView, { session, attempts });
    const firstStat = container.querySelector('.stat');
    expect(firstStat).not.toBeNull();
    const children = firstStat!.children;
    expect(children[0].tagName).toBe('DT');
    expect(children[1].tagName).toBe('DD');
  });
});
