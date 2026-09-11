/**
 * The editor-state link grammar (plans/176 v1): the object form `_ui=` plus the three
 * shorthand params, parsed into the DeepLinkState free-canvas applies at mount. Editor
 * state, never document state - all of it lives in the `_` namespace the engine
 * reserves outright (engine/src/url-mode.ts skips the prefix), so none of these can
 * ever shadow a tool input, and syncUrl drops them on the first edit.
 *
 * `_ui` is base64url(JSON) of `{ v: 1, sel?: string[], t?: number, panel?: string }`.
 * Unknown keys are ignored with one console note, so the object can grow additively
 * and a newer link opens in an older shell applying what it can. The shorthands stay
 * first-class and WIN on conflict - a hand-edited `_t=2` over a pasted `_ui` blob does
 * what it says.
 *
 * The same wire object drives the runtime channel views/tool.ts registers while a
 * canvas editor is mounted: `window.lolly.ui.getState()/apply(state)`, and a
 * `postMessage({ type: 'lolly:ui', state })` from an embedding page.
 */

/** Wire form: versioned so the object can grow without breaking older shells. */
export interface UiState {
  v: 1;
  /** Box ids to select; unknown ids are ignored at apply time. */
  sel?: string[];
  /** Playhead position in seconds - opens the timeline and parks the playhead there. */
  t?: number;
  /** A panel to open over the selection: `choreograph` today. */
  panel?: string;
}

/** Applied form - the field names free-canvas's DeepLinkState uses. */
export interface EditorState {
  select?: string[];
  playhead?: number;
  panel?: string;
}

/**
 * Every editor-state param, for the docs contract test (the RESERVED test's pattern):
 * this list and the docs/url-mode.md "On a tool route" paragraph must name the same
 * set, so a param can neither ship undocumented nor stay documented after it retires.
 */
export const EDITOR_STATE_PARAMS = ['_sel', '_t', '_panel', '_ui'] as const;

const KNOWN_KEYS = new Set(['v', 'sel', 't', 'panel']);

/**
 * Validate an untrusted wire object (a decoded `_ui`, a postMessage body) into the
 * applied form. `undefined` means "not a v1 UiState at all"; junk-typed fields inside
 * a valid envelope are dropped individually.
 */
export function coerceUiState(raw: unknown): EditorState | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return undefined;
  const unknown = Object.keys(o).filter((k) => !KNOWN_KEYS.has(k));
  if (unknown.length) console.info('[editor-state] ignoring unknown keys: ' + unknown.join(', '));
  const out: EditorState = {};
  if (Array.isArray(o.sel)) {
    const sel = o.sel.filter((x): x is string => typeof x === 'string' && !!x);
    if (sel.length) out.select = sel;
  }
  if (typeof o.t === 'number' && Number.isFinite(o.t)) out.playhead = Math.max(0, o.t);
  if (typeof o.panel === 'string' && o.panel) out.panel = o.panel;
  return out;
}

/** Read the editor-state params off a link: `_ui` first, shorthands overlaid on top. */
export function parseEditorState(flags: { get(k: string): string | null; has(k: string): boolean }): EditorState {
  let out: EditorState = {};
  const blob = flags.get('_ui');
  if (blob) {
    try {
      const json = atob(blob.replace(/-/g, '+').replace(/_/g, '/'));
      out = coerceUiState(JSON.parse(json)) ?? {};
    } catch {
      console.info('[editor-state] unreadable _ui param ignored');
    }
  }
  const sel = (flags.get('_sel') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (sel.length) out.select = sel;
  if (flags.has('_t')) {
    const t = Number(flags.get('_t'));
    if (Number.isFinite(t)) out.playhead = Math.max(0, t);
  }
  const panel = flags.get('_panel');
  if (panel) out.panel = panel;
  return out;
}

/** The inverse: a UiState as a `_ui=` value (base64url, no padding). */
export function encodeUiState(state: UiState): string {
  return btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
