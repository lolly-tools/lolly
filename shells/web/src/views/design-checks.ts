// SPDX-License-Identifier: MPL-2.0
/**
 * The Design checks that need a painted canvas, in one place (plan 291, W1).
 *
 * `runDesignChecks` is what the export panel shows ("Before you export") and what
 * `window.lolly.document.check()` hands a headless caller (`lolly check`, through
 * the browser tier): the structure report, then the mounted audit (clipping,
 * contrast, font coverage) once fonts are ready. Both callers get the same result
 * from the same code, so the CLI and the app cannot disagree about a canvas.
 *
 * `checkDocumentSurface` is the page hook's body. It answers only for the Design
 * tool, waits until the canvas shows the current model (the runtime settled, no
 * paint pending, fonts ready), then runs the checks. The audit skips layers that are
 * not painted, so a canvas read too early would look clean: the wait is the point.
 *
 * Brand findings are not here. The export panel adds them with its own fix actions
 * (brand-check-rows.ts), and the headless caller checks the brand in Node against
 * the design system it resolved, so the page never decides which system applies.
 */
import { inspectDesignV1 } from '@lolly-tools/core';
import type { DesignInspectionV1 } from '@lolly-tools/core';
import { auditMountedDesign, type MountedDesignAudit, type MountedFontStyle } from './design-mounted-audit.ts';

/** The page hook's answer format, read by packages/node-shell/src/check.ts. */
export const DESIGN_CHECK_PAGE_FORMAT = 'lolly-design-check-page' as const;

export interface DesignChecksOptions {
  /** Font coverage: true when the face that renders `style` covers `text`. */
  resolveFont?: (style: MountedFontStyle, text: string) => Promise<boolean>;
  /** The canvas size for the structure report, when the caller knows the size. */
  width?: number;
  height?: number;
  /** Called with the structure report before the mounted audit starts. */
  onStructure?: (report: DesignInspectionV1) => void;
}

export interface DesignChecksResult {
  structure: DesignInspectionV1;
  mounted: MountedDesignAudit;
}

/** Structure first, then the mounted audit over the painted canvas once fonts are ready. */
export async function runDesignChecks(
  canvasEl: HTMLElement,
  boxes: unknown,
  opts: DesignChecksOptions = {}
): Promise<DesignChecksResult> {
  const structure = inspectDesignV1(boxes, {
    ...(opts.width ? { width: opts.width } : {}),
    ...(opts.height ? { height: opts.height } : {}),
  });
  opts.onStructure?.(structure);
  try {
    await document.fonts?.ready;
  } catch {
    /* the mounted geometry still answers */
  }
  const mounted = await auditMountedDesign(canvasEl, structure, opts.resolveFont ? { resolveFont: opts.resolveFont } : {});
  return { structure, mounted };
}

/** What `window.lolly.document.check()` returns for a Design canvas. */
export interface DesignCheckPageResult {
  format: typeof DESIGN_CHECK_PAGE_FORMAT;
  version: 1;
  toolId: string;
  /** Layers in the structure report the page checked, so a caller can tell it saw the same document. */
  layers: number;
  /** Layer ids the canvas painted, so a caller can tell a layer that was checked from one never drawn. */
  painted: number;
  structure: DesignInspectionV1['findings'];
  mounted: MountedDesignAudit;
  /** False when the wait for a settled canvas ran out: the audit then read whatever had painted. */
  settled: boolean;
}

/** What the hook needs from the mounted tool view. */
export interface DesignCheckSurfaceDeps {
  toolId: string;
  canvasEl: HTMLElement | null;
  /** The current `boxes` value. */
  boxes: () => unknown;
  /** Resolves once no hook run is still out (engine runtime `whenSettled`). */
  whenSettled: () => Promise<void>;
  /** True while a paint is queued or a frame is waiting to be drawn. */
  paintPending: () => boolean;
  resolveFont?: DesignChecksOptions['resolveFont'];
  /** Longest wait for a settled canvas, in ms. */
  settleTimeoutMs?: number;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });

/** Wait until the runtime is settled and no paint is pending, twice in a row a frame apart. */
async function settledCanvas(deps: DesignCheckSurfaceDeps): Promise<boolean> {
  const deadline = Date.now() + (deps.settleTimeoutMs ?? 30_000);
  let quiet = 0;
  while (Date.now() < deadline) {
    const left = Math.max(0, deadline - Date.now());
    const settled = await Promise.race([
      deps.whenSettled().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), left)),
    ]);
    if (!settled) return false;
    await nextFrame();
    if (deps.paintPending()) {
      quiet = 0;
      continue;
    }
    quiet += 1;
    if (quiet >= 2) return true;
  }
  return false;
}

/**
 * The page hook: null for any tool but Design, or when there is no canvas to read.
 * Read-only: it never changes the document.
 */
export async function checkDocumentSurface(deps: DesignCheckSurfaceDeps): Promise<DesignCheckPageResult | null> {
  if (deps.toolId !== 'design' || !deps.canvasEl) return null;
  const settled = await settledCanvas(deps);
  const canvasEl = deps.canvasEl;
  const { structure, mounted } = await runDesignChecks(canvasEl, deps.boxes(), {
    ...(deps.resolveFont ? { resolveFont: deps.resolveFont } : {}),
  });
  const painted = new Set<string>();
  for (const el of canvasEl.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]'))
    if (el.dataset.boxId) painted.add(el.dataset.boxId);
  return {
    format: DESIGN_CHECK_PAGE_FORMAT,
    version: 1,
    toolId: deps.toolId,
    layers: structure.layers.length,
    painted: painted.size,
    structure: structure.findings,
    mounted,
    settled,
  };
}
