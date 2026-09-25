// SPDX-License-Identifier: MPL-2.0
/**
 * The export panel's rights row (plan 253 section 4): what the recorded sources
 * ask of THIS delivery, and the one inline card that lets a person answer.
 *
 * Three rules the plan sets and this module keeps:
 *
 * 1. **A licence with conditions is not an error.** ShareAlike is a permitted-use
 *    choice somebody made, so the card that asks for a decision is toned like the
 *    rest of the panel. There is no green shield either: a shield would read as
 *    "checked and cleared", which is a claim nobody here can make.
 * 2. **Passive assurance is measured, never assumed.** The row says credits WILL
 *    be included until the host hands back a receipt whose state is
 *    `readback-confirmed` for this exact evaluation. Anything else stays in the
 *    future tense, and a promised credential that did not survive the write reads
 *    as a failed delivery with a retry rather than a silent raw file.
 * 3. **The Download button is never gated.** `actions-required` shows the card and
 *    lets the export proceed through the plan's channels (plan section 4.2): a
 *    private draft must stay usable while a sharing decision is still open.
 *
 * Assistive tech hears one polite line per NEW issue, keyed by code and work, so
 * a recalculation on every paint does not become a stream of interruptions.
 *
 * The view half (`rightsView`) is pure and takes an evaluation plus a receipt, so
 * every state in the plan's vocabulary is reachable from a fixture in a test. The
 * DOM half paints that view; the mount wires it to a runtime.
 */
import { attributionCredits, licenceDisplayName, licenceProfile } from '@lolly/engine';
import type {
  AttributionReceiptV1,
  RightsDecisionV1,
  RightsEvaluationV1,
  RightsIssueCodeV1,
  RightsIssueV1,
  RightsRemedyV1,
} from '@lolly-tools/core/rights-v1';
import { announce } from '../../a11y.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { escape as escapeText } from '../../utils.ts';
import { setEmojiDocumentStyle } from '../tool/emoji-doc.ts';
import { bindOp, type ActionsCtx } from './context.ts';

/** What a card asks a person to do. `retry` is the row's own; the rest are the
 *  evaluator's remedies. A remedy with nowhere to go in this panel (adding source
 *  information, or delivering a package) draws no button rather than a dead one. */
export type RightsActionKind = RightsRemedyV1['kind'] | 'retry';

export interface RightsRowAction {
  kind: RightsActionKind;
  label: string;
  /** The canonical licence id an output-licence action would record. */
  licence?: string;
}

export interface RightsRowCard {
  /** Stable per issue and work, so one work with 300 placements is one card. */
  key: string;
  code: RightsIssueCodeV1 | 'credential.delivery-failed';
  /** The work this card is about, when it names one. */
  work: string | null;
  /** The plan's own wording for the state. */
  line: string;
  /** The named work and what was done to it, so the decision has a subject. */
  scope: string;
  actions: RightsRowAction[];
  /** A short text field for a permission the person holds separately. */
  permission: boolean;
}

export interface RightsRowView {
  /** False until this render actually places a recorded work. */
  show: boolean;
  /** `action` means something is waiting for a person. Never an error tone. */
  tone: 'quiet' | 'action';
  headline: string;
  credits: string;
  showCredits: boolean;
  /** Open the credits beside the action a person has to carry out by hand. */
  creditsOpen: boolean;
  cards: RightsRowCard[];
  /** One line per new issue, for a polite announcement. */
  announce: { key: string; text: string }[];
}

/** What the row can actually do on this mount, so no button is drawn that does nothing. */
export interface RightsRowCapabilities {
  /** A failed credential can be tried again by running the export once more. */
  retry?: boolean;
  /** The artwork's own colours can be restored (the emoji treatment). */
  keepOriginal?: boolean;
  /** Another source set can be picked. */
  replaceWork?: boolean;
}

// ─── The view model (pure - this is the tested half) ─────────────────────────

/**
 * The plan's vocabulary, one line per issue. Anything unmapped keeps the
 * evaluator's own English summary rather than inventing a friendlier claim.
 *
 * `licence.unknown` is deliberately read by RULE and not by code, because the
 * four rules that raise it say four different things and only one of them is
 * "not recorded". A licence that IS recorded and whose conditions are not yet
 * interpreted must not be reported as absent: that is a false statement about
 * the catalog entry, and the catalog sheet already says the honest thing for the
 * same asset (plan section 4.1 reserves the missing-information wording for the
 * state where the information really is missing).
 */
