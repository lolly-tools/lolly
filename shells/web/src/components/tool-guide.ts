// SPDX-License-Identifier: MPL-2.0
/**
 * The tool guide - a short "you have a render, now what?" walkthrough, declared
 * as manifest data (`guide` in tool.json, schemas/tool.schema.json) and rendered
 * here as a dialog. It exists for the last mile a canvas can't teach on its own:
 * an email signature is finished the moment it's pasted into Gmail's settings,
 * and nothing on the canvas says so.
 *
 * Data, not code - exactly like the tool it describes. Any tool can grow a guide
 * by adding the manifest block; nothing here is tool-specific, and the strings
 * come from the manifest (translated via the tool's own i18n sidecar under
 * `guide.*`), not from the shell's chrome catalog.
 *
 * Two entry points, both driven by views/tool.ts:
 *   • the help button beside the sidebar title (always available), and
 *   • one automatic open on a device's first visit to that tool, remembered in
 *     localStorage - the same tier as the welcome dialog's dismissal, and for
 *     the same reason: it's chrome state, never tool state (which belongs to
 *     host.state).
 *
 * The dialog also carries "Read the guide" (plan 354 D6): the docs pages and sections
 * mapped to this tool in docs/manifest.json (lib/tool-guides.ts), below the steps when
 * the tool has them and on their own when it does not. Each row opens the in-app
 * reader in place of this view, so one Back, or the reader's "← <tool>" pill, returns.
 */
import type { ToolGuide, ToolGuideTrack } from '@lolly-tools/core/contract';
import { escape } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { jellyActive } from '../lib/jelly.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import { toolGuideHref, toolGuideLabel, type ToolGuideRow } from '../lib/tool-guides.ts';
import { mountModal } from './modal.ts';

/** Tools whose guide has been auto-opened on this device, joined by `,`. */
const SEEN_KEY = 'lolly-guide-seen';

/** The manifest slice this component needs - kept structural so callers can pass
 *  an engine `ToolManifest` or a bare parsed manifest without a cast. */
export interface GuideManifest {
  id?: string;
  guide?: ToolGuide;
}

/** True when the tool ships a usable guide (at least one track with a step). */
export function hasGuide(manifest: GuideManifest | null | undefined): boolean {
  return !!manifest?.guide?.tracks?.some(track => track?.steps?.length);
}

/** Markup for the help button that opens the guide - mounted by the caller
 *  (views/tool.ts puts it in the sidebar header, beside the tool name, or beside the
 *  floating Home pill where there is no sidebar, with that row's FAB class). `hidden`
 *  renders it for a tool with no steps of its own, to be shown once its docs rows arrive. */
export function guideButtonHtml(id = 'tool-guide-btn', opts: { hidden?: boolean; className?: string } = {}): string {
  const label = t('How to use it');
  const cls = opts.className ?? 'tool-guide-btn';
  return `<button type="button" class="${escape(cls)}" id="${escape(id)}" data-tool-guide data-tip="${escape(label)}" aria-label="${escape(label)}" aria-haspopup="dialog"${opts.hidden ? ' hidden' : ''}>${icon('help', { className: 'tool-guide-icon' })}</button>`;
}

/** The "Read the guide" list: one link per docs page or section, the section's own name
 *  first and the page's title below. Escaped text only; hrefs are in-app reader routes built
 *  from a page path and an anchor id. */
export function guideRowsHtml(rows: readonly ToolGuideRow[], heading: boolean): string {
  if (!rows.length) return '';
  const title = t('Read the guide');
  return `<nav class="tool-guide-docs" aria-label="${escape(title)}">
      ${heading ? `<h3 class="tool-guide-docs-title">${escape(title)}</h3>` : ''}
      <ul class="tool-guide-docs-list">${rows.map(row => {
        const { title: name, page } = toolGuideLabel(row);
        // nosemgrep: lolly-href-escape-is-not-scheme-validation - toolGuideHref() always starts '#/docs/' (docsAppHref over a page path), so no scheme can arrive
        return `<li><a class="tool-guide-doc" href="${escape(toolGuideHref(row))}">${icon('document', { className: 'tool-guide-doc-icon' })}<span class="tool-guide-doc-text"><span class="tool-guide-doc-title">${escape(name)}</span>${page ? `<span class="tool-guide-doc-page">${escape(page)}</span>` : ''}</span></a></li>`;
      }).join('')}</ul>
    </nav>`;
}

/**
 * Open the guide dialog. No-op (returns null) for a tool without one.
 * The returned handle lets the caller close it on teardown - a guide left open
 * across a route change would outlive the tool it describes, since mountModal
 * bodies its dialog rather than nesting it in the view.
 */
