import type { Page, JSHandle } from '@playwright/test';

/**
 * Structural interface that an app exposes for e2e control. Apps expose a shim with a subset of
 * these methods; helpers probe presence before calling.
 */
export interface ControllerHandle<TState = unknown> {
  /** Return a structured-clonable snapshot of the controller's state. Apps must deep-clone or
   *  use framework-specific snapshot (Svelte 5: $state.snapshot) before returning. */
  getState?(): TState;
  /** Force the controller into a specific state. */
  _forceState?(state: TState): void;
  /** Inject a pitch frame as though it arrived from the detector. */
  _onPitchFrame?(frame: { hz: number; confidence: number }): void;
  /** Any other app-specific methods may be present. */
  [extra: string]: unknown;
}

export interface ControllerOpts {
  /** window[globalName] where the shim lives. Default: '__sessionControllerForTest'. */
  globalName?: string;
  /** Max milliseconds to wait for the controller to mount. Default: 10000. */
  timeoutMs?: number;
}

/**
 * Wait until window[globalName] is a non-null object. Returns a JSHandle scoped to it.
 * Throws if the controller never appears within timeoutMs.
 */
export async function waitForController<TState = unknown>(
  page: Page,
  opts?: ControllerOpts,
): Promise<JSHandle<ControllerHandle<TState>>> {
  const globalName = opts?.globalName ?? '__sessionControllerForTest';
  const timeoutMs = opts?.timeoutMs ?? 10000;

  await page.waitForFunction(
    (name: string) => {
      const val = (window as unknown as Record<string, unknown>)[name];
      return val !== null && val !== undefined && typeof val === 'object';
    },
    globalName,
    { timeout: timeoutMs },
  );

  return page.evaluateHandle(
    (name: string) => (window as unknown as Record<string, ControllerHandle<TState>>)[name],
    globalName,
  ) as Promise<JSHandle<ControllerHandle<TState>>>;
}

/**
 * Call window[globalName]._forceState(state). Serializable state objects only
 * (structured-clone must succeed).
 */
export async function forceState<TState>(
  page: Page,
  state: TState,
  opts?: ControllerOpts,
): Promise<void> {
  const globalName = opts?.globalName ?? '__sessionControllerForTest';
  const timeoutMs = opts?.timeoutMs ?? 10000;

  await waitForController(page, { globalName, timeoutMs });

  // Pass name and state as separate args to avoid Playwright's Unboxed<T> tuple constraint.
  await page.evaluate(
    ({ name, s }: { name: string; s: unknown }) => {
      const ctrl = (window as unknown as Record<string, ControllerHandle>)[name];
      if (!ctrl?._forceState) {
        throw new Error(`Controller at window.${name} does not expose _forceState()`);
      }
      ctrl._forceState(s);
    },
    { name: globalName, s: state as unknown },
  );
}

/**
 * Call window[globalName]._onPitchFrame(frame).
 */
export async function injectPitchFrame(
  page: Page,
  frame: { hz: number; confidence: number },
  opts?: ControllerOpts,
): Promise<void> {
  const globalName = opts?.globalName ?? '__sessionControllerForTest';
  const timeoutMs = opts?.timeoutMs ?? 10000;

  await waitForController(page, { globalName, timeoutMs });

  await page.evaluate(
    ({ name, f }: { name: string; f: { hz: number; confidence: number } }) => {
      const ctrl = (window as unknown as Record<string, ControllerHandle>)[name];
      if (!ctrl?._onPitchFrame) {
        throw new Error(`Controller at window.${name} does not expose _onPitchFrame()`);
      }
      ctrl._onPitchFrame(f);
    },
    { name: globalName, f: frame },
  );
}

/**
 * Call window[globalName].getState(). Returns the clonable snapshot.
 * Apps exposing a $state-backed controller should snapshot on the page side before returning.
 */
export async function getSnapshotState<TState = unknown>(
  page: Page,
  opts?: ControllerOpts,
): Promise<TState> {
  const globalName = opts?.globalName ?? '__sessionControllerForTest';
  const timeoutMs = opts?.timeoutMs ?? 10000;

  await waitForController(page, { globalName, timeoutMs });

  return page.evaluate(
    (name: string) => {
      const ctrl = (window as unknown as Record<string, ControllerHandle>)[name];
      if (ctrl?.getState) {
        return ctrl.getState() as TState;
      }
      throw new Error(`Controller at window.${name} does not expose getState()`);
    },
    globalName,
  ) as Promise<TState>;
}
