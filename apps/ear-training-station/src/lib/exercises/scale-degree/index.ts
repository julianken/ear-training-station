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

// C1.3 will add: createSessionController, SessionView, DashboardView, DashboardWidget.
