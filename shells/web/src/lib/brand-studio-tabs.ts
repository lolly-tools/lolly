// SPDX-License-Identifier: MPL-2.0
/**
 * Brand studio tabs - the three studio panels that don't touch the colour
 * pipeline: non-colour token editors (Tokens tab), gradient tokens (Colour
 * tab's optional extra) and catalogue uploads (Catalogue tab). Split out of
 * brand-editor.ts so the editor stays the colour/typography/logo core; each
 * mount gets the same narrow context - the live doc (a GETTER, because the
 * Colour tab reassigns the doc on re-derive/import), the persist funnel and
 * its tab's notify - and returns { render, teardown } so the editor can
 * repaint after a doc swap and unhook on unmount.
 *
 * Pure doc surgery lives in token-studio.ts; storage in upload-dropzone.ts /
 * the picker's storeUserUpload. Nothing here writes outside those funnels.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';
import { colorToHex, createTokenSet, isAlias } from '@lolly/engine';
import {
  listStudioTokens, addStudioToken, setStudioTokenValue, deleteStudioToken,
  defaultValueFor, gradientCss, resolveStopHex, formatStudioValue,
} from './token-studio.ts';
import type { StudioKind, StudioToken, GradientStop } from './token-studio.ts';
import { walkSwatches } from './brand-doc.ts';
import { colorIdentity, isNeutralRampKey } from './design-system/ownership.ts';
import { mountUploadDropzone } from './upload-dropzone.ts';
import type { PickerHost } from '../views/picker.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { mountColorField } from '../components/color-field.ts';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { playSfx } from './sfx.ts';
import { uiTokenCssValue } from '../brand-vars.ts';
import type { UiTokenKind } from '../brand-vars.ts';
import { listLollyUiTokens, lollyUiOverride, lollyUiTokenDocument, removeLollyUiOverride, setLollyUiOverride } from './lolly-ui-tokens.ts';

export interface StudioTabCtx {
  host: HostV1;
  doc: () => Record<string, unknown>;
  persist: (immediate?: boolean) => void;
  notify: () => void;
  /** The shipped starter's colour identities (lib/design-system/ownership.ts
   *  `colorIdentity`), for a panel that has to tell scaffolding from a decision.
   *  Absent on a host that ships no starter, which attributes nothing - the same
   *  honest default every ownership read keeps. */
  starterIds?: () => ReadonlySet<string>;
}

export interface StudioPanelHandle { render: () => void; teardown: () => void }

/**
 * The studio panel's titled head - `.be-panel-head`/`-title`/`-sub`, which alias
 * chips.css's `.section-header` family (see styles/parts/chips.css). Was typed
 * out as a raw template string eleven times across brand-editor.ts and this
 * module; this is the one copy.
 *
 * Both arguments are **trusted HTML, not escaped** - every call site passes a
 * `t()` string, and several of the subs carry deliberate inline markup
 * (`<strong>`, `<em>`, a `<a href="#/c">` link). Never pass user input here.
 * `sub` is optional; omitting it emits the head with a title alone.
 */
export const panelHead = (title: string, sub?: string): string =>
  `<div class="be-panel-head"><h3 class="be-panel-title">${title}</h3>${sub ? `<p class="be-panel-sub">${sub}</p>` : ''}</div>`;

// ── Tokens panel ──────────────────────────────────────────────────────────────

/** The kinds the Tokens tab offers (gradient lives on the Colour tab instead - 
 *  it's a colour primitive, and colour work shouldn't leave that tab). */
const TOKEN_KINDS: ReadonlyArray<{ id: StudioKind; label: string }> = [
  { id: 'spacing', label: 'Spacing' },
  { id: 'sizing', label: 'Sizing' },
  { id: 'stroke', label: 'Stroke width' },
  { id: 'opacity', label: 'Opacity' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'number', label: 'Number' },
  { id: 'shadow', label: 'Shadow' },
];
const KIND_LABEL = new Map(TOKEN_KINDS.map(k => [k.id, k.label]));

const pathAttr = (t: StudioToken): string => escape(t.path.join('␟')); // ␟ - never in a slug
const pathFrom = (attr: string): string[] => attr.split('␟');

const UI_KIND: Record<string, UiTokenKind> = {
  color: 'color', spacing: 'length', borderRadius: 'length', fontSize: 'length', shadow: 'shadow',
  fontFamilies: 'font', duration: 'duration', cubicBezier: 'easing', number: 'number',
};
const UI_STARTER_TOKENS = listLollyUiTokens();
const uiPath = (path: readonly string[]): string => path.join('␟');
const uiLabel = (path: readonly string[]): string => path.map(segment => segment.replace(/-/g, ' ')).join(' · ');
const uiValueText = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value);
function parseUiValue(raw: string, kind: UiTokenKind): unknown {
  if (kind === 'number') return Number(raw);
  if (kind === 'shadow' || kind === 'easing') return JSON.parse(raw);
  // A font-family default is normally a DTCG string array. Keep that portable
  // form when it is shown as JSON, but let a person type a single family name
  // without forcing brackets and quotes around it.
  if (kind === 'font' && raw.trim().startsWith('[')) return JSON.parse(raw);
  return raw.trim();
}

/** One token row's value editor, per kind. Every control carries the row's
 *  JSON path so one delegated listener serves them all. */
