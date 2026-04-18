import type { Page } from '@playwright/test';

export type AudioOverride =
  | { kind: 'tone'; hz: number; amplitude?: number }
  | { kind: 'silence' }
  | { kind: 'error'; code: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' };

/**
 * Install a synthetic getUserMedia in the page before any app code runs.
 * Must be called BEFORE page.goto() — uses page.addInitScript.
 *
 * Subsequent calls to navigator.mediaDevices.getUserMedia() from app code OR from third-party
 * libraries (e.g., speech-commands) will receive a MediaStream built per the config
 * (or a thrown error if kind==='error').
 *
 * Implementation replaces MediaDevices.prototype.getUserMedia (not navigator.mediaDevices.getUserMedia)
 * so overrides reach callers that bind the method late.
 */
export async function overrideGetUserMediaWith(page: Page, override: AudioOverride): Promise<void> {
  await page.addInitScript((cfg: AudioOverride) => {
    // Lazy AudioContext + destination, built on first getUserMedia call.
    let ctx: AudioContext | null = null;
    let destNode: MediaStreamAudioDestinationNode | null = null;
    let currentSourceNode: OscillatorNode | ConstantSourceNode | null = null;

    function buildSourceNode(audioCfg: AudioOverride, audioCtx: AudioContext, dest: MediaStreamAudioDestinationNode): OscillatorNode | ConstantSourceNode | null {
      if (audioCfg.kind === 'tone') {
        const osc = audioCtx.createOscillator();
        osc.frequency.value = audioCfg.hz;
        const gain = audioCtx.createGain();
        gain.gain.value = audioCfg.amplitude ?? 0.5;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        return osc;
      } else if (audioCfg.kind === 'silence') {
        const constSrc = audioCtx.createConstantSource();
        constSrc.offset.value = 0;
        constSrc.connect(dest);
        constSrc.start();
        return constSrc;
      }
      // 'error' kind — no node to build
      return null;
    }

    function rotate(newCfg: AudioOverride): void {
      if (!ctx || !destNode) return;
      if (currentSourceNode) {
        try { currentSourceNode.stop(); } catch { /* already stopped */ }
        try { currentSourceNode.disconnect(); } catch { /* already disconnected */ }
        currentSourceNode = null;
      }
      currentSourceNode = buildSourceNode(newCfg, ctx, destNode);
    }

    function end(): void {
      if (!destNode) return;
      const stream = destNode.stream;
      for (const track of stream.getAudioTracks()) {
        track.dispatchEvent(new Event('ended'));
      }
    }

    // Save original for video passthrough.
    const originalGetUserMedia = MediaDevices.prototype.getUserMedia.bind(navigator.mediaDevices);

    MediaDevices.prototype.getUserMedia = async function (constraints?: MediaStreamConstraints): Promise<MediaStream> {
      if (cfg.kind === 'error') {
        const err = Object.assign(new Error(cfg.code), { name: cfg.code });
        throw err;
      }

      if (constraints?.audio) {
        // Lazy-init the AudioContext and destination node.
        if (!ctx) {
          ctx = new AudioContext();
          await ctx.resume();
          destNode = ctx.createMediaStreamDestination();
          currentSourceNode = buildSourceNode(cfg, ctx, destNode);

          // Expose control surface for rotateSource / simulateMicLoss helpers.
          (window as unknown as Record<string, unknown>)['__e2eSyntheticAudio'] = {
            stream: destNode.stream,
            ctx,
            rotate,
            end,
          };
        }

        return destNode!.stream;
      }

      // Video-only or no audio constraint — fall through to original.
      return originalGetUserMedia(constraints);
    };
  }, override);
}

/**
 * Change the audio source of the active synthetic stream WITHOUT breaking the MediaStream.
 * Existing tracks continue; the underlying oscillator/source is swapped in place.
 * No-op if no synthetic stream is currently installed.
 */
export async function rotateSource(page: Page, override: AudioOverride): Promise<void> {
  await page.evaluate((cfg: AudioOverride) => {
    const surface = (window as unknown as Record<string, unknown>)['__e2eSyntheticAudio'] as
      | { rotate: (cfg: AudioOverride) => void }
      | undefined;
    if (surface) {
      surface.rotate(cfg);
    }
  }, override);
}

/**
 * Simulate the mic going away mid-session. Dispatches an 'ended' event on every audio track
 * of the currently-active synthetic stream. Does NOT call track.stop() — per MDN, stop()
 * does NOT fire 'ended' automatically (see https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event).
 * No-op if no synthetic stream is currently installed.
 */
export async function simulateMicLoss(page: Page): Promise<void> {
  await page.evaluate(() => {
    const surface = (window as unknown as Record<string, unknown>)['__e2eSyntheticAudio'] as
      | { end: () => void }
      | undefined;
    if (surface) {
      surface.end();
    }
  });
}
