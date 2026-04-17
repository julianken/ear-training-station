import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { allItems } from '$lib/shell/stores';
import DashboardWidget from './DashboardWidget.svelte';
import type { Item } from '@ear-training/core/types/domain';

describe('DashboardWidget', () => {
  beforeEach(() => {
    allItems.set([]);
  });

  it('renders four Leitner box counts', () => {
    render(DashboardWidget);
    expect(screen.getByText(/new/i)).toBeInTheDocument();
    expect(screen.getByText(/mastered/i)).toBeInTheDocument();
    expect(screen.getByText(/reviewing/i)).toBeInTheDocument();
    expect(screen.getByText(/learning/i)).toBeInTheDocument();
  });

  it('renders 0 counts when no items present', () => {
    render(DashboardWidget);
    const values = screen.getAllByText('0');
    expect(values.length).toBeGreaterThanOrEqual(4);
  });

  it('reflects item counts in each Leitner box', () => {
    const makeItem = (id: string, box: Item['box']): Item => ({
      id,
      degree: 1,
      key: { tonic: 'C', quality: 'major' },
      box,
      accuracy: { pitch: 0, label: 0 },
      recent: [],
      attempts: 0,
      consecutive_passes: 0,
      last_seen_at: null,
      due_at: 0,
      created_at: 0,
    });

    allItems.set([
      makeItem('z', 'new'),
      makeItem('a', 'mastered'),
      makeItem('b', 'mastered'),
      makeItem('c', 'reviewing'),
      makeItem('d', 'learning'),
      makeItem('e', 'learning'),
      makeItem('f', 'learning'),
    ]);

    render(DashboardWidget);

    const stats = document.querySelectorAll('.stat');
    // new stat
    expect(stats[0].querySelector('.value')?.textContent).toBe('1');
    // mastered stat
    expect(stats[1].querySelector('.value')?.textContent).toBe('2');
    // reviewing stat
    expect(stats[2].querySelector('.value')?.textContent).toBe('1');
    // learning stat
    expect(stats[3].querySelector('.value')?.textContent).toBe('3');
  });
});