function issueLine(issue: RightsIssueV1): string {
  switch (issue.code) {
    case 'licence.adaptation-choice':
      return t('If you share this adaptation, it needs a compatible licence.');
    case 'licence.grant-conflict':
      return t('Two licence declarations disagree.');
    case 'licence.unknown':
      return unknownLicenceLine(issue);
    case 'attribution.source-missing':
      return t('Part of the required credit is not recorded.');
    case 'attribution.delivery-missing':
      return t('Add this credit to the post description.');
    case 'source.redistribution-unknown':
      return t('Permission to pass on the source file itself is not recorded.');
    default:
      return issue.summary;
  }
}

/** The rules that mean the licence really was not recorded, as against recorded and not interpreted. */
const NOT_RECORDED_RULES: ReadonlySet<string> = new Set(['licence-unparsed-v1', 'work-record-missing-v1']);

function unknownLicenceLine(issue: RightsIssueV1): string {
  if (!issue.rule || NOT_RECORDED_RULES.has(issue.rule)) return t('Source licence not recorded.');
  if (issue.rule === 'licence-choice-unselected-v1') return t('This source offers a choice of licence and none is selected.');
  // `licence-recognised-not-reviewed-v1`, `licence-not-in-rules-v1` and
  // `licence-expression-cumulative-v1` each name what WAS recorded, so the
  // evaluator's own sentence is the accurate one.
  return issue.summary;
}

/** Codes that report a MISSING fact rather than a decision somebody owes. */
const GAP_CODES: ReadonlySet<string> = new Set(['licence.unknown', 'attribution.source-missing', 'source.redistribution-unknown']);

/**
 * The neutral line for a work whose recorded terms ask for nothing. Named after
 * the dedication that was actually recorded, because CC0 and the public domain
 * dedication are different documents and this row must not put one's name on the
 * other.
 */
function dedicationLine(licence: string | undefined): string {
  if (licence === 'CC0-1.0') return t('No required credit under the recorded CC0 dedication.');
  const name = licence ? (licenceProfile(licence)?.name ?? licence) : '';
  return name
    ? tRaw('No required credit under the recorded {licence} dedication.', { licence: name })
    : t('No credit is required for this use of the recorded sources.');
}

/** The remedy as a button, in the words this surface uses for it. */
function actionFor(remedy: RightsRemedyV1, caps: RightsRowCapabilities): RightsRowAction | null {
  switch (remedy.kind) {
    case 'output-licence': {
      // The engine's own name table, which also carries the licences on the CC
      // compatible list that have no profile of their own, so a button never
      // reads `FAL-1.3` at somebody.
      const name = remedy.licence ? licenceDisplayName(remedy.licence) : '';
      return { kind: 'output-licence', label: tRaw('Share the adaptation under {licence}', { licence: name }), ...(remedy.licence ? { licence: remedy.licence } : {}) };
    }
    case 'keep-original':
      return caps.keepOriginal ? { kind: 'keep-original', label: t('Keep the original colours') } : null;
    case 'replace-work':
      return caps.replaceWork ? { kind: 'replace-work', label: t('Use a different set') } : null;
    case 'separate-permission':
      return { kind: 'separate-permission', label: t('Record separate permission') };
    case 'copy-credit':
      return { kind: 'copy-credit', label: t('Copy credit') };
    default:
      return null;
  }
}

/** The work's title as the credit spells it, so the card names what the reader sees. */
function workTitle(evaluation: RightsEvaluationV1, work: string | undefined): string | null {
  if (!work) return null;
  const notice = [...evaluation.plan.required, ...evaluation.plan.optional].find((n) => n.work === work);
  return notice?.credit.match(/^"([^"]+)"/)?.[1] ?? work;
}