export function showToolGuide(manifest: GuideManifest, docs: readonly ToolGuideRow[] = []): { close(): void } | null {
  const guide = hasGuide(manifest) ? manifest.guide : undefined;
  if (!guide && !docs.length) return null;

  const tracks = guide ? guide.tracks.filter(track => track?.steps?.length) : [];
  const title  = guide ? guide.title || t('How to use it') : t('Read the guide');
  const tabbed = tracks.length > 1;

  const tabs = tabbed ? `
    <div class="tool-guide-tabs" role="tablist" aria-label="${escape(title)}">
      ${tracks.map((track, i) => `
        <button type="button" class="tool-guide-tab" role="tab" data-track="${i}"
                id="tool-guide-tab-${i}" aria-controls="tool-guide-panel"
                aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}">${escape(track.label)}</button>`).join('')}
    </div>` : '';

  // With steps, the reader closes on "Got it"; a list of links alone closes on "Close".
  const done = guide ? t('Got it') : t('Close');
  const content = `
    <div class="tool-guide-body">
      <h2 class="tool-guide-title">${escape(title)}</h2>
      ${tabs}
      ${guide ? `<div class="tool-guide-panel" id="tool-guide-panel" role="${tabbed ? 'tabpanel' : 'group'}"
           ${tabbed ? `aria-labelledby="tool-guide-tab-0"` : ''}>${trackHtml(tracks[0]!)}</div>` : ''}
      ${guideRowsHtml(docs, !!guide)}
      <div class="tool-guide-actions">
        ${jellyActive()
          ? `<jelly-button variant="platinum" class="tool-guide-done" label="${escape(done)}">${escape(done)}</jelly-button>`
          : `<button type="button" class="btn btn--primary tool-guide-done">${escape(done)}</button>`}
      </div>
    </div>`;

  const modal = mountModal<void>(content, {
    className: 'tool-guide-dialog',
    ariaLabel: title,
    initialFocus: el => el.querySelector<HTMLElement>('.tool-guide-done'),
  });
  const dialog = modal.el;
  // A docs row REPLACES the history entry this dialog pushed for Back to close it, so the
  // reader sits where the tool did and one Back returns to the tool (lib/overlay-back.ts:
  // the route change tears the dialog down without popping that entry).
  dialog.querySelectorAll<HTMLAnchorElement>('.tool-guide-doc').forEach(link => {
    link.addEventListener('click', (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      location.replace(link.getAttribute('href') ?? '#/');
    });
  });
  const panel  = dialog.querySelector<HTMLElement>('.tool-guide-panel');
  const tabEls = [...dialog.querySelectorAll<HTMLButtonElement>('.tool-guide-tab')];

  const select = (index: number): void => {
    const track = tracks[index];
    if (!track || !panel) return;
    panel.innerHTML = trackHtml(track);
    panel.setAttribute('aria-labelledby', `tool-guide-tab-${index}`);
    tabEls.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
  };

  tabEls.forEach((tab, i) => {
    tab.addEventListener('click', () => { select(i); tab.focus(); });
    // Roving tabindex: ←/→ move between tabs, which is what a tablist promises.
    tab.addEventListener('keydown', (e: KeyboardEvent) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = (i + step + tabEls.length) % tabEls.length;
      select(next);
      tabEls[next]!.focus();
    });
  });

  dialog.querySelector('.tool-guide-done')?.addEventListener('click', () => modal.close());
  return { close: () => modal.close() };
}

/**
 * Open the guide the first time this device lands on the tool, then never again
 * on its own - the help button stays for anyone who wants it back. Returns the
 * handle when it opened, null otherwise (no guide, already seen, storage off).
 */
export function autoOpenToolGuide(manifest: GuideManifest): { close(): void } | null {
  const id = manifest.id;
  if (!id || !hasGuide(manifest)) return null;
  // An automated screenshot run never gets the first-run modal: it would bake a
  // dialog over the very tool a docs baseline is framing, and it would do it to
  // every tool shot at once, since a capture context is always a fresh device.
  // Asking the pin beats seeding one id per tool - a new tool cannot drift out of
  // it. See lib/capture-neutral.ts.
  if (captureNeutralPinned()) return null;
  if (guideSeen(id)) return null;
  markGuideSeen(id);
  return showToolGuide(manifest);
}

function guideSeen(id: string): boolean {
  try { return (localStorage.getItem(SEEN_KEY) ?? '').split(',').includes(id); }
  catch { return true; }   // storage off - never auto-open rather than open every visit
}

function markGuideSeen(id: string): void {
  try {
    const seen = (localStorage.getItem(SEEN_KEY) ?? '').split(',').filter(Boolean);
    if (!seen.includes(id)) localStorage.setItem(SEEN_KEY, [...seen, id].join(','));
  } catch { /* storage off - it just opens again next visit */ }
}

function trackHtml(track: ToolGuideTrack): string {
  const note = track.note ? `<p class="tool-guide-note">${inlineMarkup(track.note)}</p>` : '';
  return `<ol class="tool-guide-steps">${track.steps.map(step => `<li>${inlineMarkup(step)}</li>`).join('')}</ol>${note}`;
}

/** Escape first, then re-admit exactly one piece of markup: `**bold**`, for
 *  naming the control a step points at. Nothing else survives, so a manifest
 *  string can never inject markup - same stance as the logic-less templates. */
function inlineMarkup(text: string): string {
  return escape(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
