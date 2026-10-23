// SPDX-License-Identifier: MPL-2.0
/**
 * The Settings Design system tab, set out as a read of the active design
 * system. A cover painted in the system's own look opens it: the logo, the
 * name in the display face, the note its author wrote and a contents line of
 * counts that jump to the pages. Then one page for each part the system has:
 * Colour, Type, Logos, Colourways, Tokens and the Print & CMYK reference.
 *
 * Nothing here is an illustration. Every block shows the system's own material
 * (its colours as fills, its faces as type, its logo files on the grounds they
 * were made for), so the page reads at a glance and words are kept to labels.
 * The tab only reads; editing happens at #/start.
 *
 * lib/design-system/issue-model.ts reads the model and this module renders the
 * model as markup.
 * The panel is wired once: a delegated click listener (copy a value, follow a
 * contents link), the logo files filled in after first paint into slots of a
 * fixed size, and an in-place refresh when the active design system changes,
 * so a switch made from the account menu never leaves the previous system on
 * screen. A refresh started before a newer one is dropped, and so is one that
 * finishes after the view was torn down.
 *
 * Above the issue sits the design systems strip (lib/design-system/ds-strip.ts),
 * one small cover per system in this browser, which switches in place. The
 * active system's cover there is drawn from the model this tab already read,
 * and the same refresh redraws the strip, so a switch costs one read.
 */
import '../../styles/parts/design-issue.css';
import { createTokenSet, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { escape as escapeText } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { livePalette } from '../../lib/live-palette.ts';
import { swatch, isLockedInk, isTransparent, rolePathName } from '../../lib/swatches.ts';
import type { PaletteEntry } from '../../palette.ts';
import { brandRadiusValue, tokenValueToHex } from '../../brand-vars.ts';
import { listStudioTokens, formatStudioValue, gradientCss } from '../../lib/token-studio.ts';
import type { StudioToken } from '../../lib/token-studio.ts';
import { activeDesignSystemRecord, type ActiveRecord } from '../../lib/design-system/active.ts';
import { readIssue, type IssueModel, type LookSlot } from '../../lib/design-system/issue-model.ts';
import { coverVars, safeLogoSrc, type CoverPreview } from '../../lib/design-system/cover.ts';
import { docPalette, logoUrlsFor, modeIdOf, monogramOf, type DesignSystemPreview } from '../../lib/design-system/preview.ts';
import { mountDsStrip, type StripHost } from '../../lib/design-system/ds-strip.ts';
import type { LeadColours } from '../../lib/design-system/leads.ts';
import { sourceLine } from '../../lib/design-system/source-line.ts';
import type { DesignSystemRecord } from '../../lib/design-system/registry.ts';
import { DESIGN_SYSTEM_CHANGED_EVENT, DESIGN_SYSTEMS_LISTED_EVENT } from '../../lib/design-system/switch.ts';
import { DASH_SECTIONS, dashFlag, dashHref } from '../../lib/dashboard-registry.ts';

/** Everything the tab renders, read in one go so first paint needs no second read. */
export interface BrandPanelInput {
  model: IssueModel;
  /** The active head document, or null when none can be read. */
  doc: unknown;
  activeRecord: ActiveRecord | null;
  /** The corner radius as a safe CSS length (brand-vars.ts brandRadiusValue), or null. */
  radius: string | null;
  /** The design systems in this browser, in registry order, for the strip. Empty without a registry. */
  systems: DesignSystemRecord[];
}

interface TokensRead {
  raw?(): Promise<unknown>;
  isLocked?(): Promise<boolean>;
  resolve?(ref: string): Promise<unknown>;
}
interface MetaRead {
  _findMetaByType?(type: string): Promise<{ id: string; name?: string; meta?: Record<string, unknown> } | null>;
}

/**
 * The host as this tab reads it: HostV1 plus what the web shell's host carries
 * beyond it, the design system registry and two asset index reads. Each is
 * optional, because a partial host (an older shell, a test) may lack it, so
 * every read of one is guarded.
 */
export type BrandHost = HostV1 & {
  designSystems?: StripHost['designSystems'];
  assets: HostV1['assets'] & MetaRead & Partial<Pick<StripHost['assets'], '_getBlob'>>;
};

/** The strip reads covers and switches through the registry, so it mounts only on a host that has both. */
const isStripHost = (host: BrandHost): host is BrandHost & StripHost =>
  !!host.designSystems && typeof host.assets._getBlob === 'function';

const tokensOf = (host: HostV1): TokensRead | undefined => host.tokens as TokensRead | undefined;

/** Settle a read that may be absent or may throw: the answer, else `fallback`. */
async function settle<T>(read: () => Promise<T> | undefined, fallback: T): Promise<T> {
  try { return (await read()) ?? fallback; } catch { return fallback; }
}

/** The head document's colours, as the strip and the Preferences rows read them, or null when it has none to give. */
function headPalette(doc: unknown): PaletteEntry[] | null {
  try { return doc ? docPalette(doc) : null; } catch { return null; }
}

/**
 * Read the active design system for the tab. The palette, the head document,
 * the lock, the record, the asset name, the radius and the list of design
 * systems are read together, so the tab waits for the slowest of them and no longer.
 *
 * The colours come from the head document, the one the cover, the type and the
 * logos are read from, so the tab counts a system as its strip item and its
 * Preferences row do (preview.ts colourCountOf). The live palette stands in
 * only when there is no head to read.
 */
export async function readBrandPanelInput(host: BrandHost): Promise<BrandPanelInput> {
  const tokens = tokensOf(host);
  const [live, doc, locked, record, meta, radius, systems] = await Promise.all([
    livePalette(host),
    settle<unknown>(() => tokens?.raw?.(), null),
    settle(() => tokens?.isLocked?.(), false),
    activeDesignSystemRecord(host),
    settle(() => host.assets._findMetaByType?.('tokens'), null),
    settle(async () => brandRadiusValue(await tokens?.resolve?.('{shape.radius}')), null),
    settle<DesignSystemRecord[]>(() => host.designSystems?.visible?.(), []),
  ]);
  // A record's label is the one the person set. Without a registry the asset's
  // own name stands in, its "... tokens" suffix trimmed ("SUSE Brand Design Tokens" reads "SUSE").
  const metaName = typeof meta?.meta?.name === 'string' && meta.meta.name ? meta.meta.name : meta?.name ?? '';
  const label = record?.label || metaName.replace(/\s+(brand\s+)?(design\s+)?tokens$/i, '').trim() || tRaw('Design system');
  const source = record ? sourceLine(record as DesignSystemRecord) : '';
  const palette = headPalette(doc) ?? live;
  const model = readIssue({ doc, palette, label, source, locked: Boolean(locked) });
  return { model, doc, activeRecord: record, radius, systems };
}

// ── Small pieces ─────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
/** A colour that may go into a style attribute: plain hex only, anything else is dropped. */
const safeHex = (value: unknown): string | null => typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : null;

const colourCount = (n: number): string => n === 1 ? tRaw('{n} colour', { n }) : tRaw('{n} colours', { n });
const typefaceCount = (n: number): string => n === 1 ? tRaw('{n} typeface', { n }) : tRaw('{n} typefaces', { n });
const logoCount = (n: number): string => n === 1 ? tRaw('{n} logo', { n }) : tRaw('{n} logos', { n });
const colourwayCount = (n: number): string => n === 1 ? tRaw('{n} colourway', { n }) : tRaw('{n} colourways', { n });

/** A copy button showing a value in the mono face. Its name says what is copied. */
function hexButton(hex: string, name: string, cls = 'ds-hex'): string {
  return `<button type="button" class="${cls}" data-copy="${escapeText(hex)}" aria-label="${escapeText(tRaw('Copy {value}', { value: name ? `${name} ${hex}` : hex }))}">${escapeText(hex)}</button>`;
}

/** A page's heading row: the title and, beside it on a wide page, its facts. */
function pageHead(headingId: string, title: string, facts = ''): string {
  return `<header class="ds-issue-head"><h2 class="ds-issue-title" id="${headingId}" tabindex="-1">${escapeText(title)}</h2>${facts ? `<p class="ds-issue-facts-line">${facts}</p>` : ''}</header>`;
}

const sectionById = (id: string) => DASH_SECTIONS.find(s => s.id === id);
const jumpHref = (id: string): string => { const s = sectionById(id); return s ? dashHref(s) : `#/settings?${encodeURIComponent(id)}`; };

/** The first sentence of the standfirst, for the Text and Emphasis specimens. */
function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/u)[0]?.trim() ?? '';
}