/** The named work and the recorded changes: the subject of the decision. */
function scopeFor(evaluation: RightsEvaluationV1, work: string | undefined): string {
  const title = workTitle(evaluation, work);
  if (!title) return '';
  const notice = [...evaluation.plan.required, ...evaluation.plan.optional].find((n) => n.work === work);
  // The notice keeps each recorded modification as the sentence the producer
  // wrote, joined with a comma, so the field matches the credential word for
  // word. Read as one line that leaves a stop before every comma; the prose
  // credit trims them the same way (rights-evaluate.ts changeText).
  const changes = notice?.changes?.replace(/\.(, )/g, '$1');
  return changes && changes !== 'unchanged'
    ? tRaw('{work}. What changed: {changes}', { work: title, changes })
    : tRaw('{work}. Recorded as unchanged.', { work: title });
}

/**
 * Whether the receipt describes THIS evaluation. A receipt carries the
 * fingerprint of the inputs it was measured against, so a changed set, treatment,
 * format or decision leaves the old receipt behind instead of speaking for a file
 * nobody exported.
 */
function receiptForThis(evaluation: RightsEvaluationV1, receipt: AttributionReceiptV1 | null): AttributionReceiptV1 | null {
  return receipt && receipt.fingerprint === evaluation.fingerprint ? receipt : null;
}

/**
 * The row, from one evaluation and whatever the last export measured.
 *
 * Precedence: a measured delivery speaks first (it is about real bytes), then the
 * decisions a person still owes, then the quiet statement about what the export
 * will carry.
 */
export function rightsView(
  evaluation: RightsEvaluationV1,
  receipt: AttributionReceiptV1 | null,
  caps: RightsRowCapabilities = {},
): RightsRowView {
  const required = evaluation.plan.required;
  const optional = evaluation.plan.optional;
  if (!evaluation.uses.length) {
    return { show: false, tone: 'quiet', headline: '', credits: '', showCredits: false, creditsOpen: false, cards: [], announce: [] };
  }
  const credits = attributionCredits(evaluation.plan);
  const measured = receiptForThis(evaluation, receipt);
  const confirmed = measured?.state === 'readback-confirmed';
  const failed = Boolean(measured && !confirmed && required.length && measured.remaining.some((issue) => issue.code === 'credential.ingredient-missing'));
  const companion = evaluation.plan.channels.includes('readable-companion');

  const cards: RightsRowCard[] = [];
  if (failed && measured) {
    cards.push({
      key: 'credential.delivery-failed',
      code: 'credential.delivery-failed',
      work: null,
      line: t('The credits are not in the file that was delivered.'),
      scope: measured.expected.length
        ? tRaw('{found} of {expected} recorded sources were found in the file.', { found: String(measured.observed.length), expected: String(measured.expected.length) })
        : '',
      actions: [
        ...(caps.retry ? [{ kind: 'retry' as const, label: t('Export again') }] : []),
        { kind: 'copy-credit' as const, label: t('Copy credit') },
      ],
      permission: false,
    });
  }
  for (const issue of evaluation.issues) {
    const actions = issue.remedies.map((remedy) => actionFor(remedy, caps)).filter((a): a is RightsRowAction => a !== null);
    cards.push({
      key: `${issue.code}:${issue.work ?? ''}`,
      code: issue.code,
      work: issue.work ?? null,
      line: issueLine(issue),
      scope: scopeFor(evaluation, issue.work),
      actions,
      permission: issue.remedies.some((remedy) => remedy.kind === 'separate-permission'),
    });
  }

  // A missing fact is never reported as "nothing to do": an unrecorded licence
  // produces no required notice, and reading that silence as "no credit is
  // required" would turn a gap into an assurance (plan section 4.3). The
  // headline for a gap is the gap's own line, so a licence that was recorded and
  // not yet interpreted is not announced as absent.
  const gapIssue = evaluation.issues.find((issue) => GAP_CODES.has(issue.code));
  const headline = failed
    ? t('The credits are not in the file that was delivered.')
    : confirmed
      ? t("Credits included in this file's metadata.")
      : required.length
        ? companion
          ? t('Credits and credentials are in the download package.')
          : t('Source credits will be included.')
        : gapIssue
          ? issueLine(gapIssue)
          : optional.length
            ? dedicationLine(optional[0]?.licence)
            : t('No credit is required for this use of the recorded sources.');

  const deliveryByHand = cards.some((card) => card.code === 'attribution.delivery-missing') || failed;
  return {
    show: true,
    tone: cards.length ? 'action' : 'quiet',
    headline,
    credits,
    showCredits: Boolean(credits),
    creditsOpen: Boolean(credits) && deliveryByHand,
    cards,
    announce: cards.map((card) => ({ key: card.key, text: card.line })),
  };
}

