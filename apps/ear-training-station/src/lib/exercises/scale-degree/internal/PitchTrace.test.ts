import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import PitchTrace from './PitchTrace.svelte';

describe('PitchTrace', () => {
  it('renders an SVG with a target band and an empty polyline when no frames', () => {
    const { container } = render(PitchTrace, {
      frames: [],
      targetDegree: 5,
      windowStartMs: 0,
      windowDurationMs: 5000,
      getCurrentTime: () => 0,
    });
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('.target-band')).toBeTruthy();
    const polyline = container.querySelector('polyline.sung');
    expect(polyline?.getAttribute('points') ?? '').toBe('');
  });

  it('builds a polyline from confident frames', () => {
    const { container } = render(PitchTrace, {
      frames: [
        { at_ms: 100, hz: 392, confidence: 0.9 },
        { at_ms: 200, hz: 392, confidence: 0.9 },
      ],
      targetDegree: 5,
      windowStartMs: 0,
      windowDurationMs: 5000,
      getCurrentTime: () => 0,
    });
    const polyline = container.querySelector('polyline.sung');
    const pointsAttr = polyline?.getAttribute('points') ?? '';
    expect(pointsAttr.split(' ').filter(Boolean).length).toBe(2);
  });

  it('skips frames with confidence below threshold', () => {
    const { container } = render(PitchTrace, {
      frames: [
        { at_ms: 100, hz: 392, confidence: 0.9 },
        { at_ms: 150, hz: 0, confidence: 0.1 },
        { at_ms: 200, hz: 392, confidence: 0.9 },
      ],
      targetDegree: 5,
      windowStartMs: 0,
      windowDurationMs: 5000,
      getCurrentTime: () => 0,
    });
    const polyline = container.querySelector('polyline.sung');
    const pointsAttr = polyline?.getAttribute('points') ?? '';
    expect(pointsAttr.split(' ').filter(Boolean).length).toBe(2);
  });
});
