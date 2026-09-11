// SPDX-License-Identifier: MPL-2.0
/**
 * The application half of a Penpot token payload.
 *
 * `chrome-tokens.json` is the compatibility scale the live CSS already uses;
 * `ui-semantics.json` gives components stable roles above it. This module makes
 * the same canonical DTCG document available to browser-only Penpot export
 * without importing the Node generator. It deliberately does not resolve the
 * aliases: Penpot should receive `{lolly.foundation.…}` references intact.
 */
import chrome from '../../design/chrome-tokens.json' with { type: 'json' };
import semantics from '../../design/ui-semantics.json' with { type: 'json' };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One editable semantic role in Lolly's UI starter set. `path` is relative to
 * `lolly.ui`, so the caller never needs to parse or construct an untrusted
 * token path. */
export interface LollyUiToken {
  path: string[];
  type: string;
  value: unknown;
  description?: string;
}

/**
 * Token groups are trees, while token leaves are records carrying `$value` (or
 * the legacy `value`). Merge only groups: a caller's leaf must replace the
 * stock leaf wholesale so its type, description and extensions stay together.
 *
 * This is intentionally non-mutating. `host.tokens.raw()` is also the source
 * used by the live CSS projection, and an export must never alter its active
 * design-system document as a side effect.
 */
function mergeTokenTree(base: Rec, override: Rec): Rec {
  const out: Rec = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    const baseIsGroup = isRec(existing) && !('$value' in existing || 'value' in existing);
    const overrideIsGroup = isRec(value) && !('$value' in value || 'value' in value);
    out[key] = baseIsGroup && overrideIsGroup ? mergeTokenTree(existing, value) : value;
  }
  return out;
}

function foundation(): Rec {
  const pick = (name: string): Rec => {
    const value = (chrome as Rec)[name];
    if (!isRec(value)) throw new Error(`chrome-tokens.json is missing ${name}`);
    return value;
  };
  return {
    font: pick('font'), edge: pick('edge'), elevation: pick('shadow'), bevel: pick('bevel'),
    focus: pick('ring-focus'), radius: pick('radius'), type: { size: pick('fs') },
    space: pick('sp'), motion: { duration: pick('dur'), easing: pick('ease') }, layer: pick('z'),
  };
}

/** The canonical, namespaced Lolly app token document for external design tools. */
export function lollyUiTokenDocument(): Rec {
  const lolly = (semantics as Rec).lolly;
  const ui = isRec(lolly) && isRec(lolly.ui) ? lolly.ui : null;
  if (!ui) throw new Error('ui-semantics.json must contain lolly.ui');
  return {
    $description: 'Lolly application UI tokens. Generated from chrome-tokens.json and ui-semantics.json.',
    lolly: { foundation: foundation(), ui },
  };
}

/**
 * Flatten the stock semantic roles for the Start studio. These are deliberately
 * a view of the application document, not leaves copied into a user's brand:
 * rendering this list must never make a `lolly` group appear in their export.
 */
export function listLollyUiTokens(): LollyUiToken[] {
  const ui = ((lollyUiTokenDocument().lolly as Rec).ui as Rec);
  const out: LollyUiToken[] = [];
  const walk = (node: Rec, path: string[]): void => {
    if ('$value' in node) {
      const type = typeof node.$type === 'string' ? node.$type : '';
      if (type) out.push({ path, type, value: structuredClone(node.$value), description: typeof node.$description === 'string' ? node.$description : undefined });
      return;
    }
    for (const [key, child] of Object.entries(node)) if (!key.startsWith('$') && isRec(child)) walk(child, [...path, key]);
  };
  walk(ui, []);
  return out;
}

/** A user's OWN leaf, if any. The stock defaults intentionally do not count. */
export function lollyUiOverride(doc: unknown, path: readonly string[]): Rec | null {
  let node: unknown = isRec(doc) ? doc.lolly : null;
  for (const key of ['ui', ...path]) {
    if (!isRec(node)) return null;
    node = node[key];
  }
  return isRec(node) && ('$value' in node || 'value' in node) ? node : null;
}