function tokenValueEditor(tok: StudioToken): string {
  const p = pathAttr(tok);
  switch (tok.kind) {
    case 'opacity': {
      const v = typeof tok.raw === 'number' ? tok.raw : 1;
      return `<input type="range" class="field-range be-tok-range" min="0" max="1" step="0.01" value="${v}" data-tok-input="opacity" data-tok-path="${p}" aria-label="${escape(tRaw('{name} opacity', { name: tok.name }))}">
        <output class="be-tok-out" data-tok-out>${escape(formatStudioValue(tok))}</output>`;
    }
    case 'rotation':
    case 'number': {
      const v = typeof tok.raw === 'number' ? tok.raw : 0;
      return `<input type="number" class="be-tok-num" value="${v}" step="${tok.kind === 'rotation' ? 15 : 'any'}" data-tok-input="${tok.kind}" data-tok-path="${p}" aria-label="${escape(tRaw('{name} value', { name: tok.name }))}">${tok.kind === 'rotation' ? '<span class="be-tok-unit">°</span>' : ''}`;
    }
    case 'shadow': {
      const raw = (tok.raw ?? {}) as Record<string, unknown>;
      // The colour holder below carries the stored string VERBATIM. It used to be
      // flattened through colorToHex(...).slice(0, 7) for an <input type=color> that no
      // longer receives it, which dropped an authored alpha ('#00000040' → '#000000')
      // and any non-hex space on every re-render - only shadowFromRow's preference for
      // the stored value hid it. normShadow still gates validity on the way back in.
      const f = (k: string): string => escape(String(raw[k] ?? (k === 'color' ? '#00000040' : '0px')));
      return `<span class="be-tok-shadow-chip" style="box-shadow:${escape(formatStudioValue(tok))}" aria-hidden="true"></span>
        ${(['offsetX', 'offsetY', 'blur', 'spread'] as const).map(k =>
          `<label class="be-tok-shadow-in"><span>${k === 'offsetX' ? t('x') : k === 'offsetY' ? t('y') : k === 'blur' ? t('blur') : t('spread')}</span><input type="text" value="${f(k)}" data-tok-input="shadow" data-tok-field="${k}" data-tok-path="${p}" size="5" aria-label="${escape(tRaw('{name} {field}', { name: tok.name, field: k === 'offsetX' ? t('x') : k === 'offsetY' ? t('y') : k === 'blur' ? t('blur') : t('spread') }))}"></label>`).join('')}
        <span class="be-tok-shadow-cf" data-shadow-cf data-tok-path="${p}" aria-label="${escape(tRaw('{name} colour', { name: tok.name }))}"></span>
        <input type="hidden" data-tok-input="shadow" data-tok-field="color" data-tok-path="${p}" value="${f('color')}">`;
    }
    default: // the dimension kinds: spacing / sizing / stroke
      return `<input type="text" class="be-tok-dim" value="${escape(String(tok.raw ?? ''))}" data-tok-input="dimension" data-tok-path="${p}" size="7" inputmode="decimal" aria-label="${escape(tRaw('{name} value', { name: tok.name }))}" placeholder="8px">`;
  }
}

/** Read a shadow row's five fields back into the DTCG shadow value. The colour
 *  comes from the STORED value unless the colour input itself drove the commit - 
 *  `<input type=color>` only speaks #rrggbb, so echoing it back on every edit
 *  would strip an authored alpha ('#00000040') or oklch() the moment the blur
 *  is touched. */
function shadowFromRow(row: HTMLElement, changedField: string | undefined, currentRaw: unknown): Record<string, string> {
  const val = (k: string): string => row.querySelector<HTMLInputElement>(`[data-tok-field="${k}"]`)?.value.trim() ?? '0px';
  const storedColor = isRecObj(currentRaw) && typeof currentRaw.color === 'string' ? currentRaw.color : val('color');
  return {
    color: changedField === 'color' ? val('color') : storedColor,
    offsetX: val('offsetX'), offsetY: val('offsetY'), blur: val('blur'), spread: val('spread'),
  };
}
const isRecObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The neutral ramp, where it belongs (plan 182 section 12).
 *
 * Ink and paper: the ramp the blank brand ships so surfaces and text can render
 * at all. It is not a palette and the Colours room does not draw it, so the one
 * place it is listed is here - as a row with its nine steps and an Open that
 * routes to the Colours pane with that group revealed, folded and tagged. Once
 * somebody regenerates it, the same nine keys are theirs and the tag goes.
 *
 * A plain anchor, not a button: it is a link to a place, `#/start` is the
 * destination, and the studio's own catalogue panel already links out this way.
 */
const NEUTRALS_LINK = '#/start?area=color&group=neutral';

function neutralSwatches(ctx: StudioTabCtx): Array<{ hex: string; own: boolean }> {
  const starter = ctx.starterIds?.() ?? new Set<string>();
  try {
    return walkSwatches(ctx.doc(), 'light')
      .filter(s => s.hex && isNeutralRampKey(s.key))
      .map(s => ({ hex: s.hex, own: !starter.has(colorIdentity(s.key, s.raw)) }));
  } catch { return []; }   // an unreadable doc simply has no row
}

