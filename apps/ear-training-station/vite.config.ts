import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
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
    SvelteKitPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      manifest: {
        name: 'Ear Training Station',
        short_name: 'Ear Training',
        description: 'Practice singing scale degrees by ear',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache all SvelteKit-generated app shell assets.
        // `html` is intentionally omitted here — the index.html SPA shell is
        // added to the precache via `kit.adapterFallback` + `kit.spa` below,
        // which uses the version.json hash as the revision so the cached shell
        // is invalidated on every new SW deployment.
        globPatterns: ['client/**/*.{js,css,ico,png,svg,webmanifest}'],
        // navigateFallback must be '/' — the URL the server actually serves the
        // HTML shell at. Combined with spa.fallbackMapping: '/', Workbox precaches
        // {url: '/'} and NavigationRoute serves '/' for all offline navigations.
        navigateFallback: '/',
        runtimeCaching: [
          {
            // Cache TensorFlow Hub model shards loaded by speech-commands at runtime.
            urlPattern: /^https:\/\/(tfhub\.dev|storage\.googleapis\.com\/tfjs-models)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tfjs-models-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      kit: {
        // adapter-static uses 'static' as the assets dir by default.
        assets: 'static',
        // Tell SvelteKitPWA that adapter-static uses index.html as the SPA
        // fallback. Combined with spa.fallbackMapping: '/', the plugin adds
        // {url: '/', revision: <hash-of-version.json>} to the precache manifest
        // so the NavigationRoute can serve the HTML shell offline.
        // The revision is re-derived from version.json on every build, ensuring
        // stale cached shells are replaced when a new SW is deployed.
        adapterFallback: 'index.html',
        spa: {
          // fallbackMapping: '/' causes the precache entry to use '/' as the
          // URL (not 'index.html'), which the preview / production server
          // actually serves. Without this, Workbox would try to precache
          // /index.html which returns 404 on the static server.
          fallbackMapping: '/',
        },
      },
      devOptions: {
        // Enable in dev only if you want to test SW registration locally.
        // Keep disabled to avoid SW hijacking HMR in day-to-day development.
        enabled: false,
      },
    }),
  ],
  server: {
    fs: { allow: ['..', '../..'] },
  },
});