/** A specimen line that needs no words: the letters and figures of a face. */
const ALPHABET = 'Aa Bb Cc Dd Ee Ff Gg 0123456789';

// ── 1. The cover ─────────────────────────────────────────────────────────────

/** The pages the cover's contents line links to, each named by its count. */
function contentsOf(m: IssueModel, has: { logos: boolean; colourways: boolean; tokens: boolean }): Array<{ id: string; label: string }> {
  return [
    { id: 'dash-palette', label: colourCount(m.facts.colours) },
    { id: 'dash-typedemo', label: typefaceCount(m.facts.typefaces) },
    ...(has.logos ? [{ id: 'dash-logos', label: logoCount(m.facts.logos) }] : []),
    ...(has.colourways ? [{ id: 'dash-colourways', label: colourwayCount(m.facts.colourways) }] : []),
    ...(has.tokens ? [{ id: 'dash-tokens', label: tRaw('Tokens') }] : []),
    { id: 'dash-print', label: tRaw('Print & CMYK') },
  ];
}

/** A fold's summary: the chevron that turns when it opens, then the label. */
const foldChevron = (): string => icon('chevronRight', { className: 'ds-issue-chev' });

function coverHtml(m: IssueModel, contents: Array<{ id: string; label: string }>): string {
  // Each fact keeps its words together, so a narrow cover breaks the line at a dot.
  const eyebrow = [tRaw('Design system'), m.source, m.facts.modes.length > 1 ? tRaw('Light and dark') : ''].filter(Boolean);
  // The band at the foot: the primary and secondary of the look in force, then
  // a few more of the system's own colours that the cover does not already paint.
  const painted = [m.looks.light, m.looks.dark].flatMap(l => l ? [l.surface, l.primary, l.secondary] : []);
  const more = [...new Set(m.colours.core.map(c => safeHex(c.hex)).filter((h): h is string => !!h && !painted.includes(h)))].slice(0, 6);
  const lock = m.locked
    ? `<p class="ds-issue-lock">${icon('lock', { size: 16 })}<span>${tRaw('Supplied by this build and read-only here. Make an editable copy in {link}.', { link: `<a href="#/settings?focus=design-systems-section">${t('Preferences')}</a>` })}</span></p>`
    : '';
  return `
    <section class="ds-issue-cover ds-look" id="dash-brand" data-flag="${escapeText(dashFlag('dash-brand'))}" aria-labelledby="dash-brand-h" style="${escapeText(coverVars(m.looks))}">
      <div class="ds-issue-cover-body">
        <div class="ds-issue-cover-head">
          <span class="ds-issue-nameplate" data-issue-nameplate${m.logos.length ? ' data-reserve' : ''}></span>
          <p class="ds-issue-eyebrow">${eyebrow.map(part => `<span>${escapeText(part)}</span>`).join('')}</p>
        </div>
        <h2 class="ds-issue-name" id="dash-brand-h" tabindex="-1">${escapeText(m.name)}</h2>
        ${lock}
        ${m.standfirst.lead ? `<p class="ds-issue-standfirst">${escapeText(m.standfirst.lead)}</p>` : ''}
        ${m.standfirst.rest ? `<details class="ds-issue-more"><summary>${foldChevron()}<span>${t('Read the full note')}</span></summary><p>${escapeText(m.standfirst.rest)}</p></details>` : ''}
        <nav class="ds-issue-contents" aria-label="${escapeText(tRaw('In this design system'))}">
          <ul>${contents.map(c => `<li><a href="${escapeText(jumpHref(c.id))}" data-issue-jump="${escapeText(c.id)}">${escapeText(c.label)}</a></li>`).join('')}</ul>
        </nav>
        ${m.locked ? '' : `<a class="ds-issue-edit" href="#/start">${t('Edit in Start')}</a>`}
      </div>
      <div class="ds-issue-band" aria-hidden="true"><i></i><i></i>${more.map(h => `<i style="background:${h}"></i>`).join('')}</div>
    </section>`;
}

