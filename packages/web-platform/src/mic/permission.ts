export type MicPermissionState =
  | 'unknown'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface MicStreamHandle {
  stream: MediaStream;
  stop: () => void;
}

/**
 * Request mic access. Returns a MediaStream if granted; throws on denial/unavailability.
 * The caller is responsible for calling `stop()` when done to release the mic.
 */
export async function requestMicStream(): Promise<MicStreamHandle> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('Microphone API unavailable in this browser');
    (e as Error & { code?: string }).code = 'unavailable';
    throw e;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // we care about pitch, not loudness
      channelCount: 1,
    },
    video: false,
  });

  return {
    stream,
    stop() {
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

/**
 * Query the current mic permission state without prompting.
 * Returns 'unavailable' when the Permissions API is absent (old browsers / partial
 * Safari support paths). Falls back to 'unknown' when the API exists but throws
 * (e.g. 'microphone' not in the allowlist for that browser).
 */
export async function queryMicPermission(): Promise<MicPermissionState> {
  if (!navigator.permissions) return 'unavailable';
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    if (status.state === 'prompt') return 'prompt';
  } catch {
    // Some browsers (Safari) lack Permissions API for microphone.
  }
  return 'unknown';
}
