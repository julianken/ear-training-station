/// <reference types="vite/client" />

// Ambient declaration for the virtual module emitted by vite-plugin-pwa.
// vite-plugin-pwa is a transitive dep (via @vite-pwa/sveltekit) and not
// directly resolvable by path, so we declare the module shape inline here.
declare module 'virtual:pwa-register' {
  export function registerSW(options?: { immediate?: boolean }): (reloadPage?: boolean) => Promise<void>;
}
