import { describe, it, expect, vi, beforeEach } from 'vitest';

// Block the heavy tfjs side-effect imports that kws-loader.ts pulls in at the
// module level. These must be mocked BEFORE kws-loader loads, which vi.mock's
// hoisting guarantees.
vi.mock('@tensorflow-models/speech-commands', () => ({}));
vi.mock('@tensorflow/tfjs-backend-webgl', () => ({}));
vi.mock('@tensorflow/tfjs-backend-cpu', () => ({}));

// Mock kws-loader using a path relative to the test file. This is reliable:
// vitest resolves it to an absolute path that matches any import of the same
// file, regardless of whether it came via './' relative or '@/' alias.
vi.mock('../../src/speech/kws-loader', () => ({
  loadKwsRecognizer: vi.fn(() =>
    Promise.resolve({
      wordLabels: () => [
        '_background_noise_', '_unknown_',
        'one', 'two', 'three', 'four', 'five', 'six', 'seven',
        'eight', 'nine', 'zero',
      ],
      listen: vi.fn(() => Promise.resolve(undefined)),
      stopListening: vi.fn(() => Promise.resolve(undefined)),
    }),
  ),
}));

// Dynamic import of the module under test AFTER mocks are in place.
const { startKeywordSpotter } = await import('../../src/speech/keyword-spotter');

describe('startKeywordSpotter threshold safety', () => {
  beforeEach(async () => {
    // Drain any active handle to reset module-level state between tests.
    try {
      const handle = await startKeywordSpotter();
      await handle.stop();
    } catch { /* already idle */ }
  });

  it('returns same handle for identical thresholds', async () => {
    const h1 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    const h2 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    expect(h1).toBe(h2);
    await h1.stop();
  });

  it('returns same handle when both use defaults', async () => {
    const h1 = await startKeywordSpotter();
    const h2 = await startKeywordSpotter();
    expect(h1).toBe(h2);
    await h1.stop();
  });

  it('throws when called with different probabilityThreshold', async () => {
    const h1 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    await expect(
      startKeywordSpotter({ probabilityThreshold: 0.5 }),
    ).rejects.toThrow(/different.*threshold/i);
    await h1.stop();
  });

  it('throws when called with different minConfidence', async () => {
    const h1 = await startKeywordSpotter({ minConfidence: 0.9 });
    await expect(
      startKeywordSpotter({ minConfidence: 0.5 }),
    ).rejects.toThrow(/different.*threshold/i);
    await h1.stop();
  });

  it('allows different thresholds after stop', async () => {
    const h1 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    await h1.stop();
    const h2 = await startKeywordSpotter({ probabilityThreshold: 0.5 });
    expect(h2).toBeDefined();
    await h2.stop();
  });
});
