import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FeedbackPanel from './FeedbackPanel.svelte';

const graded = {
  kind: 'graded' as const,
  item: { id: '5-C-major', degree: 5 as const, key: { tonic: 'C' as const, quality: 'major' as const }, box: 'new' as const, accuracy: { pitch: 0, label: 0 }, recent: [], attempts: 0, consecutive_passes: 0, last_seen_at: null, due_at: 0, created_at: 0 },
  timbre: 'piano' as const,
  register: 'comfortable' as const,
  outcome: { pitch: true, label: true, pass: true, at: 0 },
  cents_off: 3,
  sungBest: { at_ms: 100, hz: 392, confidence: 0.95 },
  digitHeard: 5 as const,
  digitConfidence: 0.9,
};

describe('FeedbackPanel', () => {
  it('shows pass badges and cents value on a passing attempt', () => {
    render(FeedbackPanel, { state: graded, showTooltip: true });
    expect(screen.getAllByText(/✓/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/3/)).toBeInTheDocument(); // cents
  });

  it('shows fail badges when pitch fails', () => {
    render(FeedbackPanel, {
      state: { ...graded, outcome: { pitch: false, label: true, pass: false, at: 0 }, cents_off: 70 },
      showTooltip: true,
    });
    expect(screen.getAllByText(/✗/).length).toBeGreaterThanOrEqual(1);
  });

  it('hides tooltip when showTooltip = false', () => {
    render(FeedbackPanel, { state: graded, showTooltip: false });
    expect(screen.queryByText(/resolves/i)).not.toBeInTheDocument();
  });

  it('shows plain-English explanation', () => {
    render(FeedbackPanel, {
      state: { ...graded, outcome: { pitch: true, label: false, pass: false, at: 0 }, digitHeard: 4 },
      showTooltip: false,
    });
    expect(screen.getByText(/you sang 5 but said 4/i)).toBeInTheDocument();
  });

  it('clicking Next round button fires onNext', async () => {
    const onNext = vi.fn();
    render(FeedbackPanel, { state: graded, showTooltip: false, onNext });
    await userEvent.click(screen.getByRole('button', { name: /next round/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
