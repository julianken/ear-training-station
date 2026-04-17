import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedOnboarded } from './helpers/app-state';

const ROUTES = ['/', '/scale-degree', '/settings'];

for (const route of ROUTES) {
  test(`a11y smoke: ${route}`, async ({ page }) => {
    await seedOnboarded(page);
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
