// This workspace file is supported by vitest 3.x.
// When upgrading to vitest 4.x, migrate to the `test.projects` field in a root vitest.config.ts.
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
]);
