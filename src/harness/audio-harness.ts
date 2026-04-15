import * as Tone from 'tone';
import { TIMBRE_IDS, type TimbreId } from '@/audio/timbres';
import { DEGREES, type Degree, type PitchClass, type Key, type KeyQuality } from '@/types/music';
import { buildCadence } from '@/audio/cadence-structure';
import { buildTarget } from '@/audio/target-structure';
import { ensureAudioContextStarted, playRound } from '@/audio/player';
import { requestMicStream } from '@/mic/permission';
import { startPitchDetector, type PitchDetectorHandle } from '@/pitch/pitch-detector';
import { mapHzToDegree } from '@/pitch/degree-mapping';
import { startKeywordSpotter, type KeywordSpotterHandle } from '@/speech/keyword-spotter';
import type { Register } from '@/types/domain';

// ---------------------------------------------------------------------------
// DOM helpers — fail loudly if an element is missing so bugs surface in dev
// ---------------------------------------------------------------------------

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} not found`);
  return node as T;
}

function setHTML(id: string, html: string): void {
  el(id).textContent = html;
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

const logEl = el<HTMLDivElement>('log');

function log(msg: string): void {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  logEl.textContent = `[${ts}] ${msg}\n` + (logEl.textContent ?? '');
}

// ---------------------------------------------------------------------------
// Populate selects
// ---------------------------------------------------------------------------

const TONICS: PitchClass[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const QUALITIES: KeyQuality[] = ['major', 'minor'];

const timbreSel = el<HTMLSelectElement>('timbre');
const keySel = el<HTMLSelectElement>('key');
const degreeSel = el<HTMLSelectElement>('degree');
const registerSel = el<HTMLSelectElement>('register');

for (const id of TIMBRE_IDS) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = id;
  timbreSel.appendChild(opt);
}

for (const tonic of TONICS) {
  for (const quality of QUALITIES) {
    const opt = document.createElement('option');
    opt.value = `${tonic}-${quality}`;
    opt.textContent = `${tonic} ${quality}`;
    if (tonic === 'C' && quality === 'major') opt.selected = true;
    keySel.appendChild(opt);
  }
}

for (const d of DEGREES) {
  const opt = document.createElement('option');
  opt.value = String(d);
  opt.textContent = String(d);
  if (d === 1) opt.selected = true;
  degreeSel.appendChild(opt);
}

// ---------------------------------------------------------------------------
// Typed read helpers — no `as any`
// ---------------------------------------------------------------------------

function readTimbre(): TimbreId {
  return timbreSel.value as TimbreId;
}

function readKey(): Key {
  const parts = keySel.value.split('-');
  return {
    tonic: parts[0] as PitchClass,
    quality: parts[1] as KeyQuality,
  };
}

function readDegree(): Degree {
  return Number(degreeSel.value) as Degree;
}

function readRegister(): Register {
  return registerSel.value as Register;
}

// ---------------------------------------------------------------------------
// Playback section
// ---------------------------------------------------------------------------

const playBtn = el<HTMLButtonElement>('play');

playBtn.addEventListener('click', async () => {
  await ensureAudioContextStarted();
  const key = readKey();
  const degree = readDegree();
  const register = readRegister();
  const timbreId = readTimbre();

  const cadence = buildCadence(key);
  const target = buildTarget(key, degree, register);

  log(`Playing round — timbre:${timbreId} key:${keySel.value} degree:${degree} register:${register}`);

  const handle = playRound({ timbreId, cadence, target });
  playBtn.disabled = true;
  try {
    await handle.done;
    log('Round complete.');
  } catch (err) {
    log(`Playback error: ${String(err)}`);
  } finally {
    playBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Pitch detection section
// ---------------------------------------------------------------------------

const startPitchBtn = el<HTMLButtonElement>('start-pitch');
const stopPitchBtn = el<HTMLButtonElement>('stop-pitch');

let pitchDetector: PitchDetectorHandle | null = null;
let micHandle: { stream: MediaStream; stop: () => void } | null = null;
let pitchRunning = false; // re-entrancy guard

startPitchBtn.addEventListener('click', async () => {
  // Re-entrancy guard: if already running, do nothing.
  if (pitchRunning) {
    log('Pitch detection already running.');
    return;
  }

  pitchRunning = true;
  startPitchBtn.disabled = true;

  try {
    await ensureAudioContextStarted();
    log('Requesting mic access for pitch detection…');
    micHandle = await requestMicStream();
    // Reuse Tone's AudioContext so repeated Start/Stop cycles don't exhaust Chromium's ~6 concurrent-context limit.
    const ac = Tone.getContext().rawContext as AudioContext;
    pitchDetector = await startPitchDetector({
      audioContext: ac,
      micStream: micHandle.stream,
    });

    pitchDetector.subscribe((frame) => {
      setHTML('pitch-hz', frame.hz > 0 ? frame.hz.toFixed(1) : '—');
      setHTML('pitch-conf', (frame.confidence * 100).toFixed(0) + '%');

      if (frame.hz > 0) {
        const mapping = mapHzToDegree(frame.hz, readKey());
        if (mapping) {
          setHTML('pitch-degree', String(mapping.degree));
          const sign = mapping.cents >= 0 ? '+' : '';
          setHTML('pitch-cents', `${sign}${mapping.cents.toFixed(0)}¢`);
        } else {
          setHTML('pitch-degree', '—');
          setHTML('pitch-cents', '—');
        }
      } else {
        setHTML('pitch-degree', '—');
        setHTML('pitch-cents', '—');
      }
    });

    stopPitchBtn.disabled = false;
    log('Pitch detection started.');
  } catch (err) {
    // Permission denied or other error: show it and restore start button.
    const msg = err instanceof Error ? err.message : String(err);
    log(`Pitch detection error: ${msg}`);
    el('pitch-hz').textContent = 'error';
    el('pitch-hz').classList.add('red');

    // Stop any partially-initialized handles before nulling to avoid leaks.
    try { await pitchDetector?.stop(); } catch { /* ignore cleanup errors */ }
    try { micHandle?.stop(); } catch { /* ignore cleanup errors */ }
    pitchDetector = null;
    micHandle = null;
    pitchRunning = false;
    startPitchBtn.disabled = false;
    stopPitchBtn.disabled = true;
  }
});

stopPitchBtn.addEventListener('click', async () => {
  stopPitchBtn.disabled = true;
  try {
    await pitchDetector?.stop();
    micHandle?.stop();
  } catch (err) {
    log(`Stop pitch error: ${String(err)}`);
  } finally {
    pitchDetector = null;
    micHandle = null;
    pitchRunning = false;
    startPitchBtn.disabled = false;
    setHTML('pitch-hz', '—');
    setHTML('pitch-degree', '—');
    setHTML('pitch-cents', '—');
    setHTML('pitch-conf', '—');
    el('pitch-hz').classList.remove('red');
    log('Pitch detection stopped.');
  }
});

// ---------------------------------------------------------------------------
// Keyword spotter section
// ---------------------------------------------------------------------------

const startKwsBtn = el<HTMLButtonElement>('start-kws');
const stopKwsBtn = el<HTMLButtonElement>('stop-kws');

let kwsHandle: KeywordSpotterHandle | null = null;
let kwsRunning = false; // re-entrancy guard

startKwsBtn.addEventListener('click', async () => {
  // Re-entrancy guard: if already running, do nothing.
  if (kwsRunning) {
    log('Digit recognizer already running.');
    return;
  }

  kwsRunning = true;
  startKwsBtn.disabled = true;

  try {
    log('Loading digit recognizer (first load may take a moment)…');
    kwsHandle = await startKeywordSpotter({ probabilityThreshold: 0.75, minConfidence: 0.75 });

    kwsHandle.subscribe((frame) => {
      if (frame.digit !== null) {
        setHTML('kws-digit', frame.digit);
        setHTML('kws-conf', (frame.confidence * 100).toFixed(0) + '%');
        log(`Digit heard: "${frame.digit}" (${(frame.confidence * 100).toFixed(0)}%)`);
      }
    });

    stopKwsBtn.disabled = false;
    log('Digit recognizer started.');
  } catch (err) {
    // Permission denied or model load failure: show it and restore start button.
    const msg = err instanceof Error ? err.message : String(err);
    log(`Digit recognizer error: ${msg}`);
    el('kws-digit').textContent = 'error';

    // Stop any partially-initialized handle before nulling to avoid leaks.
    try { await kwsHandle?.stop(); } catch { /* ignore cleanup errors */ }
    kwsHandle = null;
    kwsRunning = false;
    startKwsBtn.disabled = false;
    stopKwsBtn.disabled = true;
  }
});

stopKwsBtn.addEventListener('click', async () => {
  stopKwsBtn.disabled = true;
  try {
    await kwsHandle?.stop();
  } catch (err) {
    log(`Stop KWS error: ${String(err)}`);
  } finally {
    kwsHandle = null;
    kwsRunning = false;
    startKwsBtn.disabled = false;
    setHTML('kws-digit', '—');
    setHTML('kws-conf', '—');
    log('Digit recognizer stopped.');
  }
});

log('Harness ready.');
