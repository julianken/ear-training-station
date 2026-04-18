/**
 * Stub for `virtual:pwa-register` used in vitest.
 *
 * The real module is provided by vite-plugin-pwa, which is only wired into
 * the build/dev pipeline — vitest never registers the plugin, so importing
 * the virtual id fails with "Failed to resolve import". Tests that render
 * `+layout.svelte` still exercise its conditional `import.meta.env.MODE ===
 * 'production'` branch (always false under vitest), but Vite eagerly resolves
 * the dynamic `import()` call during module transform, so a stub is required
 * for the layout to load at all.
 */
export function registerSW(): () => Promise<void> {
  return async () => undefined;
}
