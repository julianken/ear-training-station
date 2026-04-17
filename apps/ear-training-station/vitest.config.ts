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
