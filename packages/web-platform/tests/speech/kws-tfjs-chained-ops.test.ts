import { describe, it, expect } from 'vitest';

/**
 * Regression test for GitHub #156.
 *
 * speech-commands@0.5.4 calls `tensor.argMax(-1)` on every inference frame.
 * That chained method is only registered on Tensor.prototype when the
 * `register_all_chained_ops` side-effect module is imported. The tfjs
 * backends (webgl / cpu) do NOT register chained ops — they only register
 * kernels. Without the explicit chained-ops import in kws-loader.ts every
 * KWS frame fails with `o.argMax is not a function` and no digit is ever
 * emitted.
 *
 * Importing the loader here executes its module-level side-effect imports,
 * which must attach `argMax` (and the rest of the chained ops) to the
 * Tensor prototype. Without the fix this assertion fails.
 */
describe('kws-loader installs tfjs chained ops on import', () => {
  it('Tensor.prototype.argMax is defined after importing kws-loader', async () => {
    // Side-effect import: this executes the register_all_chained_ops hooks.
    await import('../../src/speech/kws-loader');

    const tfCore = await import('@tensorflow/tfjs-core');
    // Tensor class is the recipient of the chained-op prototype assignments.
    // No tensor instance is constructed to avoid triggering backend-selection
    // side effects under jsdom (which logs noisy warnings but isn't needed
    // for this prototype check).
    const TensorClass = tfCore.Tensor as unknown as { prototype: { argMax?: unknown } };
    expect(typeof TensorClass.prototype.argMax).toBe('function');
  });
});
