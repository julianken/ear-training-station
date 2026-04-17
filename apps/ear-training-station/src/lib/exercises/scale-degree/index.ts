export interface ExerciseManifest {
  slug: string;
  name: string;
  blurb: string;
  route: string;
}

export const manifest: ExerciseManifest = {
  slug: 'scale-degree',
  name: 'Scale-Degree Practice',
  blurb: 'Hear a cadence. Sing the degree. Say the number.',
  route: '/scale-degree',
};

export { createSessionController } from './internal/session-controller.svelte';
export type { SessionController, SessionControllerDeps } from './internal/session-controller.svelte';
export { default as ActiveRound } from './internal/ActiveRound.svelte';
export { default as FeedbackPanel } from './internal/FeedbackPanel.svelte';
export { default as ReplayBar } from './internal/ReplayBar.svelte';
export { default as DashboardView } from './internal/DashboardView.svelte';
