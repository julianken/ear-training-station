import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webPlatformSrc = fileURLToPath(new URL('./src', import.meta.url));
const coreSrc = fileURLToPath(new URL('../core/src', import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/helpers/test-setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: [
      // cross-package: @ear-training/core/* → core src (must come before @/ rule)
      {
        find: /^@ear-training\/core\/(.*)/,
        replacement: path.join(coreSrc, '$1'),
      },
      // @/ in web-platform files → web-platform src
      // @/ in core files (when accessed transitively) → core src
      {
        find: '@/',
        replacement: webPlatformSrc + '/',
        customResolver(id, importer) {
          if (importer && importer.startsWith(coreSrc)) {
            // Importing file is in core — strip the web-platform prefix and use core's src
            // id has already been replaced: webPlatformSrc + '/' + originalPath
            const suffix = id.slice(webPlatformSrc.length + 1);
            return path.join(coreSrc, suffix);
          }
          // Default: use already-replaced id (web-platform src)
          return id;
        },
      },
    ],
  },
});
