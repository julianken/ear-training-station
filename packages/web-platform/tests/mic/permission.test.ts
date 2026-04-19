import { describe, it, expect, afterEach } from 'vitest';
import { queryMicPermission } from '@/mic/permission';

describe('queryMicPermission', () => {
  const originalPermissions = navigator.permissions;

  afterEach(() => {
    Object.defineProperty(navigator, 'permissions', {
      value: originalPermissions,
      configurable: true,
      writable: true,
    });
  });

  it("returns 'unavailable' when navigator.permissions is absent", async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const result = await queryMicPermission();
    expect(result).toBe('unavailable');
  });

  it("returns 'granted' when the Permissions API reports granted", async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: async () => ({ state: 'granted' }),
      },
      configurable: true,
      writable: true,
    });

    const result = await queryMicPermission();
    expect(result).toBe('granted');
  });

  it("returns 'denied' when the Permissions API reports denied", async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: async () => ({ state: 'denied' }),
      },
      configurable: true,
      writable: true,
    });

    const result = await queryMicPermission();
    expect(result).toBe('denied');
  });

  it("returns 'prompt' when the Permissions API reports prompt", async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: async () => ({ state: 'prompt' }),
      },
      configurable: true,
      writable: true,
    });

    const result = await queryMicPermission();
    expect(result).toBe('prompt');
  });

  it("returns 'unknown' when the Permissions API throws", async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: async () => { throw new Error('microphone not in allowlist'); },
      },
      configurable: true,
      writable: true,
    });

    const result = await queryMicPermission();
    expect(result).toBe('unknown');
  });
});
