// SPDX-License-Identifier: MPL-2.0
/**
 * The Versions panel - publish, activate, restore (plan 97 section 6a, M7).
 *
 * A foot-pinned panel rather than a room, because versioning acts on the WHOLE
 * design system rather than on one part of it, and because a studio that has
 * never published must not carry a sixth room advertising machinery it does not
 * need. `views/start.ts` hides its rail entry until `hasPublishableSystem()`
 * says there is something to publish (or a `?area=versions` link asks for it
 * directly), which is plan 97 section 5's "hidden until the system has content".
 *
 * WHAT THIS FILE OWNS: the copy, the markup and which press calls what. Every
 * byte that reaches disk goes through `../versions-io.ts`, which goes through
 * `installUserTokens` - the one write chokepoint, where immutability is
 * actually enforced. Nothing here writes an asset itself.
 *
 * THE HONESTY RULES this panel is built around:
 *   - **A version is permanent, and the panel says so before the press**, not
 *     after. There is no delete in v1, so the storage line states what has been
 *     kept and that it stays kept, rather than offering a button that lies.
 *   - **Removals lead the compat card.** Added and changed tokens are news;
 *     a removed one is the thing that breaks a tool, so it is named first and
 *     called what it is.
 *   - **Publishing is not undoable; restoring is.** "Restore latest from this
 *     version" is an ordinary edit to the head, so it lands on the studio's undo
 *     stack and the panel offers the Undo straight away.
 *
 * ONE RAW-HTML SINK: `paint()` re-renders the whole panel from the pure
 * `versionsHtml(model)`. Everything after that - the live slug line, the error
 * line, the busy states - is `textContent`, `disabled` or `hidden`, never
 * markup. That is also why the label field's feedback is computed from the
 * in-memory ledger rather than from `publishPreview`: a repaint on every
 * keystroke would take the caret with it.
 *
 * ESC: the panel is not an overlay, so there is nothing here that Esc could
 * cancel into a commit. `collapse()` folds an open disclosure and reports it,
 * which is how the view's Esc stack (tray → palette sheet → leave) gets a rung
 * here without a publish ever being one keypress from happening.
 */

import { readVersionIndex, slugifyVersion, suggestNextLabel } from '../versions.ts';
import type { VersionEntry, VersionIndex } from '../versions.ts';
import {
  headAhead, publishPreview, publishVersion, readHeadDoc, readIndex,
  restoreLatestFrom, setActiveVersion, versionStorage,
} from '../versions-io.ts';
import type { VersionsIoCtx } from '../versions-io.ts';
import { activeHeadId } from '../active.ts';
import { fmtBytes } from '../../format.ts';
import { escape } from '../../../utils.ts';
import { announce } from '../../../a11y.ts';
import { t, tRaw } from '../../../i18n.ts';

export interface VersionsCtx extends VersionsIoCtx {
  /**
   * Step the head document back one edit - the studio's own undo, offered
   * straight after a restore. Absent in a degraded studio, in which case the
   * Undo is not shown rather than shown dead.
   */
  undo?: () => Promise<boolean>;
  /** The studio's rail note. Falls back to announce() when the view has none. */
  notify?: (msg: string, isError?: boolean) => void;
}

export interface VersionsRoom {
  /** Re-read and repaint. Cheap enough to call on every entry to the panel. */
  refresh: () => void;
  /** Fold an open disclosure; true when the Esc was consumed here. */
  collapse: () => boolean;
  teardown: () => void;
}

/** What the panel shows. Pure data: `versionsHtml` reads nothing else. */
export interface VersionsModel {
  /** There is a head document to publish. False on a studio with nothing in it. */
  publishable: boolean;
  index: VersionIndex;
  /** Prefill for the name field: the caller's own convention continued, or ''. */
  draftLabel: string;
  draftNote: string;
  /** The active version the head has moved on from, and by how much. */
  ahead: { label: string; changes: number } | null;
  compat: {
    /** No earlier version to compare against, so everything reads as added. */
    first: boolean;
    /** The label this diff is against ('' on a first publish). */
    baseline: string;
    added: string[];
    changed: string[];
    removed: string[];
    assets: Array<{ id: string; kind: 'added' | 'replaced' | 'removed' }>;
  };
  storage: { versions: number; frozen: number; bytes: number };
  /** Set for one paint after a restore, so the Undo has somewhere to live. */
  restored: string | null;
}

