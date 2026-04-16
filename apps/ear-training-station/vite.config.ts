import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const appSrc = fileURLToPath(new URL('./src', import.meta.url));
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url));
const webPlatformSrc = fileURLToPath(new URL('../../packages/web-platform/src', import.meta.url));

/** Resolve an @/ import from a given importer file path. */
function resolveAtSlash(subpath: string, importer: string | undefined): string {
  const srcRoot = importer?.startsWith(coreSrc) ? coreSrc
    : importer?.startsWith(webPlatformSrc) ? webPlatformSrc
    : appSrc;
  const resolved = path.join(srcRoot, subpath);
  // Try with .ts extension if the bare path has no extension
  if (!path.extname(resolved)) {
    const withTs = resolved + '.ts';
    if (fs.existsSync(withTs)) return withTs;
  }
  return resolved;
}

export default defineConfig({
  plugins: [
    svelte(),
    // Plugin to handle @/ imports context-sensitively across packages
    {
      name: 'monorepo-at-alias',
      resolveId(id, importer) {
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
          return resolveAtSlash(id.slice(2), importer);
        }
        return null;
      },
    },
  ],
  server: {
    port: 5173,
  },
});
