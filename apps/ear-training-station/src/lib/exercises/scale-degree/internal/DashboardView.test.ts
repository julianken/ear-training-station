import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DashboardView from './DashboardView.svelte';
import { allItems } from '$lib/shell/stores';

describe('DashboardView', () => {
  it('renders a Start CTA', () => {
    allItems.set([]);
    render(DashboardView);
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('shows 7 mastery bars (one per degree)', () => {
    allItems.set([]);
    const { container } = render(DashboardView);
    expect(container.querySelectorAll('.mastery-bar').length).toBe(7);
  });
});