export function mountTokensPanel(mount: HTMLElement, ctx: StudioTabCtx): StudioPanelHandle {
  mount.innerHTML = `
    <div class="be-neutrals" data-be-neutrals hidden>
      <div class="be-neutrals-row">
        <span class="be-neutrals-label" data-be-neutrals-label></span>
        <span class="be-neutrals-tiles" data-be-neutrals-tiles aria-hidden="true"></span>
        <a class="be-btn be-neutrals-open" href="${NEUTRALS_LINK}">${t('Open')}</a>
      </div>
      <p class="be-neutrals-note">${t("Lolly's ink and paper. Tools use them until the design system has colours of its own.")}</p>
    </div>
    <section class="be-ui-starter" data-be-ui-starter aria-labelledby="be-ui-starter-title"></section>
    ${panelHead(t('More tokens'), t('The rest of the system - spacing, sizing, stroke widths, opacity, rotation, plain numbers and shadows. Tools that read tokens follow these the way they follow the colours.'))}
    <div class="be-tok-list" data-tok-list></div>
    <form class="be-tok-add" data-tok-add>
      <select class="field-select field-select--auto field-select--sm be-tok-add-kind" data-tok-add-kind aria-label="${escape(t('Token type'))}">
        ${TOKEN_KINDS.map(k => `<option value="${k.id}">${escape(t(k.label))}</option>`).join('')}
      </select>
      <input type="text" class="be-tok-add-name" data-tok-add-name placeholder="${escape(t('Name it - Gutter, Card shadow…'))}" autocomplete="off" spellcheck="false" aria-label="${escape(t('Token name'))}">
      <button type="submit" class="be-btn">${t('+ Add token')}</button>
    </form>
    <p class="be-err" data-tok-err hidden></p>`;

  const list = mount.querySelector<HTMLElement>('[data-tok-list]')!;
  const err = mount.querySelector<HTMLElement>('[data-tok-err]');
  const showErr = (m: string): void => { if (err) { err.textContent = m; err.hidden = !m; } if (m) announce(m, { assertive: true }); };

  // A shadow token's colour uses our own picker (never the OS one) - mounted over a
  // hidden holder input that carries the stored colour string so the delegated shadow
  // commit (which reads [data-tok-field="color"] and fires on `change`) keeps working
  // untouched. The holder is not an <input type=color>, so it seeds the picker with
  // whatever was authored - alpha and space intact. Re-run after every render(), which
  // replaces the list's markup.
  const wireShadowFields = (): void => {
    list.querySelectorAll<HTMLElement>('[data-shadow-cf]').forEach(span => {
      const row = span.closest<HTMLElement>('[data-tok-row]');
      const holder = row?.querySelector<HTMLInputElement>('input[data-tok-field="color"]');
      mountColorField(span, `shadow-${span.dataset.tokPath ?? ''}`, {
        value: holder?.value || '#000000', float: true,
        onChange: (v) => {
          if (!holder) return;
          holder.value = v; // canonical #rrggbb / #rrggbbaa - the shadow may carry alpha now
          holder.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
    });
  };

  // The neutrals row, painted through the DOM rather than a second raw-HTML
  // sink: it is nine boxes and a line of text, and the tiles carry a colour that
  // came out of a document.
  const neutralsEl = mount.querySelector<HTMLElement>('[data-be-neutrals]');
  const neutralsLabel = mount.querySelector<HTMLElement>('[data-be-neutrals-label]');
  const neutralsTiles = mount.querySelector<HTMLElement>('[data-be-neutrals-tiles]');
  const neutralsNote = mount.querySelector<HTMLElement>('.be-neutrals-note');
  const uiStarter = mount.querySelector<HTMLElement>('[data-be-ui-starter]');
  let openUiEditor = '';
  const renderNeutrals = (): void => {
    if (!neutralsEl) return;
    const steps = neutralSwatches(ctx);
    neutralsEl.hidden = steps.length === 0;
    if (!steps.length) return;
    const inherited = steps.some(s => !s.own);
    if (neutralsLabel) {
      neutralsLabel.textContent = inherited
        ? tRaw('Neutrals · starter · {n}', { n: steps.length })
        : tRaw('Neutrals · {n}', { n: steps.length });
    }
    // The sentence is only true while nobody has retoned them.
    if (neutralsNote) neutralsNote.hidden = !inherited;
    if (neutralsTiles) {
      neutralsTiles.textContent = '';
      for (const step of steps) {
        const tile = mount.ownerDocument.createElement('span');
        tile.className = 'be-neutrals-tile';
        tile.style.setProperty('--sw', step.hex);
        neutralsTiles.appendChild(tile);
      }
    }
  };
  renderNeutrals();

  /**
   * The app's semantic role set is intentionally a preview, not a preset that
   * quietly bloats every new brand. A role becomes owned only when its edited
   * value is saved below. The stock value is resolved against the canonical
   * Lolly document so an authored override is always a literal the live CSS
   * projection can validate (rather than an alias into a foundation set the
   * brand does not carry).
   */
  const renderUiStarter = (): void => {
    if (!uiStarter) return;
    const defaults = createTokenSet(lollyUiTokenDocument());
    const groups = new Map<string, typeof UI_STARTER_TOKENS>();
    let owned = 0;
    for (const tok of UI_STARTER_TOKENS) {
      const group = tok.path[0] ?? 'other';
      const groupItems = groups.get(group) ?? [];
      groupItems.push(tok); groups.set(group, groupItems);
      if (lollyUiOverride(ctx.doc(), tok.path)) owned++;
    }
    uiStarter.innerHTML = `
      <div class="be-ui-starter-head">
        <div>
          <p class="be-ui-starter-kicker">${t('Lolly UI starter roles')}</p>
          <h3 class="be-ui-starter-title" id="be-ui-starter-title">${t('The tokens Lolly itself uses')}</h3>
        </div>
        <span class="be-ui-starter-count">${owned ? tRaw('{owned} of {total} owned', { owned, total: UI_STARTER_TOKENS.length }) : tRaw('{total} placeholders', { total: UI_STARTER_TOKENS.length })}</span>
      </div>
      <p class="be-ui-starter-note"><strong>${t('Preview only.')}</strong> ${t('These defaults power the Lolly app and travel in its Penpot UI library, but they are not added to your brand or token export. Change a value and save it to create just that owned `lolly.ui` token.')}</p>
      <div class="be-ui-starter-groups">
        ${[...groups.entries()].map(([group, tokens]) => `
          <details class="be-ui-group" ${group === 'color' || tokens.some(tok => uiPath(tok.path) === openUiEditor) ? 'open' : ''}>
            <summary><span>${escape(t(group.replace(/-/g, ' ')))}</span><span class="be-ui-group-count">${tokens.filter(tok => lollyUiOverride(ctx.doc(), tok.path)).length || t('defaults')}</span></summary>
            <div class="be-ui-role-list">
              ${tokens.map(tok => {
                const key = uiPath(tok.path);
                const own = lollyUiOverride(ctx.doc(), tok.path);
                const kind = UI_KIND[tok.type];
                const fallback = defaults.resolve(`lolly.ui.${tok.path.join('.')}`) ?? tok.value;
                const current = own?.$value ?? own?.value ?? fallback;
                const textValue = uiValueText(current);
                const editing = openUiEditor === key;
                return `<article class="be-ui-role${own ? ' is-owned' : ''}" data-ui-role="${escape(key)}">
                  <div class="be-ui-role-meta">
                    <span class="be-ui-role-name">${escape(uiLabel(tok.path))}</span>
                    <code class="be-ui-role-path">lolly.ui.${escape(tok.path.join('.'))}</code>
                  </div>
                  <div class="be-ui-role-state"><span class="be-ui-role-value">${escape(textValue)}</span><span class="be-ui-role-badge">${own ? t('Brand override') : t('Lolly default')}</span></div>
                  <div class="be-ui-role-actions">
                    <button type="button" class="be-btn be-btn--sm" data-ui-customize="${escape(key)}">${editing ? t('Close editor') : own ? t('Edit') : t('Customize')}</button>
                    ${own ? `<button type="button" class="be-btn be-btn--sm" data-ui-reset="${escape(key)}">${t('Reset')}</button>` : ''}
                  </div>
                  ${editing ? `<form class="be-ui-edit" data-ui-edit="${escape(key)}">
                    <label>${escape(tRaw('New value for {name}', { name: uiLabel(tok.path) }))}
                      ${kind === 'shadow' || kind === 'easing'
                        ? `<textarea data-ui-value rows="3" spellcheck="false">${escape(textValue)}</textarea>`
                        : `<input type="text" data-ui-value value="${escape(textValue)}" spellcheck="false" autocomplete="off">`}
                    </label>
                    <p>${t('This remains a placeholder until the value changes and you save it.')}</p>
                    <button type="submit" class="be-cta" data-ui-save="${escape(key)}" disabled>${t('Save brand override')}</button>
                  </form>` : ''}
                </article>`;
              }).join('')}
            </div>
          </details>`).join('')}
      </div>`;
  };

  const render = (): void => {
    renderNeutrals();
    renderUiStarter();
    const all = listStudioTokens(ctx.doc()).filter(t => t.kind !== 'gradient');
    if (!all.length) {
      list.innerHTML = `<p class="be-tok-empty">${t('No extra tokens yet - most brands start with a spacing unit and a card shadow.')}</p>`;
      return;
    }
    const byKind = new Map<StudioKind, StudioToken[]>();
    for (const t of all) (byKind.get(t.kind) ?? byKind.set(t.kind, []).get(t.kind)!).push(t);
    list.innerHTML = [...byKind.entries()].map(([kind, items]) => `
      <div class="be-tok-group">
        <div class="be-tok-group-head"><span class="be-tok-group-label">${escape(t(KIND_LABEL.get(kind) ?? kind))}</span><span class="be-tok-group-n">${items.length}</span></div>
        ${items.map(tok => `
          <div class="be-tok-row" data-tok-row data-tok-path="${pathAttr(tok)}">
            <span class="be-tok-name" title="${escape(tok.key)}">${escape(tok.name)}</span>
            <span class="be-tok-editor">${tokenValueEditor(tok)}</span>
            <button type="button" class="be-tok-del" data-tok-del="${pathAttr(tok)}" aria-label="${escape(tRaw('Delete {name}', { name: tok.name }))}">&#x2715;</button>
          </div>`).join('')}
      </div>`).join('');
    wireShadowFields();
  };
  render();

  uiStarter?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const key = target.closest<HTMLButtonElement>('[data-ui-customize]')?.dataset.uiCustomize;
    if (key) {
      openUiEditor = openUiEditor === key ? '' : key;
      renderUiStarter();
      if (openUiEditor) uiStarter.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-ui-value]')?.focus();
      return;
    }
    const reset = target.closest<HTMLButtonElement>('[data-ui-reset]')?.dataset.uiReset;
    if (!reset) return;
    const token = UI_STARTER_TOKENS.find(item => uiPath(item.path) === reset);
    if (!token || !removeLollyUiOverride(ctx.doc(), token.path)) return;
    openUiEditor = '';
    renderUiStarter(); ctx.persist(true); ctx.notify();
    announce(tRaw('{name} reset to the Lolly default', { name: uiLabel(token.path) }));
  });
  uiStarter?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!input.matches('[data-ui-value]')) return;
    const form = input.closest<HTMLFormElement>('[data-ui-edit]');
    const key = form?.dataset.uiEdit;
    const token = UI_STARTER_TOKENS.find(item => uiPath(item.path) === key);
    const save = form?.querySelector<HTMLButtonElement>('[data-ui-save]');
    if (!token || !save) return;
    const own = lollyUiOverride(ctx.doc(), token.path);
    const defaults = createTokenSet(lollyUiTokenDocument());
    const initial = uiValueText(own?.$value ?? own?.value ?? defaults.resolve(`lolly.ui.${token.path.join('.')}`) ?? token.value);
    save.disabled = input.value === initial;
  });
  uiStarter?.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-ui-edit]')) return;
    e.preventDefault();
    const token = UI_STARTER_TOKENS.find(item => uiPath(item.path) === form.dataset.uiEdit);
    const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-ui-value]');
    const kind = token ? UI_KIND[token.type] : undefined;
    if (!token || !input || !kind) return;
    let value: unknown;
    try { value = parseUiValue(input.value, kind); }
    catch { showErr(t('Use valid JSON for this value.')); return; }
    if (uiTokenCssValue(kind, value) == null) {
      showErr(t('That value is not safe or usable by the Lolly UI.')); return;
    }
    setLollyUiOverride(ctx.doc(), token.path, token.type, value);
    showErr(''); openUiEditor = '';
    renderUiStarter(); ctx.persist(true); ctx.notify(); playSfx('click');
    announce(tRaw('{name} saved as a brand override', { name: uiLabel(token.path) }));
  });

  // One delegated commit for every editor control. Range/number commit on
  // input (they're cheap + atomic); text dimensions commit on change so a
  // half-typed "1.5re" never lands.
  const commit = (el: HTMLInputElement): void => {
    const path = pathFrom(el.dataset.tokPath ?? '');
    const kind = el.dataset.tokInput;
    // A cleared number field reports '' - Number('') is 0, which would persist
    // a value the user never typed. Wait for real input (or a blur revert).
    if ((kind === 'rotation' || kind === 'number' || kind === 'opacity') && el.value.trim() === '') return;
    let ok = false;
    if (kind === 'shadow') {
      const row = el.closest<HTMLElement>('[data-tok-row]');
      const cur = listStudioTokens(ctx.doc()).find(x => x.path.join('␟') === path.join('␟'));
      if (row) ok = setStudioTokenValue(ctx.doc(), path, shadowFromRow(row, el.dataset.tokField, cur?.raw));
      if (ok) {
        const chip = el.closest<HTMLElement>('[data-tok-row]')?.querySelector<HTMLElement>('.be-tok-shadow-chip');
        const t = listStudioTokens(ctx.doc()).find(x => x.path.join('␟') === path.join('␟'));
        if (chip && t) chip.style.boxShadow = formatStudioValue(t);
      }
    } else if (kind === 'opacity') {
      ok = setStudioTokenValue(ctx.doc(), path, Number(el.value));
      const out = el.parentElement?.querySelector<HTMLElement>('[data-tok-out]');
      if (out) out.textContent = String(Number(el.value));
    } else if (kind === 'rotation' || kind === 'number') {
      ok = setStudioTokenValue(ctx.doc(), path, Number(el.value));
    } else {
      ok = setStudioTokenValue(ctx.doc(), path, el.value);
    }
    if (!ok) { showErr(t(kind === 'dimension' ? "Couldn't read that value - use a CSS length like 8px or 0.5rem." : "Couldn't read that value - check it and try again.")); return; }
    showErr('');
    ctx.persist();
    ctx.notify();
  };
  list.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.tokInput === 'opacity' || el.dataset.tokInput === 'rotation' || el.dataset.tokInput === 'number') commit(el);
  });
  list.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.tokInput === 'dimension' || el.dataset.tokInput === 'shadow') commit(el);
  });
  list.addEventListener('click', async (e) => {
    const del = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tok-del]'); if (!del) return;
    const path = pathFrom(del.dataset.tokDel ?? '');
    const tok = listStudioTokens(ctx.doc()).find(x => x.path.join('␟') === path.join('␟'));
    const ok = await confirmDialog({ title: tRaw('Delete {name}?', { name: tok?.name ?? t('this token') }), message: t('Anything reading it falls back to its own default.'), confirmLabel: t('Delete') });
    if (!ok) return;
    if (deleteStudioToken(ctx.doc(), path)) { render(); ctx.persist(true); ctx.notify(); }
  });
  mount.querySelector<HTMLFormElement>('[data-tok-add]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const kindSel = mount.querySelector<HTMLSelectElement>('[data-tok-add-kind]');
    const nameInput = mount.querySelector<HTMLInputElement>('[data-tok-add-name]');
    const kind = (kindSel?.value ?? 'spacing') as StudioKind;
    const name = nameInput?.value.trim() ?? '';
    if (!name) { showErr(t('Name the token first.')); nameInput?.focus(); return; }
    const path = addStudioToken(ctx.doc(), kind, name, defaultValueFor(kind));
    if (!path) { showErr(t("Couldn't add that token.")); return; }
    showErr('');
    if (nameInput) nameInput.value = '';
    render(); ctx.persist(true); ctx.notify(); playSfx('click');
    announce(tRaw('{name} added', { name }));
    // Land focus on the fresh row's first control so the value is one keystroke away.
    list.querySelector<HTMLElement>(`[data-tok-row][data-tok-path="${pathAttr({ path } as StudioToken)}"] input`)?.focus();
  });

  return { render, teardown: () => {} };
}