// ─── DOM ─────────────────────────────────────────────────────────────────────

/**
 * The card, hidden until {@link paintRightsRow} has something true to say - the
 * same shape the preflight control uses, so the panel keeps one card anatomy.
 * It is a STATEMENT plus, when a decision is owed, the decision itself. It never
 * gates Download.
 */
export function rightsRowHtml(): string {
  return `
      <div class="section-card export-rights" data-rights-section hidden>
        <span class="section-card-head">${icon('users', { className: 'section-card-icon' })}<span>${escapeText(t('Source credits'))}</span></span>
        <p class="section-card__hint" data-rights-headline></p>
        <div class="export-rights-cards" data-rights-cards></div>
        <details class="export-rights-details" data-rights-credit hidden>
          <summary class="export-rights-summary">${escapeText(t('Details'))}</summary>
          <pre class="export-rights-credit" data-rights-credit-text></pre>
          <button type="button" class="btn btn--sm" data-action="rights-copy">${escapeText(t('Copy credit'))}</button>
        </details>
        <p class="export-rights-status" data-rights-status role="status" hidden></p>
      </div>`;
}

/** One element, its class and its text. Keeps the builder below readable. */
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Built as nodes rather than as markup, on purpose. The card carries a credit
 * line, a licence name and a note somebody typed, and every one of those comes
 * from a source record. `textContent` cannot be talked into markup, so there is
 * no raw-HTML sink here to keep escaped.
 */
