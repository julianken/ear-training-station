/** Stub for $app/navigation used in vitest (no SvelteKit runtime in tests). */
import { vi } from 'vitest';

export const goto = vi.fn().mockResolvedValue(undefined);
export const invalidate = vi.fn().mockResolvedValue(undefined);
export const invalidateAll = vi.fn().mockResolvedValue(undefined);
export const preloadData = vi.fn().mockResolvedValue(undefined);
export const preloadCode = vi.fn().mockResolvedValue(undefined);
export const pushState = vi.fn();
export const replaceState = vi.fn();
export const back = vi.fn();
export const forward = vi.fn();
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
export const onNavigate = vi.fn();