/**
 * Add or replace exactly one owned UI role. The Start editor calls this only
 * after a person changes and saves its preview value; this is the boundary that
 * keeps the app's complete starter set out of a brand until it is wanted.
 */
export function setLollyUiOverride(doc: Rec, path: readonly string[], type: string, value: unknown): void {
  let node = doc;
  for (const key of ['lolly', 'ui', ...path.slice(0, -1)]) {
    if (!isRec(node[key]) || '$value' in (node[key] as Rec) || 'value' in (node[key] as Rec)) node[key] = {};
    node = node[key] as Rec;
  }
  const leaf = path[path.length - 1];
  if (!leaf) return;
  node[leaf] = { $type: type, $value: structuredClone(value), $description: `Lolly UI override: ${path.join('.')}` };
}

/** Remove one owned role and return to the shipped Lolly preview. */
export function removeLollyUiOverride(doc: Rec, path: readonly string[]): boolean {
  const parents: Rec[] = [];
  let node: unknown = doc;
  for (const key of ['lolly', 'ui', ...path.slice(0, -1)]) {
    if (!isRec(node) || !isRec(node[key])) return false;
    parents.push(node);
    node = node[key];
  }
  const leaf = path[path.length - 1];
  if (!leaf || !isRec(node) || !(leaf in node)) return false;
  delete node[leaf];
  // Trim only groups this helper could have created. This makes Reset restore a
  // truly clean brand without touching any sibling authored token.
  let child: Rec = node;
  for (let i = parents.length - 1; i >= 0; i--) {
    if (Object.keys(child).length) break;
    const parent = parents[i]!;
    const key = ['lolly', 'ui', ...path.slice(0, -1)][i]!;
    delete parent[key];
    child = parent;
  }
  return true;
}

/**
 * Include Lolly app tokens alongside (never instead of) a brand document.
 * Tokens Studio/Penpot multi-set documents require an enabled set in every
 * theme; without that normalisation the app set would travel in the archive but
 * stay inactive when opened. Plain DTCG documents keep their plain shape.
 */
export function withLollyUiTokens(brand: unknown): Rec {
  const app = lollyUiTokenDocument();
  if (!isRec(brand)) return app;
  const appLolly = app.lolly as Rec;
  const brandLolly = isRec(brand.lolly) ? brand.lolly : {};
  // `lolly.ui` is deliberately an extension point: stock values establish a
  // complete Penpot-editable baseline and the active system's valid semantic
  // leaves overlay it. A shallow spread here used to discard every imported
  // `lolly.ui.*` override at export time, making the app and the archive lie
  // about the effective radius/shadow/etc. that a user is working with.
  const out: Rec = { ...brand, lolly: mergeTokenTree(appLolly, brandLolly) };
  const isSetDocument = isRec(brand.$metadata) || Array.isArray(brand.$themes);
  if (!isSetDocument) return out;

  const metadata = isRec(brand.$metadata) ? brand.$metadata : {};
  const order = Array.isArray(metadata.tokenSetOrder) ? metadata.tokenSetOrder.map(String) : [];
  if (!order.includes('lolly')) order.push('lolly');
  const active = Array.isArray(metadata.activeSets) ? metadata.activeSets.map(String) : order.slice();
  if (!active.includes('lolly')) active.push('lolly');
  out.$metadata = { ...metadata, tokenSetOrder: order, activeSets: active };

  if (Array.isArray(brand.$themes)) {
    out.$themes = brand.$themes.map((theme) => {
      if (!isRec(theme)) return theme;
      const selected = isRec(theme.selectedTokenSets) ? theme.selectedTokenSets : {};
      return { ...theme, selectedTokenSets: { ...selected, lolly: 'enabled' } };
    });
  }
  return out;
}