// ── Gradients panel (Colour tab) ──────────────────────────────────────────────

/** One palette swatch as the gradient stop picker sees it - `ref` is the
 *  canonical `{color.…}` alias a stop stores. Built by brand-editor.ts from
 *  the same walkSwatches output the palette grid renders. */
export interface GradientSwatch { ref: string; hex: string; label: string; group: string }

export interface GradientsCtx extends StudioTabCtx {
  primaryHex: () => string;
  paletteHexes: () => string[];
  /** The committed palette, in grid order (alias roles excluded). */
  paletteSwatches: () => GradientSwatch[];
  /** A `{path}` alias → resolved hex against the live doc, or null. */
  resolveRef: (ref: string) => string | null;
  /** The committed-palette seam (BrandEditorHandle.onPalette - fires from BOTH
   *  repaintPalette and persist(); double-fires expected, so subscribers must
   *  be idempotent). Returns an unsubscribe. */
  onPalette: (cb: () => void) => () => void;
}

const GRAD_STOPS_MIN = 2;
const GRAD_STOPS_MAX = 8;

export function mountGradientsPanel(mount: HTMLElement, ctx: GradientsCtx): StudioPanelHandle {
  mount.innerHTML = `
    ${panelHead(t('Gradients'), t("Optional colour tokens - blends of the palette for backgrounds and accents. Stops wear the swatches, so they follow a recolour. Skip these entirely if the design system doesn't do gradients."))}
    <details class="be-subst-details be-grads-details" data-be-grads-details>
      <summary><span class="be-subst-details-label">${t('Gradients')}</span><span class="be-subst-chips"><span class="be-ps-chip" data-grad-count></span></span></summary>
      <div class="be-grad-list" data-grad-list></div>
      <button type="button" class="be-add" data-grad-add>${t('+ Add gradient')}</button>
      <p class="be-err" data-grad-err hidden></p>
    </details>
    <div class="be-grad-pop" data-grad-pop hidden>
      <div class="be-grad-pop-card" role="dialog" aria-label="${escape(t('Stop colour'))}">
        <div class="be-grad-pop-grid" data-grad-pop-grid></div>
        <details class="be-grad-pop-custom" data-grad-pop-custom>
          <summary>${t('Custom value')}</summary>
          <div class="be-grad-pop-customrow">
            <input type="text" class="be-fmt-input" data-grad-pop-hex placeholder="#rrggbb / oklch(…)" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${escape(t('Custom stop value'))}">
          </div>
        </details>
      </div>
    </div>`;

  const list = mount.querySelector<HTMLElement>('[data-grad-list]')!;
  const details = mount.querySelector<HTMLDetailsElement>('[data-be-grads-details]');
  const countChip = mount.querySelector<HTMLElement>('[data-grad-count]');
  const err = mount.querySelector<HTMLElement>('[data-grad-err]');
  const showErr = (m: string): void => { if (err) { err.textContent = m; err.hidden = !m; } if (m) announce(m, { assertive: true }); };
  const grads = (): StudioToken[] => listStudioTokens(ctx.doc()).filter(t => t.kind === 'gradient');

  const stopsOf = (t: StudioToken): GradientStop[] => (Array.isArray(t.raw) ? (t.raw as GradientStop[]) : []);
  /** A stop's renderable colour ('transparent' when its alias can't answer). */
  const stopCss = (s: GradientStop): string => resolveStopHex(s, ctx.resolveRef) ?? 'transparent';
  const previewCss = (t: StudioToken): string => gradientCss(t.raw, t.angle, { resolve: ctx.resolveRef, space: 'oklch' });
  /** The next palette swatch no stop already wears (by ref or resolved hex). */
  const nextUnusedSwatch = (stops: GradientStop[]): GradientSwatch | undefined => {
    const used = new Set<string>();
    for (const s of stops) {
      used.add(s.color);
      const hex = resolveStopHex(s, ctx.resolveRef);
      if (hex) used.add(hex.toLowerCase().slice(0, 7));
    }
    return ctx.paletteSwatches().find(w => !used.has(w.ref) && !used.has(w.hex.toLowerCase().slice(0, 7)));
  };

  const stopChipHtml = (tok: StudioToken, s: GradientStop, i: number, removable: boolean): string => {
    const p = pathAttr(tok);
    const isRef = isAlias(s.color);
    const swName = isRef ? ctx.paletteSwatches().find(w => w.ref === s.color)?.label ?? s.color : s.color;
    const label = tRaw('{name} stop {n} - {swatch}', { name: tok.name, n: i + 1, swatch: swName });
    return `<span class="be-grad-stopwrap">
        <button type="button" class="be-grad-stop-chip${isRef ? ' is-ref' : ''}" data-grad-stop="${i}" data-grad-path="${p}"
          style="--sw:${escape(stopCss(s))}" title="${escape(swName)}" aria-label="${escape(label)}" aria-haspopup="dialog"></button>
        ${removable ? `<button type="button" class="be-grad-stopdel" data-grad-stopdel="${i}" data-grad-path="${p}" aria-label="${escape(tRaw('Remove {label}', { label }))}">&#x2715;</button>` : ''}
      </span>`;
  };
  const rowHtml = (tok: StudioToken): string => {
    const stops = stopsOf(tok);
    const p = pathAttr(tok);
    const removable = stops.length > GRAD_STOPS_MIN;
    return `
      <div class="be-grad-row" data-grad-row data-grad-path="${p}">
        <span class="be-grad-preview" style="background:${escape(previewCss(tok))}" aria-hidden="true"></span>
        <span class="be-grad-meta">
          <span class="be-grad-name">${escape(tok.name)}</span>
          <span class="be-grad-stops">
            ${stops.map((s, i) => stopChipHtml(tok, s, i, removable)).join('')}
            ${stops.length < GRAD_STOPS_MAX ? `<button type="button" class="be-grad-addstop" data-grad-addstop="${p}" aria-label="${escape(tRaw('Add a stop to {name}', { name: tok.name }))}">+</button>` : ''}
            <label class="be-grad-nstops"><input type="number" min="${GRAD_STOPS_MIN}" max="${GRAD_STOPS_MAX}" step="1" value="${stops.length}" data-grad-nstops data-grad-path="${p}" aria-label="${escape(tRaw('{name} stop count', { name: tok.name }))}">${t('stops')}</label>
            <label class="be-grad-angle"><input type="number" value="${tok.angle ?? 180}" step="15" data-grad-angle data-grad-path="${p}" aria-label="${escape(tRaw('{name} angle', { name: tok.name }))}">°</label>
          </span>
        </span>
        <button type="button" class="be-tok-del" data-grad-del="${p}" aria-label="${escape(tRaw('Delete {name}', { name: tok.name }))}">&#x2715;</button>
      </div>`;
  };

  // ── The ONE shared stop popover - swatch grid first, custom value folded ────
  const pop = mount.querySelector<HTMLElement>('[data-grad-pop]')!;
  const popGrid = mount.querySelector<HTMLElement>('[data-grad-pop-grid]')!;
  const popCustom = mount.querySelector<HTMLDetailsElement>('[data-grad-pop-custom]')!;
  const popHex = mount.querySelector<HTMLInputElement>('[data-grad-pop-hex]')!;
  let popPath = ''; // pathAttr of the token whose stop is being edited ('' = closed)
  let popStop = -1;

  const closePop = (): void => { pop.hidden = true; popPath = ''; popStop = -1; };
  const popTarget = (): { t: StudioToken; stops: GradientStop[] } | null => {
    const t = tokenAt(popPath); if (!t) return null;
    const stops = stopsOf(t);
    return popStop >= 0 && popStop < stops.length ? { t, stops } : null;
  };
  const renderPopGrid = (): void => {
    const curColor = popTarget()?.stops[popStop]?.color ?? '';
    popGrid.innerHTML = ctx.paletteSwatches().map(w => `
      <button type="button" class="be-grad-pop-sw${w.ref === curColor ? ' is-active' : ''}" data-pop-ref="${escape(w.ref)}"
        style="--sw:${escape(w.hex)}" title="${escape(`${w.group} · ${w.label}`)}" aria-label="${escape(`${w.label} (${w.group})`)}" aria-pressed="${w.ref === curColor}"></button>`).join('');
  };
  const openPop = (chip: HTMLElement): void => {
    popPath = chip.dataset.gradPath ?? '';
    popStop = Number(chip.dataset.gradStop);
    const cur = popTarget();
    if (!cur) { closePop(); return; }
    const stop = cur.stops[popStop]!;
    renderPopGrid();
    popHex.value = isAlias(stop.color) ? '' : stop.color;
    popCustom.open = !isAlias(stop.color); // a literal stop opens on the row that set it
    pop.hidden = false;
    // Position under the chip, clamped inside the panel; flipped above when
    // the side pane's scrollport (or the viewport) would clip it below. The
    // popover is absolute INSIDE the panel, so the pane's own scroll carries
    // it with its anchor - no `.be`-space drift to chase.
    const mr = mount.getBoundingClientRect(), cr = chip.getBoundingClientRect();
    pop.style.left = `${Math.max(0, Math.min(cr.left - mr.left, mr.width - (pop.offsetWidth || 248)))}px`;
    const h = pop.offsetHeight;
    const scroller = mount.closest<HTMLElement>('.be-split-scroll');
    const limit = scroller && scroller.clientHeight < scroller.scrollHeight
      ? scroller.getBoundingClientRect().bottom : window.innerHeight;
    pop.style.top = cr.bottom + 6 + h <= limit
      ? `${cr.bottom - mr.top + 6}px`
      : `${Math.max(0, cr.top - mr.top - h - 6)}px`;
  };
  /** Write the open stop's colour (an alias ref or a literal) and repaint. */
  const setStopColor = (color: string): void => {
    const cur = popTarget(); if (!cur || !color) return;
    const next = cur.stops.map((s, i) => (i === popStop ? { ...s, color } : s));
    if (!setStudioTokenValue(ctx.doc(), cur.t.path, next)) return;
    repaintRow(popPath);
    renderPopGrid();
    ctx.persist();
    ctx.notify();
  };

  const render = (): void => {
    const items = grads();
    // Count chip updates in place; the <details> open state is deliberately
    // never touched here, so the repaintPalette-driven re-render (the editor's
    // paletteHooks) can't fold an open panel shut.
    if (countChip) {
      countChip.textContent = items.length ? String(items.length) : t('none');
      countChip.classList.toggle('be-ps-chip--auto', !items.length);
    }
    if (!pop.hidden) closePop(); // the chip it anchors to is about to be rebuilt
    list.innerHTML = items.map(rowHtml).join('');
  };
  // Default-collapsed only while the brand carries no gradients - a brand that
  // has them shows them.
  if (details) details.open = grads().length > 0;
  render();

  const tokenAt = (attr: string): StudioToken | undefined =>
    grads().find(t => t.path.join('␟') === attr);
  /** In-place repaint of one row's preview + chips (no re-render - keeps the
   *  popover and any focused control alive). */
  const repaintRow = (attr: string): void => {
    const t = tokenAt(attr);
    const row = list.querySelector<HTMLElement>(`[data-grad-row][data-grad-path="${CSS.escape(attr)}"]`);
    if (!t || !row) return;
    const prev = row.querySelector<HTMLElement>('.be-grad-preview');
    if (prev) prev.style.background = previewCss(t);
    const stops = stopsOf(t);
    row.querySelectorAll<HTMLElement>('[data-grad-stop]').forEach(chip => {
      const s = stops[Number(chip.dataset.gradStop)];
      if (!s) return;
      chip.style.setProperty('--sw', stopCss(s));
      chip.classList.toggle('is-ref', isAlias(s.color));
    });
  };
  // The committed-palette seam: an in-place recolour (wheel drag, popover edit)
  // changes what alias stops resolve to with no structural edit - repaint every
  // row (and an open stop popover's grid) in place.
  const repaintAll = (): void => {
    for (const t of grads()) repaintRow(t.path.join('␟'));
    if (!pop.hidden) renderPopGrid();
  };
  const unsubPalette = ctx.onPalette(repaintAll);

  list.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.gradAngle === undefined) return;
    const attr = el.dataset.gradPath ?? '';
    const t = tokenAt(attr); if (!t) return;
    if (el.value.trim() === '') return; // cleared field - Number('') would write 0
    const angle = Number(el.value);
    if (!Number.isFinite(angle)) return;
    // Angle-only edit: the stored stops ride through the write gate untouched
    // (alias refs included - normStops keeps them verbatim).
    if (!setStudioTokenValue(ctx.doc(), t.path, { stops: stopsOf(t), angle })) return;
    repaintRow(attr);
    ctx.persist();
    ctx.notify();
  });
  list.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.gradNstops === undefined) return;
    const attr = el.dataset.gradPath ?? '';
    const t = tokenAt(attr); if (!t) return;
    let stops = [...stopsOf(t)];
    const n = Math.max(GRAD_STOPS_MIN, Math.min(GRAD_STOPS_MAX, Math.round(Number(el.value)) || stops.length));
    if (n === stops.length) { el.value = String(stops.length); return; }
    if (n > stops.length) {
      if (stops.length < 2) {
        // Degenerate stored run (imported doc) - rebuild it evenly.
        while (stops.length < n) stops.push({ color: nextUnusedSwatch(stops)?.ref ?? '#888888', position: 1 });
        stops = stops.map((s, i) => ({ ...s, position: i / (stops.length - 1) }));
      } else {
        // Grow: append the next palette swatches nothing wears yet, as
        // aliases, spread evenly through the tail gap (between the last two
        // stops) - a whole-run re-space would wipe positions the "+" flow
        // hand-placed at the largest gap's midpoint.
        const last = stops[stops.length - 1]!;
        const from = stops[stops.length - 2]!.position;
        const added = n - stops.length;
        for (let i = 1; i <= added; i++) {
          stops.splice(stops.length - 1, 0, {
            color: nextUnusedSwatch(stops)?.ref ?? '#888888',
            position: from + ((last.position - from) * i) / (added + 1),
          });
        }
      }
    } else {
      // Shrink: drop from the end, keeping the first and last stops - and
      // every survivor's position.
      stops = [...stops.slice(0, n - 1), stops[stops.length - 1]!];
    }
    if (!setStudioTokenValue(ctx.doc(), t.path, stops)) return;
    render(); ctx.persist(); ctx.notify();
  });
  list.addEventListener('click', async (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-grad-stop]');
    if (chip) { openPop(chip); return; }
    const delStop = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-grad-stopdel]');
    if (delStop) {
      const attr = delStop.dataset.gradPath ?? '';
      const t = tokenAt(attr); if (!t) return;
      const stops = [...stopsOf(t)];
      if (stops.length <= GRAD_STOPS_MIN) return;
      stops.splice(Number(delStop.dataset.gradStopdel), 1);
      if (!setStudioTokenValue(ctx.doc(), t.path, stops)) return;
      render(); ctx.persist(); ctx.notify();
      return;
    }
    const addStop = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-grad-addstop]');
    if (addStop) {
      const t = tokenAt(addStop.dataset.gradAddstop ?? ''); if (!t) return;
      const stops = [...stopsOf(t)];
      if (stops.length >= GRAD_STOPS_MAX) return;
      // Seed at the midpoint of the largest gap, wearing the next unused
      // palette swatch - as an alias, so it follows a recolour.
      let gi = 0;
      for (let i = 1; i + 1 < stops.length; i++) {
        if (stops[i + 1]!.position - stops[i]!.position > stops[gi + 1]!.position - stops[gi]!.position) gi = i;
      }
      const pos = stops.length >= 2 ? (stops[gi]!.position + stops[gi + 1]!.position) / 2 : 0.5;
      stops.splice(gi + 1, 0, { color: nextUnusedSwatch(stops)?.ref ?? '#888888', position: pos });
      if (setStudioTokenValue(ctx.doc(), t.path, stops)) { render(); ctx.persist(); ctx.notify(); }
      return;
    }
    const del = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-grad-del]'); if (!del) return;
    const tok = tokenAt(del.dataset.gradDel ?? '');
    const ok = await confirmDialog({ title: tRaw('Delete {name}?', { name: tok?.name ?? t('this gradient') }), message: t('It’s removed from the design system tokens.'), confirmLabel: t('Delete') });
    if (!ok || !tok) return;
    if (deleteStudioToken(ctx.doc(), tok.path)) { render(); ctx.persist(true); ctx.notify(); }
  });

  popGrid.addEventListener('click', (e) => {
    const sw = (e.target as HTMLElement).closest<HTMLElement>('[data-pop-ref]');
    if (sw) setStopColor(sw.dataset.popRef ?? '');
  });
  const commitPopHex = (): void => {
    const raw = popHex.value.trim();
    if (!raw || colorToHex(raw) == null) return; // half-typed - leave the stored value alone
    setStopColor(raw);
  };
  popHex.addEventListener('change', commitPopHex);
  popHex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitPopHex(); } });

  // Esc closes the stop popover FIRST and stops the event dead - registered
  // here (during mountBrandEditor, so ahead of start.ts's sheet/back handler,
  // and after the swatch editor's own - resolution: swatch editor wins when
  // both are somehow open). Outside-pointerdown (capture, the swatch editor's
  // pattern) closes it too.
  const onPopKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !pop.hidden) { e.stopImmediatePropagation(); closePop(); }
  };
  const onPopPointer = (e: PointerEvent): void => {
    if (!pop.hidden && !pop.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-grad-stop]')) closePop();
  };
  document.addEventListener('keydown', onPopKey);
  document.addEventListener('pointerdown', onPopPointer, true);

  mount.querySelector<HTMLButtonElement>('[data-grad-add]')?.addEventListener('click', () => {
    const n = grads().length + 1;
    // Seed from the palette AS ALIASES (the primary's swatch first) so the new
    // gradient tracks recolours; literals only when the palette can't supply two.
    const sws = ctx.paletteSwatches();
    const primary = ctx.primaryHex().toLowerCase().slice(0, 7);
    const first = sws.find(w => w.hex.toLowerCase().slice(0, 7) === primary) ?? sws[0];
    const second = sws.find(w => w !== first && w.hex.toLowerCase() !== (first?.hex ?? '').toLowerCase());
    const from = first?.ref ?? ctx.primaryHex();
    const to = second?.ref ?? ctx.paletteHexes().find(h => h.toLowerCase() !== primary) ?? '#ffffff';
    const gradName = t('Gradient {n}', { n });
    const path = addStudioToken(ctx.doc(), 'gradient', gradName, {
      stops: [{ color: from, position: 0 }, { color: to, position: 1 }], angle: 135,
    });
    if (!path) { showErr(t("Couldn't add a gradient.")); return; }
    showErr('');
    render(); ctx.persist(true); ctx.notify(); playSfx('click');
    announce(tRaw('{name} added', { name: gradName }));
  });

  return {
    render,
    teardown: () => {
      unsubPalette();
      document.removeEventListener('keydown', onPopKey);
      document.removeEventListener('pointerdown', onPopPointer, true);
    },
  };
}

// ── Catalogue panel ───────────────────────────────────────────────────────────

/** Display buckets, in render order - the same coarse cut the Catalogue view
 *  makes: motion = video, Lottie and animated rasters. */
const CAT_BUCKETS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'vector', label: 'Vector' },
  { key: 'image', label: 'Images' },
  { key: 'audio', label: 'Audio' },
  { key: 'motion', label: 'Motion' },
];

/** Internal ids (fonts, logos, tokens, the headshot) aren't catalogue uploads. */
const INTERNAL_ID = /^user\/(fonts|logo|tokens|headshot)/;

function bucketOf(ref: { type: string; meta?: Record<string, unknown> }): string | null {
  if (ref.type === 'vector') return 'vector';
  if (ref.type === 'audio') return 'audio';
  if (ref.type === 'video' || ref.type === 'lottie') return 'motion';
  if (ref.type === 'raster') return ref.meta?.animated ? 'motion' : 'image';
  return null;
}

export interface CataloguePanelCtx { host: HostV1; notify: () => void }

export function mountCataloguePanel(mount: HTMLElement, ctx: CataloguePanelCtx): StudioPanelHandle {
  mount.innerHTML = `
    ${panelHead(t('Catalogue'), tRaw("Files the design system keeps - drop them here and they land in the {link}, sorted into its sections, ready for every tool's asset picker.", { link: `<a href="#/c">${t('Catalogue')}</a>` }))}
    <div data-be-cat-dropzone></div>
    <div class="be-cat-groups" data-be-cat-groups aria-live="polite"></div>`;

  const groupsEl = mount.querySelector<HTMLElement>('[data-be-cat-groups]')!;
  const pickerHost = ctx.host as PickerHost;

  const render = (): void => { void paint(); };
  const paint = async (): Promise<void> => {
    let refs: Array<{ id: string; type: string; meta?: Record<string, unknown> }> = [];
    try { refs = await pickerHost.assets._listUserAssets(); } catch { /* fresh install - nothing yet */ }
    const uploads = refs.filter(r => !INTERNAL_ID.test(r.id));
    if (!mount.isConnected) return;
    if (!uploads.length) {
      groupsEl.innerHTML = `<p class="be-cat-empty">${t('Nothing yet - everything you add stays on this device.')}</p>`;
      return;
    }
    const byBucket = new Map<string, string[]>();
    for (const r of uploads) {
      const b = bucketOf(r); if (!b) continue;
      const name = String(r.meta?.name ?? r.id.split('/').pop() ?? '');
      (byBucket.get(b) ?? byBucket.set(b, []).get(b)!).push(name);
    }
    groupsEl.innerHTML = CAT_BUCKETS.map(({ key, label }) => {
      const names = byBucket.get(key) ?? [];
      if (!names.length) return '';
      return `<div class="be-cat-group">
          <span class="be-cat-group-label">${escape(t(label))}<span class="be-cat-group-n">${names.length}</span></span>
          <span class="be-cat-group-names">${names.slice(0, 6).map(n => `<span class="be-cat-name">${escape(n)}</span>`).join('')}${names.length > 6 ? `<span class="be-cat-more">${t('+{n} more', { n: names.length - 6 })}</span>` : ''}</span>
        </div>`;
    }).join('');
  };
  render();

  const dzMount = mount.querySelector<HTMLElement>('[data-be-cat-dropzone]')!;
  const teardownDz = mountUploadDropzone(dzMount, pickerHost, {
    onAdded: async () => { await paint(); ctx.notify(); },
  });

  return { render, teardown: teardownDz };
}