// ── 2. Colour ────────────────────────────────────────────────────────────────

function leadSlotHtml(slot: LookSlot): string {
  const role = { surface: t('Surface'), text: t('Text'), primary: t('Primary'), secondary: t('Secondary') }[slot.role];
  const hex = safeHex(slot.hex);
  return `
    <li class="ds-lead">
      <span class="ds-lead-fill"${hex ? ` style="background:${hex}"` : ''} aria-hidden="true"></span>
      <span class="ds-lead-role">${role}</span>
      ${slot.name ? `<span class="ds-lead-name">${escapeText(slot.name)}</span>` : ''}
      ${hex ? hexButton(hex, slot.name) : ''}
    </li>`;
}

/** One band of equal stripes, each a copy button, with the step names underneath. */
function bandHtml(title: string, cols: readonly PaletteEntry[], family = ''): string {
  const steps = cols.filter(c => safeHex(c.hex));
  if (!steps.length) return '';
  const prefix = family ? new RegExp(`^${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i') : null;
  return `
    <div class="ds-band-block">
      <h3 class="ds-issue-sub">${escapeText(title)} <span class="ds-issue-count">${steps.length}</span></h3>
      <ol class="ds-band">${steps.map(c => `<li><button type="button" class="ds-band-step" style="background:${safeHex(c.hex)}" data-copy="${escapeText(c.hex)}" aria-label="${escapeText(tRaw('Copy {value}', { value: `${c.label} ${c.hex}` }))}"></button></li>`).join('')}</ol>
      <ol class="ds-band-labels" aria-hidden="true">${steps.map(c => `<li>${escapeText((prefix ? c.label.replace(prefix, '') : c.label) || c.label)}</li>`).join('')}</ol>
    </div>`;
}

/**
 * A named colour as a chip: the fill, its name and a hex that copies itself.
 * The print data (inks, spot names, CMYK) stays in the Print & CMYK fold, so
 * the Colour page reads as colour first.
 */
function chipHtml(c: PaletteEntry): string {
  const hex = safeHex(c.hex);
  if (!hex) return '';
  return `
    <li class="ds-chip">
      <span class="ds-chip-fill" style="background:${hex}" aria-hidden="true"></span>
      <span class="ds-chip-name">${escapeText(c.label)}</span>
      ${hexButton(hex, c.label)}
    </li>`;
}

function roleRowHtml(c: PaletteEntry): string {
  const hex = safeHex(c.hex);
  const path = c.token?.path ?? '';
  const note = c.token?.description ?? '';
  return `
    <li class="ds-role">
      <span class="ds-role-chip"${hex ? ` style="background:${hex}"` : ''} aria-hidden="true"></span>
      <span class="ds-role-name">${escapeText(path ? rolePathName(path) : c.label)}</span>
      ${hex ? hexButton(hex, path ? rolePathName(path) : c.label) : ''}
      ${path ? `<code class="ds-role-path">${escapeText(path)}</code>` : ''}
      ${note ? `<span class="ds-role-note">${escapeText(note)}</span>` : ''}
    </li>`;
}

function colourPage(m: IssueModel): string {
  const { named, ramps, spectrum, roles, lockedInks } = m.colours;
  const facts = [colourCount(m.facts.colours), lockedInks > 0 ? tRaw('{n} with an exact print ink', { n: lockedInks }) : ''].filter(Boolean).map(escapeText).join(' · ');
  const leads = m.leads.map(l => `
    <div class="ds-leads-mode">
      <h4 class="ds-leads-label">${l.mode === 'light' ? t('Light') : t('Dark')}</h4>
      <ul class="ds-lead-grid">${l.slots.map(leadSlotHtml).join('')}</ul>
    </div>`).join('');
  return `
    <section class="ds-issue-page" id="dash-palette" data-flag="${escapeText(dashFlag('dash-palette'))}" aria-labelledby="dash-palette-h">
      ${pageHead('dash-palette-h', tRaw('Colour'), facts)}
      <div class="ds-issue-part">
        <h3 class="ds-issue-sub">${t('Ink and paper')}</h3>
        <div class="ds-leads">${leads}</div>
      </div>
      ${named.length ? `
      <div class="ds-issue-part">
        <h3 class="ds-issue-sub">${t('Named colours')} <span class="ds-issue-count">${named.length}</span></h3>
        <ul class="ds-chip-grid">${named.map(chipHtml).join('')}</ul>
      </div>` : ''}
      ${ramps.map(([family, cols]) => bandHtml(family, cols, family)).join('')}
      ${spectrum.length ? bandHtml(tRaw('Spectrum'), spectrum) : ''}
      ${roles.length ? `
      <details class="ds-issue-fold">
        <summary>${foldChevron()}<span>${t('Colour roles')}</span> <span class="ds-issue-count">${roles.length}</span></summary>
        <ul class="ds-role-list">${roles.map(roleRowHtml).join('')}</ul>
      </details>` : ''}
    </section>`;
}

// ── 3. Type ──────────────────────────────────────────────────────────────────

function typePage(m: IssueModel): string {
  const sentence = firstSentence(m.standfirst.lead) || ALPHABET;
  const label = { display: t('Headings'), brand: t('Text'), italic: t('Emphasis'), mono: t('Code') };
  const specimen = {
    display: `<p class="ds-type-display">${escapeText(m.name)}</p><p class="ds-type-line">${ALPHABET}</p>`,
    brand: `<p class="ds-type-text">${escapeText(sentence)}</p>`,
    italic: `<p class="ds-type-text ds-type-text--italic">${escapeText(sentence)}</p>`,
    mono: `<p class="ds-type-code"><span>color.semantic.primary</span> <span>${escapeText(m.primaryHex)}</span></p>`,
  };
  const manage = m.locked ? '' : ` · <a href="#/start?tab=type">${t('Manage fonts')}</a>`;
  return `
    <section class="ds-issue-page" id="dash-typedemo" data-flag="${escapeText(dashFlag('dash-typedemo'))}" aria-labelledby="dash-typedemo-h">
      ${pageHead('dash-typedemo-h', tRaw('Type'), `${escapeText(typefaceCount(m.facts.typefaces))}${manage}`)}
      <ol class="ds-type-rows">
        ${m.fonts.map(f => `
        <li class="ds-type-row ds-type-row--${f.role}">
          <div class="ds-type-meta">
            <span class="ds-type-role">${label[f.role]}</span>
            <span class="ds-type-family">${escapeText(f.family)}</span>
            ${f.follows ? `<span class="ds-type-follows">${t('Same face as Text')}</span>` : ''}
          </div>
          <div class="ds-type-specimen">${specimen[f.role]}</div>
        </li>`).join('')}
      </ol>
    </section>`;
}

// ── 4. Logos ─────────────────────────────────────────────────────────────────

/** The ground a logo is drawn on: the light surface, the dark one or the primary. */
function groundHex(m: IssueModel, ground: IssueModel['logos'][number]['ground']): string {
  if (ground === 'primary') return m.looks.light.primary;
  if (ground === 'surface-dark') return m.looks.dark?.surface ?? m.looks.light.ink;
  return m.looks.light.surface;
}

function logosPage(m: IssueModel): string {
  if (!m.logos.length) return '';
  return `
    <section class="ds-issue-page" id="dash-logos" data-flag="${escapeText(dashFlag('dash-logos'))}" aria-labelledby="dash-logos-h">
      ${pageHead('dash-logos-h', tRaw('Logos'), escapeText(logoCount(m.facts.logos)))}
      <ul class="ds-logo-grid">
        ${m.logos.map(l => {
          const variant = l.variants.join(', ');
          const hex = safeHex(groundHex(m, l.ground));
          return `
        <li class="ds-logo-item" data-logo-id="${escapeText(l.id)}">
          <figure class="ds-logo">
            <span class="ds-logo-plate"${hex ? ` style="background:${hex}"` : ''}><img class="ds-logo-img" alt="${escapeText(tRaw('{name} logo, {variant}', { name: m.name, variant }))}" decoding="async" hidden></span>
            <figcaption class="ds-logo-caption">${escapeText(variant)}</figcaption>
          </figure>
        </li>`;
        }).join('')}
      </ul>
    </section>`;
}

// ── 5. Colourways ────────────────────────────────────────────────────────────

/** A colourway's colours for one look, found by the look's mode id in any case. */
function waysFor(colours: Record<string, LeadColours>, mode: 'light' | 'dark'): LeadColours | undefined {
  const key = Object.keys(colours).find(k => k.toLowerCase() === mode);
  return key ? colours[key] : undefined;
}

function wayHalf(c: LeadColours | undefined): string {
  const bg = safeHex(c?.primary);
  if (!bg) return '';
  const fg = safeHex(c?.['on-primary']);
  const stripe = safeHex(c?.secondary);
  return `<span class="ds-colourway-half" style="background:${bg}${fg ? `;color:${fg}` : ''}"><span class="ds-colourway-aa">Aa</span>${stripe ? `<i style="background:${stripe}"></i>` : '<i></i>'}</span>`;
}

function colourwaysPage(m: IssueModel): string {
  if (m.colourways.length < 2) return '';
  return `
    <section class="ds-issue-page" id="dash-colourways" data-flag="${escapeText(dashFlag('dash-colourways'))}" aria-labelledby="dash-colourways-h">
      ${pageHead('dash-colourways-h', tRaw('Colourways'), escapeText(colourwayCount(m.colourways.length)))}
      <ul class="ds-colourways">
        ${m.colourways.map(way => {
          const keys = Object.keys(way.colours);
          const light = waysFor(way.colours, 'light') ?? way.colours[keys[0] ?? ''];
          const dark = waysFor(way.colours, 'dark') ?? (keys[1] ? way.colours[keys[1]] : undefined);
          const hexes = [safeHex(light?.primary), safeHex(dark?.primary)].filter(Boolean).join(' · ');
          return `
        <li>
          <figure class="ds-colourway">
            <span class="ds-colourway-halves" aria-hidden="true">${wayHalf(light)}${wayHalf(dark)}</span>
            <figcaption>
              <span class="ds-colourway-name">${escapeText(way.name)}</span>
              ${way.canonical ? `<span class="ds-colourway-default">${t('Default')}</span>` : ''}
              ${hexes ? `<code class="ds-colourway-hex">${hexes}</code>` : ''}
            </figcaption>
          </figure>
        </li>`;
        }).join('')}
      </ul>
    </section>`;
}

// ── 6. Tokens ────────────────────────────────────────────────────────────────
// Read-only chips for the system's non-colour primitives: the corner radius
// plus anything lib/token-studio.ts manages (spacing, sizing, stroke, opacity,
// rotation, numbers, shadows, gradients). A doc carrying none of these keeps
// the whole page off the tab.

// A CSS length as this page will render into a style attribute - same
// defence-in-depth stance as brand-vars.ts's RADIUS_RE, widened to allow the
// negative offsets a shadow may carry. Anything else simply drops its preview.
const TOKEN_LEN_RE = /^-?\d+(\.\d+)?(px|rem|em)$/;

/** One read-only token chip: kind-specific preview · name over kind · value. */
function tokenChip(o: { name: string; kind: string; value: string; preview: string }): string {
  return `
    <li class="dash-token">
      <span class="dash-token-preview" aria-hidden="true">${o.preview}</span>
      <span class="dash-token-text">
        <span class="dash-token-name">${escapeText(o.name)}</span>
        <span class="dash-token-kind">${escapeText(t(o.kind))}</span>
      </span>
      ${o.value ? `<code class="dash-token-value">${escapeText(o.value)}</code>` : ''}
    </li>`;
}

/** Resolvers for each look, so a gradient whose stops alias the palette shows both looks. */
interface LookResolvers { light?: (ref: string) => unknown; dark?: (ref: string) => unknown }

/** A studio token's tiny visual: bar / rule / translucency / needle / shadow /
 *  gradient. Values come from an untrusted imported doc and land in a style
 *  attribute, so every branch validates before it renders. A chip whose value
 *  can't be shown safely just shows none. A gradient whose stops resolve
 *  differently in the dark look draws one preview per look; the app theme picks
 *  which one shows (design-system-specimen.css, the `[data-looks]` rules). */
function studioPreview(tok: StudioToken, looks: LookResolvers = {}): string {
  const raw = tok.raw;
  const len = typeof raw === 'string' && TOKEN_LEN_RE.test(raw.trim()) ? raw.trim() : null;
  switch (tok.kind) {
    case 'spacing':
    case 'sizing':
      return len ? `<span class="dash-token-bar"><i style="width:${escapeText(len)}"></i></span>` : '';
    case 'stroke':
      return len ? `<span class="dash-token-rule"><i style="height:${escapeText(len)}"></i></span>` : '';
    case 'opacity': {
      const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : null;
      return n == null ? '' : `<span class="dash-token-alpha"><i style="opacity:${n}"></i></span>`;
    }
    case 'rotation': {
      const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw * 100) / 100 : null;
      return n == null ? '' : `<span class="dash-token-rot"><i style="transform:rotate(${n}deg)"></i></span>`;
    }
    case 'shadow': {
      const css = shadowCss(raw);
      return css ? `<span class="dash-token-shadow" style="box-shadow:${escapeText(css)}"></span>` : '';
    }
    case 'gradient': {
      const light = gradientCss(raw, tok.angle, { resolve: looks.light, space: 'oklch' });
      const dark = looks.dark ? gradientCss(raw, tok.angle, { resolve: looks.dark, space: 'oklch' }) : light;
      if (!light || !dark || light === dark) {
        const css = light || dark;
        return css ? `<span class="dash-token-grad" style="background:${escapeText(css)}"></span>` : '';
      }
      return `<span class="dash-token-grad" data-looks="light brand" style="background:${escapeText(light)}"></span><span class="dash-token-grad" data-looks="dark" style="background:${escapeText(dark)}"></span>`;
    }
    default:
      return ''; // number - the value line carries it
  }
}

/** A DTCG shadow $value ({ color, offsetX, offsetY, blur, spread } strings) as
 *  a safe CSS box-shadow, or null when its colour or any offset is unusable. */
function shadowCss(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const dim = (v: unknown): string | null =>
    typeof v === 'string' && TOKEN_LEN_RE.test(v.trim()) ? v.trim() : null;
  const color = tokenValueToHex(r.color);
  if (!color) return null;
  return `${dim(r.offsetX) ?? '0px'} ${dim(r.offsetY) ?? '0px'} ${dim(r.blur) ?? '0px'} ${dim(r.spread) ?? '0px'} ${color}`;
}

/** A studio token's display value - the contract's formatter first, else the
 *  raw string/number itself (shadows/gradients read from their preview). */
function studioValue(tok: StudioToken): string {
  const formatted = formatStudioValue(tok);
  if (formatted) return formatted;
  return typeof tok.raw === 'string' ? tok.raw : typeof tok.raw === 'number' ? String(tok.raw) : '';
}

/** The chips for the Tokens page: the radius, then every studio-managed primitive. */
function tokenChips(input: Pick<BrandPanelInput, 'doc' | 'radius'>): string[] {
  let studio: StudioToken[] = [];
  const looks: LookResolvers = {};
  try {
    if (input.doc) {
      studio = listStudioTokens(input.doc);
      // The doc's own mode ids, matched without regard to case ("Light", "dark").
      const lightId = modeIdOf(input.doc, 'light');
      const darkId = modeIdOf(input.doc, 'dark');
      const light = createTokenSet(input.doc, lightId ? { theme: lightId } : {});
      looks.light = (ref: string) => light.resolve(ref);
      if (darkId) {
        const dark = createTokenSet(input.doc, { theme: darkId });
        looks.dark = (ref: string) => dark.resolve(ref);
      }
    }
  } catch { studio = []; }
  return [
    ...(input.radius ? [tokenChip({
      name: t('Corner radius'), kind: 'shape', value: input.radius,
      preview: `<span class="dash-token-shape" style="border-radius:${escapeText(input.radius)}"></span>`,
    })] : []),
    ...studio.map(tok => tokenChip({ name: tok.name, kind: tok.kind, value: studioValue(tok), preview: studioPreview(tok, looks) })),
  ];
}

function tokensPage(chips: readonly string[]): string {
  if (!chips.length) return '';
  return `
    <section class="ds-issue-page" id="dash-tokens" data-flag="${escapeText(dashFlag('dash-tokens'))}" aria-labelledby="dash-tokens-h">
      ${pageHead('dash-tokens-h', tRaw('Tokens'))}
      <ul class="dash-token-grid ds-look">${chips.join('')}</ul>
    </section>`;
}

// ── 7. Print & CMYK ──────────────────────────────────────────────────────────

// The shared swatch() tile, with the ink flag, the spot name and the CMYK line.
// The print data lives here; the Colour page shows the same colours as chips.
function printBody(core: readonly PaletteEntry[]): string {
  const locked = core.filter((c) => isLockedInk(c) && !isTransparent(c.hex));
  return `
    <p class="plat-section-desc">${t('Brand colours locked to an exact ink value (CMYK or spot) - substituted directly into CMYK PDF exports instead of a generic sRGB→CMYK conversion.')}</p>
    <div class="plat-legend">
      <span class="plat-legend-item"><span class="plat-chip-flag is-static">CMYK</span> ${t('exact ink substitution')}</span>
      <span class="plat-legend-item"><span class="plat-chip-flag is-static">SPOT</span> ${t('named spot colour, its CMYK equivalent substituted at export')}</span>
      <span class="plat-legend-item"><span class="plat-swatch-cmyk is-generic">${t('RGB→CMYK (generic)')}</span> ${t('generic conversion at export')}</span>
    </div>
    ${locked.length
      ? `<div class="plat-swatch-grid">${locked.map(c => swatch(c)).join('')}</div>`
      : `<p class="cat-empty">${tRaw("No colours are locked to an exact ink yet. Lock one from a colour's print setting in {start}.", { start: `<a href="#/start?tab=colours">${t('Start')}</a>` })}</p>`}
    <p class="plat-section-desc">${t('Press conditions a CMYK PDF can declare in its <code>OutputIntent</code>. Selected per-export via the <code>colorProfile</code> option; raster &amp; on-screen output stays sRGB.')}</p>
    <div class="ds-issue-table"><table class="plat-table">
      <thead><tr><th>${t('Profile key')}</th><th>${t('Identifier')}</th><th>${t('Condition')}</th></tr></thead>
      <tbody>
        ${Object.entries(CMYK_CONDITIONS).map(([key, c]) => `
          <tr${key === DEFAULT_CMYK_CONDITION ? ' class="is-default"' : ''}>
            <td><code>${escapeText(key)}</code>${key === DEFAULT_CMYK_CONDITION ? `<span class="plat-pill">${t('default')}</span>` : ''}</td>
            <td>${escapeText(c.identifier)}</td>
            <td>${escapeText(c.info)}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>`;
}

function printPage(m: IssueModel): string {
  return `
    <section class="ds-issue-page" aria-labelledby="dash-print-h">
      <details class="ds-issue-print" id="dash-print" data-flag="${escapeText(dashFlag('dash-print'))}">
        <summary>
          <h2 class="ds-issue-title" id="dash-print-h" tabindex="-1">${t('Print & CMYK')}</h2>
          ${icon('chevronRight', { className: 'plat-section-chev' })}
        </summary>
        <div class="ds-issue-print-body">${printBody(m.colours.core)}</div>
      </details>
    </section>`;
}

// ── The issue ────────────────────────────────────────────────────────────────

/** The issue: the cover, then each page the system has material for. */
export function issueHtml(input: BrandPanelInput): string {
  const m = input.model;
  const chips = tokenChips(input);
  const contents = contentsOf(m, { logos: m.logos.length > 0, colourways: m.colourways.length >= 2, tokens: chips.length > 0 });
  return [
    coverHtml(m, contents),
    colourPage(m),
    typePage(m),
    logosPage(m),
    colourwaysPage(m),
    tokensPage(chips),
    printPage(m),
  ].join('');
}

/**
 * The tab's markup: a slot for the design systems strip, the issue, the one
 * polite status line copies are announced on, and the colophon.
 */
export function brandPanelHtml(input: BrandPanelInput): string {
  return `
    <div class="ds-strip" data-ds-strip hidden></div>
    <div class="ds-issue" data-issue>${issueHtml(input)}</div>
    <p class="visually-hidden" role="status" data-issue-status></p>
    <p class="plat-note dash-foot" role="note">
      ${tRaw('This tab reads the active design system. Edit it in {start}, or change theme and sound in {profile}.', { start: `<a href="#/start">${t('Start')}</a>`, profile: `<a href="#/settings">${t('Preferences')}</a>` })}
      ${' '}${tRaw('Building the UI? Browse the shell’s primitives & views in the {link}.', { link: `<a href="#/components">${t('Component library')}</a>` })}
    </p>`;
}

// ── Wiring ───────────────────────────────────────────────────────────────────

/** The active system's display face, which the chrome already carries. */
const ACTIVE_DISPLAY = 'var(--font-display, var(--font-brand))';

/**
 * The strip's cover for the active system, drawn from the issue model, so the
 * strip reads nothing twice. Until the logo URLs are known, a system that has
 * logo files shows its ground and band with no letter, so no monogram flashes
 * before the logo arrives.
 */
export function stripCoverOf(m: IssueModel, logos?: DesignSystemPreview['logos']): CoverPreview {
  const colors = [...new Set(m.colours.core.map(c => safeHex(c.hex)).filter((h): h is string => !!h))];
  return {
    label: m.name,
    monogram: !logos && m.logos.length ? '' : monogramOf(m.name),
    looks: m.looks,
    logos: logos ?? {},
    display: ACTIVE_DISPLAY,
    colors: colors.slice(0, 6),
    colorCount: m.facts.colours,
    colourways: m.facts.colourways,
    families: [...new Set(m.fonts.map(f => f.family))],
  };
}

/** The look each logo URL serves, one entry per distinct file (as cover.ts groups them). */
function nameplateLogos(logos: DesignSystemPreview['logos'], hasDark: boolean): Array<[string, string[]]> {
  const perLook: Array<[string, string | undefined]> = [
    ['light', logos.light],
    // A system with no dark look is painted in its light one under the dark theme.
    ['dark', hasDark ? logos.dark : logos.light],
    ['brand', logos.brand],
  ];
  const byUrl = new Map<string, string[]>();
  for (const [look, url] of perLook) {
    const src = safeLogoSrc(url);
    if (src) byUrl.set(src, [...(byUrl.get(src) ?? []), look]);
  }
  return [...byUrl];
}

/** A registry section id (`dash-palette`), the only thing a contents link names. */
const SECTION_ID = /^dash-[a-z]+$/;

const isModifiedClick = (e: MouseEvent): boolean => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * Wire a rendered brand panel. `refresh()` re-reads the active design system
 * and repaints the issue in place; the window's design-system-changed event
 * calls it, so any switch (the account menu, Undo, a hosted update) reaches
 * the tab. `teardown()` removes every listener; chain it onto the view's cleanup.
 */
export function mountBrandPanel(panel: HTMLElement, host: BrandHost, input: BrandPanelInput): { refresh(): Promise<void>; teardown(): void } {
  let gen = 0;
  let live = true;
  let current = input;
  const isCurrent = (my: number): boolean => live && my === gen && panel.isConnected;

  const announce = (message: string): void => {
    const status = panel.querySelector<HTMLElement>('[data-issue-status]');
    if (status) status.textContent = message;
  };

  // The strip of design systems above the issue. Hidden with fewer than two,
  // and without a registry, where the list it would show is empty.
  const stripEl = panel.querySelector<HTMLElement>('[data-ds-strip]');
  const strip = stripEl && isStripHost(host) ? mountDsStrip(stripEl, host, {
    activeId: input.activeRecord?.id ?? '',
    activeCover: stripCoverOf(input.model),
    records: input.systems,
  }) : null;

  const hideEmptyLogos = (): void => {
    const page = panel.querySelector<HTMLElement>('#dash-logos');
    const items = [...panel.querySelectorAll<HTMLElement>('[data-logo-id]')];
    if (page && items.length && items.every(li => li.hidden)) page.hidden = true;
  };

  // After first paint: the cover's logo for each app theme (on the issue cover
  // and the strip's active item) and every file on the Logos page, into slots
  // whose size is already set. `data-issue-ready` marks the moment they have
  // all decoded and the strip has read its covers, which the docs captures wait for.
  const hydrate = async (my: number, stripDone: Promise<void> = strip?.settled() ?? Promise.resolve()): Promise<void> => {
    const { doc, model } = current;
    const items = [...panel.querySelectorAll<HTMLElement>('[data-logo-id]')];
    const [logos, files] = await Promise.all([
      model.logos.length && doc ? logoUrlsFor(host, doc).catch(() => ({})) : Promise.resolve({}),
      Promise.all(items.map(li => settle(async () => (await host.assets.get(li.dataset.logoId ?? '') as { url?: unknown } | null)?.url, undefined))),
    ]);
    if (!isCurrent(my)) return;
    const activeId = current.activeRecord?.id;
    if (strip && activeId) strip.setCover(activeId, stripCoverOf(model, logos as DesignSystemPreview['logos']));
    const plate = panel.querySelector<HTMLElement>('[data-issue-nameplate]');
    if (plate) {
      const imgs = nameplateLogos(logos as DesignSystemPreview['logos'], !!model.looks.dark).slice(0, 3).map(([src, looks]) => {
        const img = document.createElement('img');
        img.className = 'ds-issue-logo';
        img.alt = '';
        img.decoding = 'async';
        img.dataset.looks = looks.join(' ');
        img.src = src;
        return img;
      });
      plate.replaceChildren(...imgs);
      if (!imgs.length) plate.removeAttribute('data-reserve');
    }
    items.forEach((li, i) => {
      const src = safeLogoSrc(files[i]);
      const img = li.querySelector<HTMLImageElement>('img');
      if (src && img) { img.src = src; img.hidden = false; } else li.hidden = true;
    });
    hideEmptyLogos();
    await stripDone.catch(() => { /* a cover that cannot be read keeps its plate */ });
    if (!isCurrent(my)) return;
    const shown = [...panel.querySelectorAll<HTMLImageElement>('[data-issue] img, [data-ds-strip] img')].filter(img => !img.hidden && img.getAttribute('src'));
    await Promise.allSettled(shown.map(img => typeof img.decode === 'function' ? img.decode() : Promise.resolve()));
    if (isCurrent(my)) panel.dataset.issueReady = '1';
  };

  const refresh = async (): Promise<void> => {
    if (!live) return;
    const my = ++gen;
    let next: BrandPanelInput;
    try { next = await readBrandPanelInput(host); } catch { return; }
    if (!isCurrent(my)) return;
    const issue = panel.querySelector<HTMLElement>('[data-issue]');
    if (!issue) return;
    const hadFocus = issue.contains(document.activeElement);
    current = next;
    delete panel.dataset.issueReady;
    issue.innerHTML = issueHtml(next);
    if (hadFocus) issue.querySelector<HTMLElement>('#dash-brand-h')?.focus({ preventScroll: true });
    const stripDone = strip?.refresh(next.activeRecord?.id ?? '', stripCoverOf(next.model), next.systems);
    await hydrate(my, stripDone);
  };

  const onClick = (event: Event): void => {
    const e = event as MouseEvent;
    const target = e.target as Element | null;
    // Copy a value. Announced once on the polite status line, never on hover.
    const copy = target?.closest<HTMLElement>('[data-copy]');
    if (copy && panel.contains(copy)) {
      const value = copy.dataset.copy ?? '';
      const clip = navigator.clipboard;
      if (!value || typeof clip?.writeText !== 'function') return;
      clip.writeText(value).then(() => {
        copy.classList.add('is-copied');
        setTimeout(() => copy.classList.remove('is-copied'), 900);
        announce(tRaw('Copied {value}', { value }));
      }, () => { /* clipboard blocked: nothing was copied, so nothing is said */ });
      return;
    }
    // A contents link scrolls to its page and moves focus to the page title. A
    // modified click is left to the browser, so the link opens in a new tab.
    const jump = target?.closest<HTMLAnchorElement>('a[data-issue-jump]');
    const id = jump?.dataset.issueJump ?? '';
    if (!jump || !SECTION_ID.test(id) || isModifiedClick(e) || e.defaultPrevented) return;
    const page = panel.querySelector<HTMLElement>(`#${id}`);
    if (!page) return;
    e.preventDefault();
    if (page.tagName === 'DETAILS') (page as HTMLDetailsElement).open = true;
    page.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    panel.querySelector<HTMLElement>(`#${id}-h`)?.focus({ preventScroll: true });
  };

  // A logo file that fails to load leaves the page: the cover keeps its name,
  // and a Logos plate with nothing to show goes with its caption.
  const onError = (event: Event): void => {
    const img = event.target as HTMLElement | null;
    if (img?.tagName !== 'IMG' || !panel.contains(img)) return;
    if (img.classList.contains('ds-issue-logo')) img.remove();
    else if (img.classList.contains('ds-logo-img')) {
      const li = img.closest<HTMLElement>('[data-logo-id]');
      if (li) li.hidden = true;
      hideEmptyLogos();
    }
  };

  const onChanged = (): void => { void refresh(); };

  panel.addEventListener('click', onClick);
  panel.addEventListener('error', onError, true);
  window.addEventListener(DESIGN_SYSTEM_CHANGED_EVENT, onChanged);
  // On a first visit the catalog's companions are seeded after this tab read the
  // list, so the strip (hidden with one system) would stay hidden until a re-entry.
  window.addEventListener(DESIGN_SYSTEMS_LISTED_EVENT, onChanged);
  void hydrate(gen);

  return {
    refresh,
    teardown(): void {
      live = false;
      gen++;
      window.removeEventListener(DESIGN_SYSTEM_CHANGED_EVENT, onChanged);
      window.removeEventListener(DESIGN_SYSTEMS_LISTED_EVENT, onChanged);
      panel.removeEventListener('click', onClick);
      panel.removeEventListener('error', onError, true);
      strip?.teardown();
    },
  };
}
