// SPDX-License-Identifier: MPL-2.0
/**
 * Fail-loud checkpoint for the Node shells (CLI + TUI).
 *
 * The single most corrosive behaviour in the headless shells was silent success: a
 * render could fail (a lifecycle hook throws, a required host capability is missing)
 * yet the shell would still write a valid-but-empty file, print "✓ Wrote", and exit 0
 * — so a script or CI job could not tell the render failed. This checkpoint converts
 * that into an honest, catchable error BEFORE any file is written.
 *
 * Why here (not in the engine): engine/src/runtime.ts deliberately RECORDS an onInit
 * failure in `runtime.hookErrors` and does NOT throw, because the web GUI relies on
 * staying alive to show a canvas-error banner (locked by tests/runtime-hooks.test.ts).
 * The honest-failure decision is the shell's: a terminal shell has no banner, so the
 * only way to signal is a non-zero exit + a clear message. This is that decision, shared
 * so the CLI and TUI can never drift.
 *
 * Two signals, in order of precision:
 *   1. hookErrors (PRIMARY, format-agnostic) — a lifecycle hook actually threw. Catches
 *      brand-lockup with no host.text, and any other unfulfilled dependency.
 *   2. degenerate SVG (BACKSTOP) — a hookless empty render (no size, no drawable
 *      content). Narrow by construction so it can never flag a legitimate tiny icon.
 *
 * NOT used: a byte-size threshold. An onInit-failed native-<svg> tool rasterised to PNG
 * (Tier A resvg) yields a full-size BLANK png, not a tiny one — only the hookErrors
 * signal catches that, which is why it is the primary check for every format.
 *
 * IMPORTANT: only apply this to output the shell's OWN runtime produced (the DOM-free
 * path and the Tier-A resvg path). Do NOT apply it to the Tier-B browser path: that
 * re-renders the tool in a real web shell whose host HAS the capability, so the node
 * runtime's hookErrors don't describe those bytes (and renderViaWebShell already fails
 * loud if the browser produced nothing).
 */

/** A hook failure as recorded by the engine runtime (runtime.hookErrors). */
export interface HookErrorLike {
  hook: string;
  message: string;
}

export type RenderFailureReason = 'hook-failed' | 'degenerate-svg';

/**
 * A render the node shell must not report as success. Its message deliberately avoids
 * the substrings the TUI's HTML-fallback branch keys on (`<svg>`, `requires an`,
 * `browser engine` — see shells/tui/src/views/ToolView.tsx), so a genuinely-broken
 * render is surfaced as an error rather than silently rewritten to an HTML file.
 */
export class RenderIntegrityError extends Error {
  readonly reason: RenderFailureReason;
  readonly hookErrors: HookErrorLike[];
  constructor(reason: RenderFailureReason, message: string, hookErrors: HookErrorLike[] = []) {
    super(message);
    this.name = 'RenderIntegrityError';
    this.reason = reason;
    this.hookErrors = hookErrors;
  }
}

interface AssertRenderOkArgs {
  hookErrors?: HookErrorLike[] | null;
  format: string;
  bytes: Uint8Array;
}

/**
 * Throw RenderIntegrityError if the produced output cannot be trusted as a successful
 * render. Call it AFTER the bytes are finalized and BEFORE writing them — the throw
 * means no file is written and the process exits non-zero (CLI) / the export is refused
 * with a visible error (TUI).
 */
export function assertRenderOk({ hookErrors, format, bytes }: AssertRenderOkArgs): void {
  // PRIMARY: a lifecycle hook threw. The runtime swallowed it (canvas is likely blank),
  // so the output is untrustworthy regardless of format.
  if (hookErrors && hookErrors.length) {
    const detail = hookErrors.map(e => `${e.hook} failed: ${e.message}`).join('; ');
    throw new RenderIntegrityError(
      'hook-failed',
      `render produced no usable output — ${detail}. No file was written.`,
      hookErrors,
    );
  }

  // BACKSTOP: an SVG with no size AND no drawable content (a hookless empty render).
  if (isSvgFormat(format) && isDegenerateSvg(bytes)) {
    throw new RenderIntegrityError(
      'degenerate-svg',
      'render produced no usable output — the SVG has no size and no drawable content ' +
      '(the tool likely failed to render). No file was written.',
    );
  }
}

function isSvgFormat(format: string): boolean {
  return format.toLowerCase() === 'svg';
}

// Allowed non-drawing children of a root <svg> — provenance/metadata/setup elements
// that carry no visible geometry. If a degenerate <svg> holds ONLY these, it's empty.
const NON_DRAWING = /<(?:title|desc|metadata|style|script|defs)\b[\s\S]*?<\/(?:title|desc|metadata|style|script|defs)>/gi;

/**
 * A root <svg> is degenerate IFF all three hold:
 *   (a) no positive-area viewBox (absent, or its 3rd/4th numbers aren't > 0), AND
 *   (b) no positive width/height attribute, AND
 *   (c) no drawable child (every element inside is title/desc/metadata/style/script/defs).
 * Pure string work (no jsdom), so it runs in the lean CLI and the MCP bundle. Narrow by
 * construction: a real 1×1 icon (viewBox="0 0 1 1" + a <path>) satisfies neither (a) nor
 * (c), so it can never be flagged.
 */
export function isDegenerateSvg(bytes: Uint8Array): boolean {
  const s = utf8(bytes);
  const open = s.match(/<svg\b[^>]*>/i);
  if (!open) return false; // can't judge → defer to the hookErrors signal
  const tag = open[0];

  // (a) positive-area viewBox?
  const vb = tag.match(/viewBox\s*=\s*["']([^"']*)["']/i);
  let positiveViewBox = false;
  if (vb) {
    const nums = (vb[1]!.trim().match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    positiveViewBox = nums.length === 4 && Number.isFinite(nums[2]!) && Number.isFinite(nums[3]!) && nums[2]! > 0 && nums[3]! > 0;
  }
  if (positiveViewBox) return false;

  // (b) positive width AND positive height attribute?
  const w = attrNum(tag, 'width');
  const h = attrNum(tag, 'height');
  if (w > 0 && h > 0) return false;

  // (c) any drawable child? Strip the non-drawing blocks, then look for any element tag.
  const body = s.slice((open.index ?? 0) + tag.length).replace(/<\/svg>[\s\S]*$/i, '');
  const stripped = body.replace(NON_DRAWING, '');
  const hasDrawable = /<[a-zA-Z]/.test(stripped);
  return !hasDrawable;
}

function attrNum(tag: string, name: string): number {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  if (!m) return NaN;
  const n = parseFloat(m[1]!); // handles "210mm", "100%", "0", "" → NaN
  return Number.isFinite(n) ? n : NaN;
}

function utf8(bytes: Uint8Array): string {
  // Only the leading <svg …> tag + element names matter, all ASCII — a lossy decode is
  // fine and avoids a TextDecoder dependency assumption.
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8');
}
