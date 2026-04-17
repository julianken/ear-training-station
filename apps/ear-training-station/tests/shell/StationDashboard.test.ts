import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StationDashboard from '$lib/shell/StationDashboard.svelte';

describe('StationDashboard', () => {
  it('renders a card for every registered exercise', () => {
    render(StationDashboard);
    expect(screen.getByText(/scale-degree practice/i)).toBeInTheDocument();
  });

  it('exercise card links to the exercise route', () => {
    render(StationDashboard);
    const link = screen.getByRole('link', { name: /scale-degree practice/i });
    expect(link.getAttribute('href')).toBe('/scale-degree');
  });
});
