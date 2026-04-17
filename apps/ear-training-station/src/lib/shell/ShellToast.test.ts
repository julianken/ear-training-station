import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import ShellToast from './ShellToast.svelte';
import { pendingToasts, pushToast, dismissToast } from './stores';
import { get } from 'svelte/store';

describe('ShellToast', () => {
  beforeEach(() => { pendingToasts.set([]); });

  it('renders nothing when pendingToasts is empty', () => {
    const { container } = render(ShellToast);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('renders a toast when pushed', async () => {
    render(ShellToast);
    await act(() => pushToast({ message: 'Hello', level: 'info' }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('auto-dismisses info toasts after the default timeout', async () => {
    vi.useFakeTimers();
    try {
      render(ShellToast);
      await act(() => pushToast({ message: 'Auto gone', level: 'info' }));
      expect(screen.getByText('Auto gone')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTime(5000));
      expect(get(pendingToasts)).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });

  it('error toasts stay until dismissed', async () => {
    vi.useFakeTimers();
    try {
      render(ShellToast);
      const id = await act(() => pushToast({ message: 'Stuck', level: 'error' }));
      await act(() => vi.advanceTimersByTime(30_000));
      expect(get(pendingToasts).length).toBe(1);
      await act(() => dismissToast(id));
      expect(get(pendingToasts)).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});
