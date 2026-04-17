import adapter from '@sveltejs/adapter-static';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      pages: 'build',
      assets: 'build',
      strict: true,
    }),
    alias: {
      '$lib': 'src/lib',
      '@': 'src',
      '@ear-training/core/*': `${root}packages/core/src/*`,
      '@ear-training/web-platform/*': `${root}packages/web-platform/src/*`,
    },
  },
};

export default config;
