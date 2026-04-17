import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SettingsPage from '$lib/shell/SettingsPage.svelte';
import { settings } from '$lib/shell/stores';
import { DEFAULT_SETTINGS } from '@ear-training/core/types/domain';

describe('SettingsPage', () => {
  it('renders all toggle controls', () => {
    settings.set(DEFAULT_SETTINGS);
    render(SettingsPage);
    expect(screen.getByLabelText(/function tooltip/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auto-advance on hit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reduced motion/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session length/i)).toBeInTheDocument();
  });

  it('reflects current settings values in the inputs', () => {
    settings.set({ ...DEFAULT_SETTINGS, function_tooltip: false, session_length: 45 });
    render(SettingsPage);
    const tooltipToggle = screen.getByLabelText(/function tooltip/i) as HTMLInputElement;
    expect(tooltipToggle.checked).toBe(false);
    const lengthSelect = screen.getByLabelText(/session length/i) as HTMLSelectElement;
    expect(lengthSelect.value).toBe('45');
  });

  it('shows the reset-progress button', () => {
    settings.set(DEFAULT_SETTINGS);
    render(SettingsPage);
    expect(screen.getByRole('button', { name: /reset progress/i })).toBeInTheDocument();
  });

  it('opens the confirmation modal when reset is clicked', async () => {
    settings.set(DEFAULT_SETTINGS);
    const user = userEvent.setup();
    render(SettingsPage);
    await user.click(screen.getByRole('button', { name: /reset progress/i }));
    expect(screen.getByText(/this will permanently delete/i)).toBeInTheDocument();
  });
});
