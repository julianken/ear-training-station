import { writeFileSync } from 'node:fs';
const sr = 16000, sec = 5, f = 440;
const n = sr * sec;
const buf = Buffer.alloc(44 + n * 2);
// WAV header
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const s = Math.sin(2 * Math.PI * f * i / sr) * 0.5 * 32767;
  buf.writeInt16LE(Math.round(s), 44 + i * 2);
}
writeFileSync('tests/harness/fixtures/a4-sine.wav', buf);
console.log('wrote tests/harness/fixtures/a4-sine.wav');
