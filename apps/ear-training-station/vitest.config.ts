import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appSrc = fileURLToPath(new URL('./src', import.meta.url));
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url));
const webPlatformSrc = fileURLToPath(new URL('../../packages/web-platform/src', import.meta.url));

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      // cross-package: @ear-training/core/* → core src
      {
        find: /^@ear-training\/core\/(.*)/,
        replacement: path.join(coreSrc, '$1'),
      },
      // cross-package: @ear-training/web-platform/* → web-platform src
      {
        find: /^@ear-training\/web-platform\/(.*)/,
        replacement: path.join(webPlatformSrc, '$1'),
      },
      // $lib alias → app src/lib
      {
        find: /^\$lib\/(.*)/,
        replacement: path.join(appSrc, 'lib/$1'),
      },
      // $app/paths → test stub (no SvelteKit runtime in vitest)
      {
        find: '$app/paths',
        replacement: fileURLToPath(new URL('./tests/__mocks__/app-paths.ts', import.meta.url)),
      },
      // $app/navigation → test stub (no SvelteKit runtime in vitest)
      {
        find: '$app/navigation',
        replacement: fileURLToPath(new URL('./tests/__mocks__/app-navigation.ts', import.meta.url)),
      },
      // virtual:pwa-register → test stub (vite-plugin-pwa is not wired into vitest).
      // Needed so `+layout.svelte` can be imported by component tests — even though
      // the dynamic import is gated on MODE === 'production' (always false in tests),
      // Vite still resolves the import specifier during module transform.
      {
        find: 'virtual:pwa-register',
        replacement: fileURLToPath(new URL('./tests/__mocks__/virtual-pwa-register.ts', import.meta.url)),
      },
      // @/ context-sensitive: core files → core src, web-platform files → web-platform src,
      // otherwise → app src. Uses customResolver to inspect the importer path.
      {
        find: '@/',
        replacement: appSrc + '/',
        customResolver(id, importer) {
          if (importer && importer.startsWith(coreSrc)) {
            const suffix = id.slice(appSrc.length + 1);
            return path.join(coreSrc, suffix);
          }
          if (importer && importer.startsWith(webPlatformSrc)) {
            const suffix = id.slice(appSrc.length + 1);
            return path.join(webPlatformSrc, suffix);
          }
          // Default: already-replaced appSrc path
          return id;
        },
      },
    ],
  },
});
