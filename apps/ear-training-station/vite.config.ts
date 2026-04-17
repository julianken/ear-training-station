import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const appSrc = fileURLToPath(new URL('./src', import.meta.url));
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url));
const webPlatformSrc = fileURLToPath(new URL('../../packages/web-platform/src', import.meta.url));

/** Resolve a bare path (no leading @/) against the correct package src root. */
function resolveToBare(subpath: string, importer: string | undefined): string {
  const srcRoot = importer?.startsWith(coreSrc) ? coreSrc
    : importer?.startsWith(webPlatformSrc) ? webPlatformSrc
    : appSrc;
  const resolved = path.join(srcRoot, subpath);
  if (!path.extname(resolved)) {
    const withTs = resolved + '.ts';
    if (fs.existsSync(withTs)) return withTs;
  }
  return resolved;
}

export default defineConfig({
  plugins: [
    // Context-sensitive @/ alias across monorepo packages.
    // Must run before SvelteKit's own resolver so @/ in core/web-platform
    // files resolves to those packages' src/, not the app's src/.
    {
      name: 'monorepo-at-alias',
      enforce: 'pre',
      resolveId: {
        order: 'pre',
        handler(id, importer) {
          if (id.startsWith('@ear-training/core/')) {
            const subpath = id.slice('@ear-training/core/'.length);
            const resolved = path.join(coreSrc, subpath);
            const withTs = resolved + '.ts';
            return fs.existsSync(withTs) ? withTs : resolved;
          }
          if (id.startsWith('@ear-training/web-platform/')) {
            const subpath = id.slice('@ear-training/web-platform/'.length);
            const resolved = path.join(webPlatformSrc, subpath);
            const withTs = resolved + '.ts';
            return fs.existsSync(withTs) ? withTs : resolved;
          }
          if (id.startsWith('@/')) {
            return resolveToBare(id.slice(2), importer);
          }
          return null;
        },
      },
    },
    sveltekit(),
  ],
  server: {
    fs: { allow: ['..', '../..'] },
  },
});
