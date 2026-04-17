import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AppShell from '$lib/shell/AppShell.svelte';
import { allSessions } from '$lib/shell/stores';

describe('AppShell', () => {
  it('renders the logo', () => {
    allSessions.set([]);
    render(AppShell);
    expect(screen.getByText(/ear training/i)).toBeInTheDocument();
  });

  it('renders a settings link pointing to /settings', () => {
    allSessions.set([]);
    render(AppShell);
    const link = screen.getByRole('link', { name: /settings/i });
    expect(link.getAttribute('href')).toBe('/settings');
  });
});