function cardNode(card: RightsRowCard): HTMLElement {
  const box = el('div', 'export-rights-card');
  box.dataset.rightsCard = card.key;
  box.appendChild(el('p', 'export-rights-card-line', card.line));
  if (card.scope) box.appendChild(el('p', 'export-rights-card-scope', card.scope));
  const actions = el('div', 'export-rights-card-actions');
  card.actions.forEach((action, i) => {
    const button = el('button', 'btn btn--sm', action.label) as HTMLButtonElement;
    button.type = 'button';
    button.dataset.rightsAction = String(i);
    actions.appendChild(button);
  });
  box.appendChild(actions);
  if (card.permission) {
    const field = el('div', 'export-rights-permission');
    field.dataset.rightsPermission = '';
    field.hidden = true;
    const id = `rights-note-${card.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const label = el('label', 'export-rights-permission-label', t('What permission do you hold? This is recorded as your own statement.')) as HTMLLabelElement;
    label.htmlFor = id;
    const input = el('input', 'field-input') as HTMLInputElement;
    input.type = 'text';
    input.id = id;
    input.dataset.rightsNote = '';
    const save = el('button', 'btn btn--sm', t('Record it')) as HTMLButtonElement;
    save.type = 'button';
    save.dataset.rightsNoteSave = '';
    field.append(label, input, save);
    box.appendChild(field);
  }
  return box;
}

/** Write one view into the card. Returns the cards it painted, in order. */
export function paintRightsRow(root: ParentNode, view: RightsRowView): RightsRowCard[] {
  const section = root.querySelector<HTMLElement>('[data-rights-section]');
  if (!section) return [];
  section.hidden = !view.show;
  if (!view.show) return [];
  section.dataset.tone = view.tone;
  const headline = section.querySelector<HTMLElement>('[data-rights-headline]');
  if (headline) headline.textContent = view.headline;
  const cards = section.querySelector<HTMLElement>('[data-rights-cards]');
  cards?.replaceChildren(...view.cards.map(cardNode));
  const credit = section.querySelector<HTMLDetailsElement>('[data-rights-credit]');
  if (credit) {
    credit.hidden = !view.showCredits;
    if (view.creditsOpen) credit.open = true;
    const text = credit.querySelector<HTMLElement>('[data-rights-credit-text]');
    if (text) text.textContent = view.credits;
  }
  return view.cards;
}

// ─── The mount ───────────────────────────────────────────────────────────────

/** The slice of the runtime this row drives. Structural, so a test needs no mount. */
export interface RightsRowRuntime {
  rights(context?: { delivery?: { format?: string; canCarryCredential?: boolean } }): RightsEvaluationV1;
  setRightsDecision(decision: RightsDecisionV1): void;
  readonly lastReceipt: AttributionReceiptV1 | null;
  onEmojiChange(fn: () => void): () => void;
}

export interface RightsRowMount {
  /** The export panel, holding the card from {@link rightsRowHtml}. */
  root: ParentNode;
  runtime: RightsRowRuntime;
  /** The delivery as the panel currently has it set. */
  delivery(): { format: string; canCarryCredential: boolean };
  announce(message: string): void;
  copy(text: string): void | Promise<void>;
  /** Run the export again after a credential failed to reach the file. */
  retry?: () => void;
  /** Put the artwork's own colours back. */
  keepOriginal?: () => void;
  /** Send the person to the control that picks another source set. */
  replaceWork?: () => void;
  /** Supplied by a test; the mount reads a real clock only for a decision's date. */
  now?: () => string;
}

export interface RightsRowHandle {
  refresh(): void;
  destroy(): void;
}

export function mountRightsRow(opts: RightsRowMount): RightsRowHandle {
  const { root, runtime } = opts;
  const caps: RightsRowCapabilities = {
    retry: Boolean(opts.retry),
    keepOriginal: Boolean(opts.keepOriginal),
    replaceWork: Boolean(opts.replaceWork),
  };
  const announced = new Set<string>();
  let painted: RightsRowCard[] = [];
  let evaluation: RightsEvaluationV1 | null = null;

  const refresh = (): void => {
    const delivery = opts.delivery();
    evaluation = runtime.rights({ delivery: { format: delivery.format, canCarryCredential: delivery.canCarryCredential } });
    const view = rightsView(evaluation, runtime.lastReceipt, caps);
    painted = paintRightsRow(root, view);
    // One line per NEW issue. A repaint on every keystroke must not become a
    // stream of interruptions, so a key that has already been spoken is silent
    // until it goes away and comes back.
    const live = new Set(view.announce.map((a) => a.key));
    for (const key of [...announced]) if (!live.has(key)) announced.delete(key);
    for (const item of view.announce) {
      if (announced.has(item.key)) continue;
      announced.add(item.key);
      opts.announce(item.text);
      // The row sits inside the collapsed Content protection group, so a new
      // decision would otherwise be announced about a card nobody can see.
      const toggle = root.querySelector<HTMLElement>('[data-action="protection-toggle"]');
      if (view.tone === 'action' && toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
    }
  };

  const status = (message: string): void => {
    const line = root.querySelector<HTMLElement>('[data-rights-status]');
    if (!line) return;
    line.textContent = message;
    line.hidden = false;
  };

  const copyCredits = (): void => {
    const text = evaluation ? attributionCredits(evaluation.plan) : '';
    if (!text) return;
    void Promise.resolve(opts.copy(text)).then(
      () => status(t('Credit copied.')),
      () => status(t('The credit could not be copied. Select it in Details and copy it by hand.')),
    );
  };

  const record = (work: string | null, decision: Omit<RightsDecisionV1, 'work'>): void => {
    if (!work || !evaluation) return;
    // Stamped with the SITUATION, the hash of the facts in front of the person,
    // not the whole evaluation's. The whole evaluation's includes the decisions,
    // so a decision could never carry a hash equal to the one the evaluator
    // checks it against, and every stored choice would be retired the moment it
    // was made. This one survives a reload and retires when a set, treatment,
    // format or audience changes, which is what the plan asks for.
    runtime.setRightsDecision({ ...decision, work, fingerprint: evaluation.situation, recordedAt: opts.now?.() ?? new Date().toISOString() });
    refresh();
  };

  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-action="rights-copy"]')) {
      copyCredits();
      return;
    }
    if (target.closest('[data-rights-note-save]')) {
      const box = target.closest<HTMLElement>('[data-rights-card]');
      const note = box?.querySelector<HTMLInputElement>('[data-rights-note]')?.value.trim() ?? '';
      const card = painted.find((c) => c.key === box?.dataset.rightsCard);
      if (!note || !card) return;
      record(card.work, { kind: 'separate-permission', note });
      return;
    }
    const button = target.closest<HTMLElement>('[data-rights-action]');
    if (!button) return;
    const box = button.closest<HTMLElement>('[data-rights-card]');
    const card = painted.find((c) => c.key === box?.dataset.rightsCard);
    const action = card?.actions[Number(button.dataset.rightsAction)];
    if (!card || !action) return;
    switch (action.kind) {
      case 'output-licence':
        record(card.work, { kind: 'output-licence', ...(action.licence ? { licence: action.licence } : {}) });
        break;
      case 'keep-original':
        opts.keepOriginal?.();
        refresh();
        break;
      case 'replace-work':
        opts.replaceWork?.();
        break;
      case 'separate-permission': {
        const field = box?.querySelector<HTMLElement>('[data-rights-permission]');
        if (field) field.hidden = false;
        box?.querySelector<HTMLInputElement>('[data-rights-note]')?.focus();
        break;
      }
      case 'copy-credit':
        copyCredits();
        break;
      case 'retry':
        opts.retry?.();
        break;
      default:
        break;
    }
  };

  const section = root.querySelector<HTMLElement>('[data-rights-section]');
  section?.addEventListener('click', onClick);
  // The census changes when a set or a treatment does, which is exactly when the
  // recorded sources and their conditions change.
  const offEmoji = runtime.onEmojiChange(refresh);
  refresh();

  return {
    refresh,
    destroy() {
      section?.removeEventListener('click', onClick);
      offEmoji();
    },
  };
}

// ─── The panel's namespace ───────────────────────────────────────────────────

/**
 * The delivery the panel has set right now, in the shape the runtime's export
 * path uses, so the fingerprint the row evaluates matches the one the export
 * freezes and the receipt can be recognised as being about this file.
 *
 * `canCarryCredential` is read the way the download handler computes `opts.c2pa`,
 * which is the C2PA box AND a format that can carry one: a ticked box under a
 * format nothing stamps is not a credential, and promising one would put the row
 * a step ahead of the bytes. The stampable list is the one the panel already
 * built for its own card (`ta.c2paFormats`), so the two answers cannot drift.
 *
 * No package route is declared here, and that is deliberate. A package route
 * would make the row read `Credits and credentials are in the download package.`,
 * and nothing writes a credits companion into a zip yet. The row can render that
 * state (the plan's channel decides it), so it will light up the day the
 * companion is actually written, and until then the honest channel is the Details
 * fold beside the button.
 */
export function panelDelivery(ta: ActionsCtx): { format: string; canCarryCredential: boolean } {
  const format = ta.formatEl?.value || ta.initialFmt || '';
  const c2paEl = ta.el?.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]');
  const on = c2paEl ? c2paEl.checked : ta.c2paInitOn;
  return { format, canCarryCredential: Boolean(on) && (ta.c2paFormats ?? []).includes(format) };
}

export function wireRights(ta: ActionsCtx): void {
  if (!ta.el || typeof ta.runtime.rights !== 'function') return;
  ta.rightsRow = mountRightsRow({
    root: ta.el,
    runtime: ta.runtime,
    delivery: () => panelDelivery(ta),
    announce: (message) => announce(message),
    copy: (text) => navigator.clipboard.writeText(text),
    retry: () => ta.el?.querySelector<HTMLElement>('[data-action="download"]')?.click(),
    // The recoloured artwork is the emoji treatment, and the document's emoji
    // style is the one place both the sidebar section and the design dock edit.
    keepOriginal: () => {
      const style = ta.runtime.emoji?.style;
      if (style) setEmojiDocumentStyle({ ...style, treatment: { mode: 'original', strengthBps: 0 } });
    },
    replaceWork: () => {
      const section = document.querySelector<HTMLDetailsElement>('#emoji-section');
      if (!section) return;
      section.open = true;
      section.querySelector<HTMLElement>('summary')?.focus();
    },
  });
}

export function refreshRights(ta: ActionsCtx): void {
  ta.rightsRow?.refresh();
}

export function rightsOps(ta: ActionsCtx) {
  return {
    /** The card's markup, for the panel's card stack. Context free, like the preflight row. */
    rowHtml: (): string => rightsRowHtml(),
    wireRights: bindOp(ta, wireRights),
    refreshRights: bindOp(ta, refreshRights),
  };
}