/** A long diff is a scroll, not a wall: the rest is named as a count. */
const MAX_DIFF_ROWS = 40;

const EMPTY_MODEL: VersionsModel = {
  publishable: false,
  index: { versions: [], active: null },
  draftLabel: '',
  draftNote: '',
  ahead: null,
  compat: { first: true, baseline: '', added: [], changed: [], removed: [], assets: [] },
  storage: { versions: 0, frozen: 0, bytes: 0 },
  restored: null,
};

/**
 * Is there anything here worth versioning?
 *
 * Two answers count: a ledger with something in it (versions exist, so the panel
 * is how you reach them), or a tokens document this device installed itself (the
 * user has a design system of their own to publish). A catalogue-supplied
 * document is deliberately NOT enough: publishing a pack somebody else ships,
 * from a studio that has not been touched, is machinery with nothing behind it.
 *
 * Cost: the head document is already memoised by the tokens bridge, so the only
 * new read is one keyed blob lookup, and it happens in the studio view alone - 
 * never on a render or an export path.
 */
export async function hasPublishableSystem(ctx: VersionsIoCtx): Promise<boolean> {
  const head = await readHeadDoc(ctx).catch(() => null);
  if (readVersionIndex(head).versions.length) return true;
  const assets = ctx.host.assets as unknown as { _getBlob?(id: string): Promise<Blob | null> };
  // The head of whatever design system is active - on a device that only has the
  // shipped one, that is the legacy id and this answers exactly as it did.
  try { return !!(await assets._getBlob?.(await activeHeadId(ctx.host))); }
  catch { return false; }
}

// ── Markup ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * One `<details>` of token paths. `summary` is already-translated markup (t()
 * output), so it is not escaped again - a locale string is allowed to carry
 * emphasis, and double-escaping would print the tags. Every PATH is escaped:
 * those come out of the user's own document.
 */
function pathListHtml(summary: string, paths: readonly string[], extraClass = ''): string {
  if (!paths.length) return '';
  const shown = paths.slice(0, MAX_DIFF_ROWS);
  const rest = paths.length - shown.length;
  return `
    <details class="ds-v-diff${extraClass}">
      <summary class="ds-v-diff-sum">${summary}</summary>
      <ul class="ds-v-paths" role="list">
        ${shown.map(p => `<li>${escape(p)}</li>`).join('')}
        ${rest ? `<li class="ds-v-more">${t('and {n} more', { n: rest })}</li>` : ''}
      </ul>
    </details>`;
}

function assetChangeText(change: { id: string; kind: 'added' | 'replaced' | 'removed' }): string {
  if (change.kind === 'added') return t('{id} added', { id: change.id });
  if (change.kind === 'removed') return t('{id} removed', { id: change.id });
  return t('{id} replaced', { id: change.id });
}

