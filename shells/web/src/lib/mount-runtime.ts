// SPDX-License-Identifier: MPL-2.0
/**
 * The single chokepoint every tool runtime in the web shell goes through.
 *
 * WHY IT EXISTS
 * `host.color` (v1.40) and `host.geom` (v1.64) are pure engine math attached
 * verbatim to the bridge so web/CLI/Tauri can never drift - but between them
 * they are ~39 KB gz (the ICC/gamut parsers and the whole bezier/boolean
 * kernel), and nothing in this shell ever reads them. Their only consumers are
 * tool hooks. So bridge/index.ts no longer attaches them eagerly; this module
 * installs them (one dynamic import, cached) immediately before the runtime
 * that will run those hooks exists.
 *
 * Both contracts are SYNCHRONOUS - `deltaE` returns a number, `union` returns a
 * path - so they cannot be wrapped in an async facade the way host.images and
 * host.audio are. A pre-mount await is the only shape that keeps tools seeing a
 * fully synchronous `host.geom.union(...)`.
 *
 * It is also where the WebGPU requirement (plan 295, section 2) holds for every
 * tool. The startup check runs alongside boot, so the gallery, utilities and docs
 * paint before it settles, and they start tools of their own: gallery previews,
 * paged tiles, motion template cards. Every one of those mounts comes through here
 * and waits for the check, and once it has failed none of them runs a hook.
 *
 * THE INVARIANT: no module under shells/web/src may call the engine's
 * `createRuntime` directly. Call this instead. A direct call compiles, typechecks
 * and renders fine - it just silently leaves `host.color`/`host.geom` undefined,
 * and tools feature-detect those, so a colour or vector tool would quietly fall
 * back to its own approximation with no error anywhere. It would also run the
 * tool before the WebGPU check has passed. mount-runtime.test.ts greps the source
 * tree to hold the line.
 */
import { createRuntime } from '@lolly/engine';
import type { HookExecutor } from '@lolly/engine';
import { installToolApis } from '../bridge/index.ts';
import { getWorkerHookExecutor } from '../bridge/hook-worker.ts';
import { webGpuChecked } from './webgpu/device.ts';

type CreateRuntime = typeof createRuntime;

// One shared Worker-isolated executor (a singleton Worker under it), built lazily
// the first time an opted-in tool mounts. Falls back to in-realm on any failure.
let workerExecutor: HookExecutor | null = null;
let strictWorkerExecutor: HookExecutor | null = null;

function needsStrictIsolation(tool: Parameters<CreateRuntime>[0]): boolean {
  return tool.trustClass === 'sideloaded-consented' || tool.trustClass === 'remote-untrusted';
}

function withHookPolicy(
  tool: Parameters<CreateRuntime>[0],
  opts: Parameters<CreateRuntime>[3] | undefined,
  interactive: boolean,
): Parameters<CreateRuntime>[3] | undefined {
  if (needsStrictIsolation(tool)) {
    strictWorkerExecutor ??= getWorkerHookExecutor({ allowInRealmFallback: false });
    return { ...(opts ?? {}), hookExecutor: strictWorkerExecutor };
  }
  if (interactive && typeof Worker !== 'undefined' && wantsWorkerHooks(tool.manifest.id, tool.manifest.isolate)) {
    workerExecutor ??= getWorkerHookExecutor();
    return { ...(opts ?? {}), hookExecutor: workerExecutor };
  }
  return opts;
}

/**
 * Should this mount run its hooks in a Worker (plans/86-worker-isolation-hooks.md
 * M2)? The manifest opt-in (`isolate: true`), OR a dev override - localStorage
 * `lolly.workerHooks` set to the tool's id (or `'1'` for every tool) - used to
 * field-verify a tool in a real browser BEFORE its manifest flag is flipped.
 */
function wantsWorkerHooks(id: string, isolate: boolean | undefined): boolean {
  if (isolate) return true;
  try {
    const flag = typeof localStorage !== 'undefined' ? localStorage.getItem('lolly.workerHooks') : null;
    return flag === '1' || flag === id;
  } catch { return false; }
}

/**
 * `createRuntime`, with `host.color`/`host.geom` guaranteed present (or, if
 * their import failed, deliberately absent - tools feature-detect, and a failed
 * optional API must not block the mount).
 *
 * ALWAYS in-realm - the default for one-shot/non-interactive mounts (thumbnails,
 * previews, exports, session seeding). A one-shot render gains nothing from
 * Worker isolation (the sandbox matters for INTERACTIVE untrusted code, not a
 * trusted mount-render-drop), and routing it through the shared worker would add
 * spawn/RPC latency and leak a worker run per render (these callers drop the
 * runtime without a teardown). The interactive tool view uses
 * createInteractiveToolRuntime instead.
 */
export const createToolRuntime: CreateRuntime = async (tool, host, initialState, opts) => {
  // Rejects with the startup check's WebGpuError once it has failed, so no hook runs.
  await webGpuChecked();
  await installToolApis(host as Parameters<typeof installToolApis>[0]);
  return createRuntime(tool, host, initialState, withHookPolicy(tool, opts, false));
};

/**
 * Like createToolRuntime, but routes an opted-in tool's hooks through the
 * Worker-isolated executor (the manifest `isolate` flag or the `lolly.workerHooks`
 * dev override). Reserved for the LIVE, interactive tool view, which holds the
 * runtime across the session and calls `runtime.destroy()` on unmount - so the
 * worker run is disposed rather than leaked. Non-interactive callers must use
 * createToolRuntime (above), which never touches the worker.
 */
export const createInteractiveToolRuntime: CreateRuntime = async (tool, host, initialState, opts) => {
  await webGpuChecked();
  await installToolApis(host as Parameters<typeof installToolApis>[0]);
  return createRuntime(tool, host, initialState, withHookPolicy(tool, opts, true));
};
