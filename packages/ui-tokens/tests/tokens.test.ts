import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colors } from '@/tokens';

describe('ui-tokens agreement', () => {
  it('tokens.css declares every color from tokens.ts with matching value', () => {
    const cssPath = fileURLToPath(new URL('../src/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');

    for (const [name, hex] of Object.entries(colors)) {
      const escaped = hex.replace('#', '\\#');
      const pattern = new RegExp(`--${name}:\\s*${escaped}\\s*;`);
      expect(css, `Missing or wrong --${name}: ${hex}`).toMatch(pattern);
    }
  });

  it('tokens.css has no extra custom properties not in tokens.ts', () => {
    const cssPath = fileURLToPath(new URL('../src/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');
    const cssVars = [...css.matchAll(/--(\w+):/g)].map((m) => m[1]);
    const tsKeys = Object.keys(colors);
    for (const v of cssVars) {
      expect(tsKeys, `Extra CSS var --${v} not in tokens.ts`).toContain(v);
    }
  });
});
