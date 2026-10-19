// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system context strip (plan 286 section 5.1): which design system a
 * surface reads, which context of it, and the theme choices in force. The compact
 * line gives the system, the version or context and the source; the disclosure
 * holds the details a person checks less often: where the source came from,
 * whether it is read-only, every choice and any choice that fell back.
 *
 * Three contexts, kept apart because they can differ (plan 286 section 4.1): the
 * render version a document draws with, the editable head Start works on, and a
 * candidate under review. Design's Document controls show the render version;
 * the comparison and release surfaces show the head and the candidate. Tool
 * sidebars do not carry the strip.
 *
 * Nothing here writes. The strip reads a snapshot, and its actions are the
 * caller's: the read-only inspector, or a document choice the caller owns.
 */
import type { TokensSnapshot } from '@lolly-tools/core/host-v1';
import { resolveTokenSelection } from '../../../../engine/src/token-selection.ts';
import { DESIGN_VERSION_LATEST } from '../../../../engine/src/design-version.ts';
import { themeOptionLabel } from '../lib/theme-option-label.ts';
import { icon } from '../lib/icons.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import './token-context-strip.css';

/** The render version a document draws with, Start's editable head, or a candidate under review. */
export type TokenContextKind = 'render' | 'head' | 'candidate';

export interface TokenContextOptions {
  /** Which context the snapshot describes. Defaults to the render version. */
  context?: TokenContextKind;
  /** The document's own theme choices, when it made any. Absent means the snapshot's choices are the design system's. */
  selection?: Readonly<Record<string, string>>;
  /** Say whether the choices belong to the document or follow the design system. Absent says neither. */
  scope?: 'document' | 'system';
  /** Which choices the compact line names: every group, or only the ones the document chose. */
  choices?: 'all' | 'document';
  /** A denser layout for a panel column. */
  compact?: boolean;
}

/** One theme group and the option in force, with readable labels. */
export interface TokenContextChoice {
  group: string;
  option: string;
  /** The document chose this option itself. */
  chosen: boolean;
}

