/** Versioned workspace state. These keys never enter a content share link. */

/** Wire form: versioned so the object can grow without breaking older shells. */
export interface UiState {
  v: 1;
  /** Box ids to select; unknown ids are ignored at apply time. */
  sel?: string[];
  /** Playhead position in seconds - opens the timeline and parks the playhead there. */
  t?: number;
  /** A panel to open over the selection: `choreograph` today. */
  panel?: string;
  page?: string;
  timeline?: boolean;
}

/** Applied form - the field names free-canvas's DeepLinkState uses. */
export interface EditorState {
  select?: string[];
  playhead?: number;
  panel?: string;
  page?: string;
  timeline?: boolean;
}

/**
 * Every editor-state param, for the docs contract test (the RESERVED test's pattern):
 * this list and the docs/url-mode.md "On a tool route" paragraph must name the same
 * set, so a param can neither ship undocumented nor stay documented after it retires.
 */
export const EDITOR_STATE_PARAMS = ['_sel', '_t', '_panel', '_ui'] as const;

const KNOWN_KEYS = new Set(['v', 'sel', 't', 'panel', 'page', 'timeline']);

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
    const sel = o.sel.filter((x): x is string => typeof x === 'string' && !!x && x.length <= 256);
    out.select = sel.slice(0, 512);
  }
  if (typeof o.t === 'number' && Number.isFinite(o.t)) out.playhead = Math.max(0, o.t);
  if (typeof o.panel === 'string' && o.panel.length <= 64) out.panel = o.panel;
  if (typeof o.timeline === 'boolean') out.timeline = o.timeline;
  if (typeof o.page === 'string' && o.page.length <= 256) out.page = o.page;
  return out;
}

/** Read the editor-state params off a link: `_ui` first, shorthands overlaid on top. */
export function parseEditorState(flags: { get(k: string): string | null; has(k: string): boolean }): EditorState {
  let out: EditorState = {};
  const blob = flags.get('_ui');
  if (blob) {
    try {
      if (blob.length > 32768) throw new Error('Oversized workspace state');
      const bytes = Uint8Array.from(atob(blob.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      out = coerceUiState(JSON.parse(json)) ?? {};
    } catch {
      console.info('[editor-state] unreadable _ui param ignored');
    }
  }
  const sel = (flags.get('_sel') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (flags.has('_sel')) out.select = sel.slice(0, 512);
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
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