function compatHtml(model: VersionsModel): string {
  const { compat } = model;
  if (compat.first) {
    return `
      <div class="ds-v-compat">
        <p class="ds-v-compat-head">${t('Nothing has been published yet, so this version records the whole design system as it stands.')}</p>
      </div>`;
  }
  const nothing = !compat.added.length && !compat.changed.length && !compat.removed.length && !compat.assets.length;
  return `
    <div class="ds-v-compat">
      <p class="ds-v-compat-head">${t('What a tool would see, compared with {label}', { label: compat.baseline })}</p>
      ${nothing ? `<p class="ds-v-compat-none">${t('Nothing has changed since then. Publishing now records the same design system under a new name.')}</p>` : ''}
      ${pathListHtml(
        // Two whole t() calls, not one t() over a ternary: the translation
        // extractor (scripts/translate.ts) reads literals that FOLLOW `t(`, so a
        // key computed before the call is invisible to it and ships English in
        // all 26 locales. Same shape at every plural in this file.
        compat.removed.length === 1
          ? t('{n} removed. A tool naming it will lose it.', { n: compat.removed.length })
          : t('{n} removed. A tool naming one of these will lose it.', { n: compat.removed.length }),
        compat.removed, ' ds-v-diff--break')}
      ${pathListHtml(t('{n} changed', { n: compat.changed.length }), compat.changed)}
      ${pathListHtml(t('{n} added', { n: compat.added.length }), compat.added)}
      ${compat.assets.length ? `
        <p class="ds-v-compat-sub">${t('Files this version pins')}</p>
        <ul class="ds-v-assets" role="list">
          ${compat.assets.map(c => `<li class="ds-v-asset${c.kind === 'removed' ? ' ds-v-asset--break' : ''}">${assetChangeText(c)}</li>`).join('')}
        </ul>` : ''}
    </div>`;
}

function publishHtml(model: VersionsModel): string {
  return `
    <section class="ds-v-publish">
      <h3 class="ds-v-h3">${t('Publish a version')}</h3>
      <div class="ds-v-fields">
        <div class="be-field">
          <label class="field-label" for="ds-v-label">${t('Name')}</label>
          <input class="field-input" id="ds-v-label" type="text" autocomplete="off" spellcheck="false"
            aria-describedby="ds-v-slugline" data-ds-v-label data-ds-v-focus="label"
            value="${escape(model.draftLabel)}">
        </div>
        <div class="be-field">
          <label class="field-label" for="ds-v-note">${t('Note (optional)')}</label>
          <input class="field-input" id="ds-v-note" type="text" autocomplete="off"
            data-ds-v-note data-ds-v-focus="note" value="${escape(model.draftNote)}">
        </div>
      </div>
      <p class="ds-v-slugline" id="ds-v-slugline" data-ds-v-slugline></p>
      ${compatHtml(model)}
      <div class="ds-v-actions">
        <!-- aria-describedby, because the permanence line is not a caption: this
             press cannot be undone and there is no confirm step, so the sentence
             has to reach the accessibility tree AT the control rather than only
             sit under it in DOM order. -->
        <button type="button" class="be-btn be-cta ds-v-btn" data-ds-v-publish="active"
          aria-describedby="ds-v-permanent" data-ds-v-focus="publish-active">
          ${t('Publish and make active')}</button>
        <button type="button" class="be-btn ds-v-btn" data-ds-v-publish="only"
          aria-describedby="ds-v-permanent" data-ds-v-focus="publish-only">
          ${t('Publish only')}</button>
      </div>
      <p class="ds-v-permanent" id="ds-v-permanent">${t('Publishing cannot be undone. The name and the contents are kept exactly as they are now, so tools that pin this version keep drawing the same thing.')}</p>
    </section>`;
}

function rowHtml(entry: VersionEntry, active: boolean): string {
  const pins = entry.assets?.length ?? 0;
  return `
    <li class="ds-v-row${active ? ' is-active' : ''}">
      <div class="ds-v-row-main">
        <span class="ds-v-row-label">${escape(entry.label)}</span>
        ${active ? `<span class="ds-v-pill">${t('Active')}</span>` : ''}
        <span class="ds-v-row-slug">${escape(entry.slug)}</span>
        <span class="ds-v-row-date">${escape(fmtDate(entry.date))}</span>
      </div>
      ${entry.note ? `<p class="ds-v-row-note">${escape(entry.note)}</p>` : ''}
      ${pins ? `<p class="ds-v-row-pins">${pins === 1 ? t('Pins {n} file', { n: pins }) : t('Pins {n} files', { n: pins })}</p>` : ''}
      <div class="ds-v-row-acts">
        ${active ? '' : `
          <button type="button" class="be-btn ds-v-btn" data-ds-v-activate="${escape(entry.slug)}"
            data-ds-v-focus="activate:${escape(entry.slug)}">${t('Make active')}</button>`}
        <button type="button" class="be-btn ds-v-btn" data-ds-v-restore="${escape(entry.slug)}"
          data-ds-v-focus="restore:${escape(entry.slug)}">${t('Restore latest from this version')}</button>
      </div>
    </li>`;
}

function listHtml(model: VersionsModel): string {
  const { versions, active } = model.index;
  if (!versions.length) {
    return `<p class="ds-v-empty">${t('Nothing has been published yet.')}</p>`;
  }
  // Newest first: the thing a person came here to act on is almost always the
  // one they just made.
  const rows = [...versions].reverse().map(e => rowHtml(e, e.slug === active)).join('');
  return `
    <section class="ds-v-list-sec">
      <h3 class="ds-v-h3">${t('Published')}</h3>
      <ul class="ds-v-list" role="list">${rows}</ul>
      ${active ? `
        <div class="ds-v-actions">
          <button type="button" class="be-btn ds-v-btn" data-ds-v-follow data-ds-v-focus="follow">
            ${t('Follow the latest again')}</button>
        </div>
        <p class="ds-v-follow-note">${t('Tools and the app follow {label} right now. Following the latest again puts every edit live the moment it is made.', { label: activeLabel(model.index) })}</p>`
      : `<p class="ds-v-follow-note">${t('Nothing is active, so tools and the app follow the latest edit.')}</p>`}
    </section>`;
}

function activeLabel(index: VersionIndex): string {
  return index.versions.find(v => v.slug === index.active)?.label ?? index.active ?? '';
}

function storageHtml(model: VersionsModel): string {
  const { versions, frozen, bytes } = model.storage;
  if (!versions && !frozen) return '';
  return `
    <p class="ds-v-storage">${[
      versions === 1 ? t('{n} published version', { n: versions }) : t('{n} published versions', { n: versions }),
      frozen === 1 ? t('{n} preserved file', { n: frozen }) : t('{n} preserved files', { n: frozen }),
      escape(fmtBytes(bytes)),
    ].join(' · ')}</p>
    <p class="ds-v-storage-note">${t('A version cannot be deleted yet. The images it pins are kept on this device, so it keeps drawing them the way it did on the day it was published. Type follows whichever font file is installed for that family today.')}</p>`;
}

/** The whole panel for a model, or the resting line while the first read runs. */
export function versionsHtml(model: VersionsModel | null): string {
  if (!model) return `<p class="ds-v-loading">${t('Reading the design system…')}</p>`;

  return `
    <div class="ds-versions">
      <h2 class="ds-v-title" tabindex="-1" data-ds-v-focus="title">${t('Versions')}</h2>
      <p class="ds-v-sub">${t('A version is a permanent, named copy of the design system. Once published it never changes, and it stays on this device.')}</p>
      <p class="ds-v-err" data-ds-v-err role="alert" hidden></p>
      ${model.restored ? `
        <div class="ds-v-restored">
          <p class="ds-v-restored-txt">${t('Restored the latest from {label}.', { label: model.restored })}</p>
          <button type="button" class="be-btn ds-v-btn" data-ds-v-undo data-ds-v-focus="undo">${t('Undo')}</button>
        </div>` : ''}
      ${model.ahead ? `
        <div class="ds-v-ahead">
          <p class="ds-v-ahead-txt">${model.ahead.changes === 1
            ? t('Editing ahead of {label}. {n} change since it was published.',
              { label: model.ahead.label, n: model.ahead.changes })
            : t('Editing ahead of {label}. {n} changes since it was published.',
              { label: model.ahead.label, n: model.ahead.changes })}</p>
          <button type="button" class="be-btn ds-v-btn" data-ds-v-jump data-ds-v-focus="jump">${t('Publish')}</button>
        </div>` : ''}
      ${model.publishable ? publishHtml(model)
        : `<p class="ds-v-nothing">${t('There is nothing to publish yet. Add colours, type or logos first, then come back.')}</p>`}
      ${listHtml(model)}
      ${storageHtml(model)}
    </div>`;
}

// ── Mount ────────────────────────────────────────────────────────────────────

/**
 * Render the panel into `el` and wire it. `el`'s `hidden` state belongs to the
 * view; `refresh()` is what the view calls on entry.
 */
export function mountVersionsRoom(el: HTMLElement, ctx: VersionsCtx): VersionsRoom {
  let alive = true;
  let seq = 0;
  let model: VersionsModel | null = null;
  let busy = false;
  // Kept across repaints so an activate or a restore never eats what somebody
  // was halfway through typing. Cleared by a successful publish, which is the
  // one moment the suggestion becomes right again.
  let draftLabel: string | null = null;
  let draftNote = '';
  // One-shot: a restore arms it, the very next read spends it. So the Undo sits
  // there until something else happens, and it is gone before the studio's undo
  // stack can have moved on to somebody else's edit.
  let restoredOnce: string | null = null;

  const say = (msg: string, isError = false): void => {
    if (ctx.notify) ctx.notify(msg, isError);
    else announce(msg, { assertive: isError });
  };

  const $ = <T extends HTMLElement>(sel: string): T | null => el.querySelector<T>(sel);

  /** The focus key of whatever inside the panel has focus right now, or ''. */
  const focusKey = (): string => {
    const active = el.ownerDocument.activeElement as HTMLElement | null;
    if (!active || !el.contains(active)) return '';
    return active.closest<HTMLElement>('[data-ds-v-focus]')?.dataset.dsVFocus ?? '';
  };

  /**
   * Where focus has to land at the end of the action currently running.
   *
   * Captured by `act()` BEFORE anything is disabled, because the first thing an
   * action does is `setBusy(true)`, which disables the very control the press
   * came from - and per the HTML focus fixup rule a real browser then blurs it to
   * `<body>`. By the time the repaint asks `focusKey()` the live answer is gone,
   * so the panel's whole restore ladder would run on '' and bail. (jsdom does not
   * implement the fixup, which is why this could not be caught by watching
   * `document.activeElement` in a test - the guard test presses a button and
   * asserts the landing instead.)
   */
  let pendingFocus: { key: string; caret?: number } | null = null;

  /**
   * Put focus back where it was before a repaint.
   *
   * A whole-panel re-render destroys the control that was pressed, and a
   * keyboard user landing on `document.body` afterwards has lost their place.
   * The ladder: the same control, else the name field (the publish flow's home),
   * else the heading - which is why the heading carries `tabindex="-1"`. A
   * control that came back DISABLED (publish, after a name that has no
   * successor to suggest) is skipped rather than focused into a dead end.
   */
  const restoreFocus = (key: string, caret?: number): void => {
    if (!key) return;
    // CSS.escape is not needed: every key is either a fixed literal or a slug,
    // and a slug's grammar is [a-z0-9-] by construction (engine design-version).
    const same = $<HTMLElement>(`[data-ds-v-focus="${key}"]`);
    const usable = same && !(same as HTMLButtonElement).disabled ? same : null;
    const next = usable
      ?? $<HTMLElement>('[data-ds-v-focus="label"]')
      ?? $<HTMLElement>('[data-ds-v-focus="title"]');
    next?.focus();
    // Duck-typed, not `instanceof HTMLInputElement`: the constructor is a
    // property of the realm the node came from, and this module is also read
    // under a jsdom document that does not publish it as a global. What matters
    // is that the node can carry a caret.
    const field = next as (HTMLElement & Partial<HTMLInputElement>) | null;
    if (caret !== undefined && next === same && typeof field?.setSelectionRange === 'function') {
      try { field.setSelectionRange(caret, caret); } catch { /* not a text input */ }
    }
  };

  /**
   * The name field's verdict, computed from the ledger already in memory. Pure
   * and synchronous on purpose: this runs on every keystroke, and the panel must
   * not repaint (or read storage) while somebody is typing.
   */
  /** True while the name field's last verdict was a refusal - so the reason is
   *  announced once per transition, not once per keystroke. */
  let nameWasBad = false;

  const syncSlugLine = (): void => {
    const line = $<HTMLElement>('[data-ds-v-slugline]');
    const input = $<HTMLInputElement>('[data-ds-v-label]');
    if (!line || !input) return;
    const slug = slugifyVersion(input.value);
    const taken = !!slug && !!model?.index.versions.some(v => v.slug === slug);
    const bad = !slug || taken;
    const why = !slug
      ? t('Give the version a name using letters or numbers.')
      : t('That name is already used. Version names are permanent, so pick another.');
    // textContent, so tRaw: an escaped entity would be shown literally here.
    line.textContent = bad ? why : tRaw('Tools will address this version as {slug}.', { slug });
    line.classList.toggle('is-error', bad);
    // The refusal has to be PROGRAMMATIC, not a colour and a vanished button.
    // aria-invalid marks the field; the sentence is announced once on the way
    // into the bad state (a description that changes under a focused field is
    // announced by nothing, and re-announcing per keystroke is unusable).
    input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    if (bad && !nameWasBad && el.ownerDocument.activeElement === input) announce(why);
    nameWasBad = bad;
    const ok = !bad && !busy;
    for (const btn of el.querySelectorAll<HTMLButtonElement>('[data-ds-v-publish]')) btn.disabled = !ok;
  };

  /** Put `msg` in the panel's alert box. False when there is no box to put it in
   *  (the resting state), which is the caller's cue to announce it another way. */
  const showError = (msg: string): boolean => {
    const box = $<HTMLElement>('[data-ds-v-err]');
    if (!box) return false;
    box.textContent = msg;
    box.hidden = !msg;
    return true;
  };

  const setBusy = (on: boolean): void => {
    busy = on;
    for (const btn of el.querySelectorAll<HTMLButtonElement>('.ds-v-btn')) btn.disabled = on;
    if (!on) syncSlugLine();
  };

  const paint = (next: VersionsModel | null): void => {
    const live = focusKey();
    // The live answer first (a plain refresh while somebody is typing), then the
    // one `act()` captured before it disabled the control that was pressed.
    const key = live || pendingFocus?.key || '';
    const caret = live
      ? (el.ownerDocument.activeElement as HTMLInputElement | null)?.selectionStart ?? undefined
      : pendingFocus?.caret;
    pendingFocus = null;
    model = next;
    el.innerHTML = versionsHtml(next);
    if (next) syncSlugLine();
    restoreFocus(key, caret);
  };

  const read = async (): Promise<VersionsModel> => {
    const head = await readHeadDoc(ctx).catch(() => null);
    const index = await readIndex(ctx).catch(() => ({ versions: [], active: null } as VersionIndex));
    const publishable = head !== null && typeof head === 'object' && !Array.isArray(head);
    const ahead = await headAhead(ctx).catch(() => null);
    const preview = publishable
      ? await publishPreview(ctx, '').catch(() => null)
      : null;
    const storage = await versionStorage(ctx).catch(() => ({ versions: 0, frozen: 0, bytes: 0 }));
    const baseline = index.versions.find(v => v.slug === index.active) ?? index.versions[index.versions.length - 1];
    const restored = restoredOnce;
    restoredOnce = null;
    return {
      publishable,
      index,
      draftLabel: draftLabel ?? suggestNextLabel(index),
      draftNote,
      ahead: ahead?.ahead ? { label: ahead.label, changes: ahead.changes } : null,
      compat: {
        first: !baseline,
        baseline: baseline?.label ?? '',
        added: preview?.diff.added ?? [],
        changed: preview?.diff.changed ?? [],
        removed: preview?.diff.removed ?? [],
        assets: preview?.assetChanges ?? [],
      },
      storage,
      restored,
    };
  };

  const refresh = (): void => {
    const mine = ++seq;
    void read()
      .catch(() => EMPTY_MODEL)
      // A slower earlier read must never repaint over a newer one.
      .then(next => { if (alive && mine === seq && el.isConnected) paint(next); });
  };

  /**
   * Run one action, then re-read. Errors become a sentence, never a stack: every
   * throw versions-io.ts raises is already a translated line written for exactly
   * this place.
   */
  const act = async (run: () => Promise<string | null>): Promise<void> => {
    if (busy) return;
    // Before setBusy: disabling the pressed control blurs it to <body> in a real
    // browser, and this is the last moment its identity is knowable.
    const held = {
      key: focusKey(),
      caret: (el.ownerDocument.activeElement as HTMLInputElement | null)?.selectionStart ?? undefined,
    };
    showError('');
    setBusy(true);
    let done: string | null = null;
    try {
      done = await run();
    } catch (err) {
      const msg = String((err as { message?: unknown })?.message ?? err);
      // ONE announcement. The box is `role="alert"`, so writing it speaks the
      // sentence; also pushing it through the rail's polite region would say it
      // twice, print it twice, and downgrade an error to a polite one on the way.
      // `say` is the fallback for the resting state, which has no box.
      if (!showError(msg)) say(msg, true);
      setBusy(false);
      // No repaint on this path, so nothing else will re-seat focus: put it back
      // beside the alert the user now has to read.
      restoreFocus(held.key, held.caret);
      return;
    }
    setBusy(false);
    // One sentence per completed action, through the view's own live region.
    if (done) say(done);
    pendingFocus = held;
    refresh();
  };

  const onInput = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (target.matches?.('[data-ds-v-label]')) {
      draftLabel = (target as HTMLInputElement).value;
      syncSlugLine();
    } else if (target.matches?.('[data-ds-v-note]')) {
      draftNote = (target as HTMLInputElement).value;
    }
  };

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement;

    const publish = target.closest<HTMLElement>('[data-ds-v-publish]')?.dataset.dsVPublish;
    if (publish) {
      const name = ($<HTMLInputElement>('[data-ds-v-label]')?.value ?? '').trim();
      const note = ($<HTMLInputElement>('[data-ds-v-note]')?.value ?? '').trim();
      void act(async () => {
        const entry = await publishVersion(ctx, { label: name, note, activate: publish === 'active' });
        draftLabel = null;   // the next suggestion is right again
        draftNote = '';
        return publish === 'active'
          ? tRaw('Published {label} and made it active.', { label: entry.label })
          : tRaw('Published {label}.', { label: entry.label });
      });
      return;
    }

    const activate = target.closest<HTMLElement>('[data-ds-v-activate]')?.dataset.dsVActivate;
    if (activate) {
      void act(async () => {
        await setActiveVersion(ctx, activate);
        const label = model?.index.versions.find(v => v.slug === activate)?.label ?? activate;
        return tRaw('Tools and the app now follow {label}.', { label });
      });
      return;
    }

    if (target.closest('[data-ds-v-follow]')) {
      void act(async () => {
        await setActiveVersion(ctx, null);
        return t('Following the latest again. Every edit is live straight away.');
      });
      return;
    }

    const restore = target.closest<HTMLElement>('[data-ds-v-restore]')?.dataset.dsVRestore;
    if (restore) {
      const label = model?.index.versions.find(v => v.slug === restore)?.label ?? restore;
      void act(async () => {
        const ok = await restoreLatestFrom(ctx, restore);
        if (!ok) throw new Error(t('That version could not be read, so nothing was changed.'));
        restoredOnce = label;
        return tRaw('Restored the latest from {label}.', { label });
      });
      return;
    }

    if (target.closest('[data-ds-v-undo]')) {
      void act(async () => {
        if (!(await ctx.undo?.())) throw new Error(t('There is nothing to undo.'));
        return t('Undone.');
      });
      return;
    }

    if (target.closest('[data-ds-v-jump]')) {
      $<HTMLInputElement>('[data-ds-v-label]')?.focus();
    }
  };

  paint(null);
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  refresh();

  return {
    refresh,
    collapse: () => {
      const open = el.querySelector<HTMLDetailsElement>('details[open]');
      if (!open) return false;
      const held = el.ownerDocument.activeElement;
      open.open = false;
      // Only re-seat focus if the fold was holding it - otherwise closing a
      // disclosure would steal the caret out of the name field.
      if (held && open.contains(held)) open.querySelector<HTMLElement>('summary')?.focus();
      return true;
    },
    teardown: () => {
      alive = false;
      el.removeEventListener('click', onClick);
      el.removeEventListener('input', onInput);
    },
  };
}