/** What the strip shows. Pure data, so a caller that builds markup can test the model directly. */
export interface TokenContextModel {
  label: string;
  context: TokenContextKind;
  /** The render version's readable name. Only a render version carries one. */
  version: string;
  source: string;
  /** The hosted instance's host name, never its full address. */
  instance: string;
  locked: boolean;
  scope?: 'document' | 'system';
  /** Every group, in the design system's order. */
  choices: TokenContextChoice[];
  /** What the compact line names. */
  shown: TokenContextChoice[];
  /** Choices the document asked for that this design system does not offer. */
  unavailable: string[];
  compact: boolean;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const groupLabel = (group: string): string => group || t('Theme');

function sourceText(source: string | undefined): string {
  if (source === 'shipped') return t('Bundled with this app');
  if (source === 'local') return t('Local copy');
  if (source === 'file') return t('Imported file');
  if (source === 'hosted') return t('Hosted source');
  return '';
}

/** The host name of a hosted instance. User names, passwords and paths stay out of the strip. */
function instanceHost(instance: string | undefined): string {
  if (!instance) return '';
  try { return new URL(instance).host; } catch { return ''; }
}

/** Read a snapshot into what the strip shows. */
export function tokenContextModel(snapshot: TokensSnapshot, opts: TokenContextOptions = {}): TokenContextModel {
  const doc = snapshot.document;
  const own = opts.selection && Object.keys(opts.selection).length ? opts.selection : undefined;
  const resolved = resolveTokenSelection(doc, own ? { selection: { ...own } } : {});
  const effective = own ? resolved.choices : { ...resolved.choices, ...(snapshot.selection.choices ?? {}) };
  const names = new Map(resolved.groups.map((group) => [group.id, new Map(group.options.map((option) => [option.id, option.name]))]));
  const choices: TokenContextChoice[] = Object.entries(effective).map(([group, option]) => ({
    group: groupLabel(group),
    option: themeOptionLabel(names.get(group)?.get(option) ?? option),
    chosen: !!own && Object.hasOwn(own, group) && own[group] === option,
  }));
  const unavailable = Object.entries(own ?? {})
    .filter(([group, option]) => !names.get(group)?.has(option))
    .map(([group, option]) => `${groupLabel(group)}: ${option}`);
  const raw = snapshot.version;
  const version = !raw || raw.toLowerCase() === DESIGN_VERSION_LATEST || raw.toLowerCase() === 'head' ? t('Latest') : raw;
  return {
    label: snapshot.system?.label || t('Design system'),
    context: opts.context ?? 'render',
    version,
    source: sourceText(snapshot.system?.source),
    instance: snapshot.system?.source === 'hosted' ? instanceHost(snapshot.system.instance) : '',
    locked: !!snapshot.system?.locked,
    ...(opts.scope ? { scope: opts.scope } : {}),
    choices,
    shown: opts.choices === 'document' ? choices.filter((choice) => choice.chosen) : choices,
    unavailable,
    compact: !!opts.compact,
  };
}

/**
 * A snapshot for a token document that is not the render context, such as Start's
 * head or a candidate under review. `selection` is a previewed choice, read over the
 * document's own.
 */
export function documentSnapshot(document: unknown, opts: { system?: TokensSnapshot['system']; selection?: Readonly<Record<string, string>> } = {}): TokensSnapshot {
  const choices = record(document) ? resolveTokenSelection(document, opts.selection ? { selection: { ...opts.selection } } : {}).choices : {};
  return { document, system: opts.system ?? null, version: null, selection: Object.keys(choices).length ? { choices } : {} };
}

function contextChip(model: TokenContextModel): string {
  if (model.context === 'head') return t('Editable head');
  if (model.context === 'candidate') return t('Candidate');
  return `${t('Render version')}: ${model.version}`;
}

function contextSentence(model: TokenContextModel): string {
  if (model.context === 'head') return t('The working copy in Start, including edits that are not published yet.');
  if (model.context === 'candidate') return t('A proposed change. Nothing changes until it is applied.');
  return t('The design system version this document draws with.');
}

const choiceText = (choice: TokenContextChoice): string => `${choice.group}: ${choice.option}`;

function detailsHtml(model: TokenContextModel, open: boolean): string {
  const rows: string[] = [`<dt>${t('Context')}</dt><dd>${esc(contextSentence(model))}</dd>`];
  if (model.source) rows.push(`<dt>${t('Source')}</dt><dd>${esc(model.source)}${model.instance ? ` (${esc(model.instance)})` : ''}</dd>`);
  if (model.locked) rows.push(`<dt>${t('Editing')}</dt><dd>${esc(t('Read-only. Start can make an editable copy.'))}</dd>`);
  if (model.choices.length) {
    const items = model.choices.map((choice) => `<li>${esc(choiceText(choice))}${choice.chosen ? ` (${esc(t('chosen for this document'))})` : ''}</li>`).join('');
    rows.push(`<dt>${t('Theme choices')}</dt><dd><ul>${items}</ul></dd>`);
  }
  if (model.unavailable.length) {
    const items = model.unavailable.map((choice) => `<li>${esc(t('{choice} is not offered by this design system, so its default is used.', { choice }))}</li>`).join('');
    rows.push(`<dt>${t('Fallbacks')}</dt><dd><ul>${items}</ul></dd>`);
  }
  return `<details class="token-context-details" data-token-context-details${open ? ' open' : ''}><summary>${icon('chevronRight', { size: 14, className: 'section-card-chev' })}<span>${t('Source and fallbacks')}</span></summary><dl>${rows.join('')}</dl></details>`;
}

/** The actions a caller wires: the read-only inspector, and returning a document to the design system's choices. */
export interface TokenContextActions {
  inspect?: boolean;
  follow?: boolean;
  /** Draw the disclosure open, so a caller that repaints keeps the state the person chose. */
  open?: boolean;
}

/** The strip's inner markup. Every value from a document or a system record is escaped. */
export function tokenContextStripBody(model: TokenContextModel, actions: TokenContextActions = {}): string {
  const scope = model.scope === 'document' ? t('Chosen for this document') : model.scope === 'system' ? t('Follows the design system') : '';
  return `<strong>${esc(model.label)}</strong>`
    + `<span class="chip chip--status" data-token-context-kind="${model.context}">${esc(contextChip(model))}</span>`
    + (model.source ? `<span class="chip chip--status">${esc(model.source)}</span>` : '')
    + (scope ? `<span class="chip chip--status" data-token-context-scope="${model.scope}">${esc(scope)}</span>` : '')
    + (model.shown.length ? `<p>${esc(model.shown.map(choiceText).join(' · '))}</p>` : '')
    + (actions.inspect ? `<button type="button" class="btn btn--ghost btn--sm" data-token-context-inspect>${t('Inspect tokens')}</button>` : '')
    + (actions.follow && model.scope === 'document' ? `<button type="button" class="btn btn--ghost btn--sm" data-token-context-follow>${t('Follow the design system')}</button>` : '')
    + detailsHtml(model, !!actions.open);
}

/** The whole strip as markup, for a surface that builds its panel from a string. */
export function tokenContextStripHtml(model: TokenContextModel, actions: TokenContextActions = {}): string {
  return `<div class="token-context-strip card card--sub${model.compact ? ' token-context-strip--compact' : ''}" role="group" aria-label="${esc(t('Design system context'))}" data-token-context>${tokenContextStripBody(model, actions)}</div>`;
}

/** One captured context, using the shared card, chips and action primitive. `inspect` null draws no Inspect action. */
export function mountTokenContextStrip(root: HTMLElement, snapshot: TokensSnapshot, inspect: (() => void | Promise<void>) | null, opts: TokenContextOptions = {}): () => void {
  const model = tokenContextModel(snapshot, opts);
  root.classList.add('token-context-strip', 'card', 'card--sub');
  if (model.compact) root.classList.add('token-context-strip--compact');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', t('Design system context'));
  root.innerHTML = tokenContextStripBody(model, { inspect: !!inspect });
  const button = root.querySelector<HTMLButtonElement>('[data-token-context-inspect]');
  const open = (): void => { if (inspect && button) void Promise.resolve(inspect()).catch(() => { button.textContent = t('Tokens could not be read.'); }); };
  button?.addEventListener('click', open);
  return () => { button?.removeEventListener('click', open); root.replaceChildren(); };
}
