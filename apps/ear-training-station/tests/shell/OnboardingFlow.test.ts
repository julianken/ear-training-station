import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import OnboardingFlow from '$lib/shell/OnboardingFlow.svelte';

describe('OnboardingFlow', () => {
  it('starts on the Welcome step', () => {
    render(OnboardingFlow);
    expect(screen.getByText(/ear training that uses your voice/i)).toBeInTheDocument();
  });

  it('advances through four steps via Continue', async () => {
    const user = userEvent.setup();
    render(OnboardingFlow);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /grant microphone access/i })).toBeInTheDocument();
  });

  it('back button on step 2 returns to Welcome', async () => {
    const user = userEvent.setup();
    render(OnboardingFlow);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/ear training that uses your voice/i)).toBeInTheDocument();
  });
});
