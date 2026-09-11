// SPDX-License-Identifier: MPL-2.0
/**
 * The colour-profile panel - where an `.icc` on this device becomes a comparison
 * target the Colour Lab can chart against.
 *
 * ## Why it is not a *print* panel
 *
 * It was titled "Print profile", and that was never what the code did: `ingestProfile`
 * has always accepted any profile it can ask a gamut question of, and a `mntr` display
 * profile is exactly as valid a comparison target as a press condition - it simply has
 * no ink to report. The title claimed a restriction the ingest path does not enforce,
 * which is the kind of stale claim a reader can only discover by dropping a file and
 * being surprised. So the panel is "Colour profiles", and print is one SECTION in it.
 *
 * Loaded profiles are grouped by what the file says it is - `deviceClass` first,
 * `dataColourSpace` only as a fallback for rows stored before the class was recorded
 * ({@link groupFor}) - never by guessing from its name. Three groups:
 *
 * - **Print** (`prtr`, or an ink space): the press conditions an export can declare.
 * - **Display** (`mntr`): a screen. The ICC publishes an sRGB v2 profile under terms
 *   that plainly allow it, so this section has one preset of its own; everything else
 *   here is a file the reader brought. Apple's `Display P3.icc` is NOT redistributable
 *   and Elle Stone's set is CC-BY-SA, so neither is offered (plans/60-color-spaces.md section 11.8).
 * - **Other**: `scnr`, `spac`, `nmcl` - a class that characterises neither a press nor a
 *   screen. A scanner profile describes what a device can SEE, and a `spac` conversion
 *   profile (the ICC's own sRGB v4 preference is one) describes a transform, not a
 *   device; filing either under Display would be a claim the file does not make. The
 *   section is hidden when empty, and its rows print the class in words, because for
 *   these the class is the interesting fact. They are still chartable - this panel
 *   groups, it does not refuse.
 *
 * A library, not a setting: dropping a file ADDS it, and pressing one of its
 * intent buttons is the separate, deliberate act that repoints the charts. That
 * split is `lib/color-profiles.ts`'s (ingest ≠ activate) and this panel does not
 * blur it - a drop that was only meant to stock the library never moves the
 * report out from under the reader.
 *
 * ## Why intent is a control here and not a fourth tab out there
 *
 * A gamut question without a rendering intent is under-specified: the same
 * profile is a different gamut under `perceptual` than under `absolute`, which is
 * why the intent is part of `GamutSource.id` rather than an argument. But four
 * pills per profile in the Lab's comparison row is exactly the tab-row failure
 * section 11.6b describes. So the row out there carries ONE profile pill and the intent
 * choice lives on the profile's own row in here, next to the file it belongs to.
 *
 * An intent the profile has no table for is rendered UNAVAILABLE, never hidden:
 * "this file has no saturation table" is a real fact about the file (macOS's
 * Generic Lab Profile is exactly that case), and hiding the button would leave a
 * reader wondering whether we simply did not offer it. It carries `aria-disabled`
 * rather than `disabled` so it still takes focus and can still answer why.
 *
 * ## The press-condition rows
 *
 * The Print section lists the conditions an export can DECLARE in its OutputIntent,
 * and every row is a button. It was a readout, which was honest and useless - FOGRA39
 * and SWOP are the first two things a print reader looks for. Pressing one charts the
 * condition when its profile is here, fetches it from the ICC registry when there is a
 * licence-clean source (`lib/press-conditions.ts`), and otherwise opens the picker
 * naming the filename to look for. Declaring a condition still needs no profile at
 * all: nothing here gates an export.
 *
 * ## Refusals
 *
 * Two, both from `ingestProfile`, both stated in one line and neither in a modal:
 * a file the reader cannot parse, and a profile no intent can be asked a gamut
 * question in. Nothing else is refused - an RGB monitor profile is a perfectly
 * good comparison target, it simply has no ink to report.
 */

import '../styles/parts/dropzone.css';   // the .updz dropzone this reuses verbatim
import '../styles/parts/profiles-panel.css';   // the sections + the `+` pill that opens this
import {
  ingestProfile, listProfiles, isIngestFailure, INTENTS,
} from '../lib/color-profiles.ts';
import type { ColorProfilesHost, ProfileEntry } from '../lib/color-profiles.ts';
import type { RenderingIntent } from '@lolly/engine';
import { mountModal } from './modal.ts';
import {
  PRESS_CONDITIONS, conditionFor, locationHint, fetchSourceFor, sourceIsExact,
  fetchPressProfile,
} from '../lib/press-conditions.ts';
import type { FetchSource, PressCondition } from '../lib/press-conditions.ts';
import { originContradicted } from '../lib/press-profile-embed.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';

export interface ProfilesPanelOpts {
  host: ColorProfilesHost;
  /** The profile+intent currently charted against, so its button reads pressed. */
  active?: { digest: string; intent: RenderingIntent } | null;
  /** A link asked for a profile this device does not have - say so, once. */
  absent?: boolean;
  /**
   * Chart against this profile under this intent. Returns whether it took.
   *
   * A success channel rather than `void`, because activation genuinely can fail
   * on a row this panel is showing: the bytes can have been evicted or dropped by
   * another tab since the list was read, and a row whose stored `meta.intents` is
   * missing offers the default intent by fallback, which the live gate can then
   * refuse. Adopting the button unconditionally made the panel and the Lab's pill
   * row assert opposite things about one profile, and erased the only line that
   * said so.
   */
  onActivate(digest: string, intent: RenderingIntent): boolean | Promise<boolean>;
  /** The file (and its tab, and its pill) is gone. */
  onRemove(digest: string): void | Promise<void>;
  /** A file landed in the library. NOT an activation - the caller decides whether
   *  this is the profile a link was waiting for. */
  onIngest?(digest: string): void | Promise<void>;
}

/**
 * The intent buttons say the whole word.
 *
 * They used to read `per rel sat abs`. That is trade shorthand, and it is the panel
 * where a first-time reader meets rendering intents at all - the abbreviation was
 * saving width in a modal that has width to spare, and putting the meaning in a
 * `title` attribute, which does not exist on a touch device. A label the reader
 * understands beats a tooltip explaining a label they do not. The Lab's own pill still
 * abbreviates (`FOGRA39 · rel`, `shortLabel` in lib/color-profiles.ts) because 22
 * characters there genuinely is the budget.
 *
 * Lazy, not a module constant: `t` needs the catalog loaded.
 */
const intentName = (i: RenderingIntent): string => ({
  perceptual: t('Perceptual'),
  relative: t('Relative'),
  saturation: t('Saturation'),
  absolute: t('Absolute'),
}[i]);

const kb = (bytes: number): string => `${Math.max(1, Math.round(bytes / 1024))} kB`;

// ── Which section a loaded profile belongs in ─────────────────────────────────

/** The three sections. `other` is hidden until something lands in it. */
export type ProfileGroup = 'print' | 'display' | 'other';

/** An ink space: CMYK, CMY, or an n-colour separation. Same test the row meta uses. */
const INK_SPACE = /^(CMYK|CMY|[2-9A-F]CLR)$/i;

/**
 * The device class in words. Only shown for the `other` group, where "this file is a
 * scanner profile" is the fact that explains why it is filed there - for a printer or
 * a display the section heading has already said it.
 */
const CLASS_NAME = (cls: string): string => ({
  prtr: t('Printer'),
  mntr: t('Display'),
  scnr: t('Scanner'),
  spac: t('Colour space'),
  abst: t('Abstract'),
  link: t('Device link'),
  nmcl: t('Named colour'),
}[cls.trim().toLowerCase()] ?? cls.trim());

/**
 * Which section a profile belongs in, read off the FILE rather than its name.
 *
 * `deviceClass` decides, because that is the profile's own declaration of what it
 * characterises - a file called `MyScreen.icc` can be a press profile and a
 * `PSOcoated_v3` copy can be renamed to anything. Only when the class is missing (a row
 * stored before `entryFromRef` recorded one) does the colour space stand in, and an ink
 * space is the one thing it can say with confidence.
 */
export function groupFor(e: Pick<ProfileEntry, 'deviceClass' | 'colourSpace'>): ProfileGroup {
  const cls = e.deviceClass.trim().toLowerCase();
  if (cls === 'prtr') return 'print';
  if (cls === 'mntr') return 'display';
  if (cls) return 'other';                       // scnr / spac / abst / link / nmcl
  const sp = e.colourSpace.trim();
  if (INK_SPACE.test(sp)) return 'print';
  if (/^(RGB|GRAY)$/i.test(sp)) return 'display';
  return 'other';
}

// ── The Display section's presets ─────────────────────────────────────────────

/**
 * A display profile we may honestly offer to fetch.
 *
 * Same shape as a press condition's row (`identifier` + `info` + a source) so both
 * sections use ONE row treatment, but deliberately not the same list: a press condition
 * is a thing an export DECLARES, and nothing here is declarable. Kept in this module
 * rather than in `lib/press-conditions.ts` because that module is about the export
 * path's conditions; if a second display preset ever earns its place, moving both there
 * is the right next step.
 *
 * The bar for an entry is the bar `SOURCES` sets: the URL is PROBED to serve
 * `application/vnd.iccprofile` with `access-control-allow-origin: *`, and `licence`
 * quotes the provider verbatim. Nothing is mirrored - the bytes go from the ICC to the
 * reader's device, so Lolly is never the redistributor.
 *
 * What is deliberately absent, from the licence read in plans/60-color-spaces.md section 11.8:
 * Apple's `Display P3.icc` ("Copyright Apple Inc., 2022" - not redistributable, and P3
 * is already a built-in gamut modelled from matrices), and Elle Stone's CC-BY-SA set,
 * which would be this repo's first copyleft asset and needs a decision, not a commit.
 * The ICC's sRGB **v4 preference** profile is also absent on its own merits: it is
 * device class `spac`, a conversion profile, not a screen (see {@link groupFor}).
 */
interface DisplayPreset {
  /** Stable row id - also the `&limit=` -independent key the click handler reads. */
  id: string;
  /** The short name in the row's first column (`sRGB`). */
  identifier: string;
  /** What it is, in one line. */
  info: string;
  /** Substrings that identify a loaded profile as this preset, matched on its `desc`. */
  match: readonly string[];
  /** Filenames it usually has on a machine that already has it. */
  files: readonly string[];
  source: FetchSource;
}

const DISPLAY_PRESETS: readonly DisplayPreset[] = [
  {
    id: 'srgb-v2-2014',
    identifier: 'sRGB',
    // Probed 2026-07-28 with our own parseIccProfile: mntr, RGB, 3 ch, v2.0.0,
    // desc 'sRGB2014', all four intents answerable. A real display gamut, unlike the
    // v4 preference profile served two links away from it.
    info: 'sRGB v2 (2014) - the ICC’s own',
    match: ['srgb2014'],
    files: ['sRGB2014.icc'],
    source: {
      kind: 'fetch',
      url: 'https://registry.color.org/rgb-registry/profiles/sRGB2014.icc',
      name: 'sRGB2014.icc',
      bytes: 3024,
      // Verbatim from registry.color.org/profile-library ("Licensing"), read
      // 2026-07-28. Note it permits distribution outright - we fetch anyway, so the
      // profile arrives as the reader's own on-device asset like a Google font does.
      licence: 'International Color Consortium: “may be copied, distributed, embedded, made, used, and sold without restriction. Altered versions … shall not be misrepresented as the original profile”.',
    },
  },
];

/** One stored profile's row: what it is, which intents it can answer, and remove. */
function rowHtml(e: ProfileEntry, active: ProfilesPanelOpts['active'], group: ProfileGroup): string {
  // 'ink' only where there IS ink: a three-channel Lab or RGB profile has
  // channels, and calling them inks would be the kind of small false claim this
  // panel exists to avoid.
  const inky = INK_SPACE.test(e.colourSpace.trim());
  const meta = [
    // In `other` the class is why the row is there, so it leads. Elsewhere the heading
    // above has already said it and repeating it on every row is noise.
    group === 'other' && e.deviceClass ? CLASS_NAME(e.deviceClass) : '',
    e.colourSpace || e.deviceClass,
    e.channels ? (inky ? t('{n} ink', { n: String(e.channels) }) : t('{n} ch', { n: String(e.channels) })) : '',
    e.version ? `v${e.version}` : '',
    kb(e.bytes),
  ].filter(Boolean).join(' · ');
  const live = active?.digest === e.digest ? active.intent : null;
  // An intent with no table is aria-disabled rather than `disabled`: a disabled button
  // is unfocusable, so on a keyboard or a touch screen the reason it cannot be pressed
  // was unreachable. This way the button still takes focus (tooltip + focus ring) and a
  // tap answers in the status line instead of doing nothing.
  const intents = INTENTS.map((i) => {
    const can = e.intents.includes(i);
    const name = intentName(i);
    const tip = can ? '' : ` data-tip="${escape(tRaw('No {i} table in this file', { i: name.toLowerCase() }))}"`;
    return `<button type="button" class="view-seg-btn" data-lab-intent="${i}"
      aria-pressed="${live === i}"${can ? '' : ' aria-disabled="true"'}${tip}
      >${escape(name)}</button>`;
  }).join('');
  return `
    <li class="labp-row${live ? ' is-active' : ''}" data-labp-digest="${escape(e.digest)}">
      <div class="labp-row-head">
        <div class="labp-row-id">
          <strong class="labp-row-name">${escape(e.description || e.name)}</strong>
          <span class="labp-row-meta">${escape(meta)}</span>
        </div>
        <button type="button" class="labp-remove" data-labp-remove
          aria-label="${escape(tRaw('Remove {name}', { name: e.description || e.name }))}">${escape(t('Remove'))}</button>
      </div>
      <div class="view-seg labp-intents" role="group"
        aria-label="${escape(tRaw('Rendering intent for {name}', { name: e.description || e.name }))}">${intents}</div>
    </li>`;
}

/**
 * A preset row - one press condition, or one fetchable display profile.
 *
 * ONE treatment for both, reusing the `.labp-cond*` classes rather than growing a
 * second near-identical set: the reader's question ("is this here, and what happens if
 * I press it?") is the same on both sections, so the answer should look the same. The
 * whole row is a real `<button>`, so it is focusable, Enter/Space activated, announced
 * with its own action, and a comfortable tap target on a phone.
 */
function presetRowHtml(o: {
  attr: string; id: string; identifier: string; name: string; note: string;
  label: string; state: 'loaded' | 'fetch' | 'declare';
}): string {
  return `<li class="labp-cond" data-state="${o.state}">
    <button type="button" class="labp-cond-btn" ${o.attr}="${escape(o.id)}"
      aria-label="${escape(o.label)}">
      <span class="labp-cond-id">${escape(o.identifier)}</span>
      <span class="labp-cond-name">${escape(o.name)}</span>
      <span class="labp-cond-note" data-labp-cond-note>${escape(o.note)}</span>
    </button>
  </li>`;
}

/**
 * Open the panel. Resolves when it closes.
 *
 * The whole panel body is an innerHTML target and may be - it hosts buttons and a
 * file input, no MOUNTED control. (The Lab's readability cards and picker are the
 * ones that must never be rebuilt under themselves; nothing of that kind is here.)
 */
export function openProfilesPanel(opts: ProfilesPanelOpts): Promise<void> {
  return new Promise<void>((resolve) => {
    const modal = mountModal<void>(`
      <div class="labp">
        <header class="labp-head">
          <h2 class="labp-title">${escape(t('Colour profiles'))}</h2>
          <button type="button" class="labp-close" data-labp-close
            aria-label="${escape(t('Close'))}">×</button>
        </header>
        ${/* Says what a profile BECOMES and that it stays here. It used to say "from
              your printer" and "a fourth comparison target", both of which the code
              never meant: any class mounts, and the count depends on what is loaded. */''}
        <p class="labp-intro">${escape(t('A press condition or a display profile from this device becomes a comparison target beside the built-in gamuts. Nothing leaves this device.'))}</p>
        <label class="updz labp-drop">
          ${/* `multiple` because `take` has always looped a FileList - a DROP can carry
                several files and was handled, while the picker refused a second one for
                no reason. A print reader adding their shop's conditions has more than
                one, and each is an independent ingest. */''}
          <input type="file" class="updz-input visually-hidden" data-labp-file multiple
            accept=".icc,.icm,application/vnd.iccprofile"
            aria-label="${escape(t('Add an ICC profile'))}">
          <span class="updz-icon" aria-hidden="true">${icon('upload')}</span>
          <span class="updz-copy">
            <span class="updz-text">${escape(t('Drop an .icc here, or'))} <span class="updz-browse">${escape(t('browse'))}</span></span>
            <span class="updz-hint">${escape(t('ICC v2 or v4 - a press condition, or any device profile'))}</span>

          </span>
        </label>
        ${/* The fastest route to a real press profile is often one already on the
              machine - it is offline, and it is the exact separation the shop uses.
              (The ICC registry can also be fetched; see the condition rows below.)
              BELOW the drop zone, not inside it - three wrapped lines of path turned
              the target into a wall of text. */''}
        <p class="labp-where">${escape(t('Already on this device:'))} <code>${escape(locationHint())}</code></p>
        <p class="labp-msg" data-labp-msg role="status" aria-live="polite"${opts.absent ? '' : ' hidden'}
          >${opts.absent ? escape(t('This link compares against a profile that isn’t on this device.')) : ''}</p>
        ${/* Two sections, because the reader already knows whether they care about press
              or screen - the split matches the question rather than the storage. Each
              carries the profiles OF that kind that are loaded, then the ones we can
              honestly offer to get. `Other` is last and hidden until it has a row. */''}
        <section class="labp-sec" data-labp-sec="print">
          <h3 class="labp-sec-h">${escape(t('Print'))}</h3>
          <ul class="labp-list" data-labp-list="print"></ul>
          <p class="labp-hint" data-labp-paper hidden>${escape(t('absolute keeps the paper white'))}</p>
          ${/* What a Print PDF can DECLARE, and whether we can also evaluate it. The
                export panel has always let you name one of these in the OutputIntent;
                naming is a claim about your target, and it carries no measurements, so
                the Lab could say nothing about the condition your own export names. Each
                row closes that in one press: it charts the condition if its profile is
                here, fetches it from the ICC registry if it is not, and falls back to the
                file picker with the filename to look for. No row does nothing. */''}
          <h4 class="labp-conds-h">${escape(t('Press conditions your exports can declare'))}</h4>
          <ul class="labp-conds-list" data-labp-conds></ul>
        </section>
        ${/* No sub-heading here on purpose: a display preset is not declarable and not a
              standard your export names, so there is nothing extra to say about the list
              that its own rows do not. */''}
        <section class="labp-sec" data-labp-sec="display">
          <h3 class="labp-sec-h">${escape(t('Display'))}</h3>
          <ul class="labp-list" data-labp-list="display"></ul>
          <ul class="labp-conds-list" data-labp-displays></ul>
        </section>
        <section class="labp-sec" data-labp-sec="other" hidden>
          <h3 class="labp-sec-h">${escape(t('Other'))}</h3>
          <ul class="labp-list" data-labp-list="other"></ul>
        </section>
      </div>`, {
      className: 'modal labp-modal',
      ariaLabel: t('Colour profiles'),
      initialFocus: el => el.querySelector<HTMLElement>('[data-labp-file]'),
      onClose: () => resolve(),
    });

    const el = modal.el;
    const lists: Record<ProfileGroup, HTMLElement> = {
      print: el.querySelector<HTMLElement>('[data-labp-list="print"]')!,
      display: el.querySelector<HTMLElement>('[data-labp-list="display"]')!,
      other: el.querySelector<HTMLElement>('[data-labp-list="other"]')!,
    };
    const msg = el.querySelector<HTMLElement>('[data-labp-msg]')!;
    const file = el.querySelector<HTMLInputElement>('[data-labp-file]')!;
    const drop = el.querySelector<HTMLElement>('.labp-drop')!;

    const say = (text: string): void => {
      msg.textContent = text;
      msg.hidden = !text;
      if (text) announce(text);
    };

    const conds = el.querySelector<HTMLElement>('[data-labp-conds]')!;
    const displays = el.querySelector<HTMLElement>('[data-labp-displays]')!;
    const otherSec = el.querySelector<HTMLElement>('[data-labp-sec="other"]')!;
    const paperHint = el.querySelector<HTMLElement>('[data-labp-paper]')!;

    /** condition id → the stored profile that satisfies it. Filled by `refresh`, read by
     *  `pickCondition`, so a press acts on the same list the reader is looking at. */
    const loaded = new Map<string, ProfileEntry>();
    /** The same, for the display presets. Separate map, separate id space. */
    const loadedDisplays = new Map<string, ProfileEntry>();

    async function refresh(): Promise<void> {
      const rows = await listProfiles(opts.host).catch(() => []);
      for (const g of ['print', 'display', 'other'] as const) {
        // No per-section empty state: both visible sections carry preset rows, so an
        // empty list is not an empty section, and "No profiles yet." under a heading
        // that has four things under it would be a false statement. `:empty` collapses
        // the list so it costs no gap either.
        lists[g].innerHTML = rows.filter(e => groupFor(e) === g)
          .map(e => rowHtml(e, opts.active, g)).join('');
      }
      // Hidden until it has a row: a heading with nothing under it is a question the
      // reader cannot act on.
      otherSec.hidden = !lists.other.childElementCount;
      // The intent aside belongs to the print rows it explains - paper white is a press
      // fact, and with no press profile loaded there is nothing for it to describe.
      paperHint.hidden = !lists.print.childElementCount;

      // A condition is "loaded" when one of the profiles on this device names it.
      // Matched on the profile's own `desc`, since that is what the vendor wrote - 
      // several spellings are in circulation, which is why the match list is a list.
      loaded.clear();
      for (const e of rows) {
        const c = conditionFor(e.description || e.name);
        if (c && !loaded.has(c.id)) loaded.set(c.id, e);
      }
      conds.innerHTML = PRESS_CONDITIONS.map((c) => {
        const found = loaded.get(c.id);
        const src = fetchSourceFor(c);
        // Three different facts, and the row states which one it is holding. Declaring
        // a condition in a PDF is a claim about your target and needs no file;
        // COMPARING against it needs the file's measurements. Nothing here is a
        // refusal - a condition with no profile still exports exactly as it did.
        const state = found ? 'loaded' : src ? 'fetch' : 'declare';
        const note = found
          ? tRaw('Loaded - {name}', { name: found.description || found.name })
          : src
            // The row names the FILE it will fetch, not the condition, because those are
            // not always the same thing: an export declares CGATS TR 001 for SWOP and the
            // registry's profile is built from TR003. Saying which file it is getting is
            // how the reader can tell.
            ? (sourceIsExact(c)
              ? tRaw('Get {file} - free from the ICC registry', { file: src.name })
              : tRaw('Get {file} - free from the ICC registry, built from {data}', { file: src.name, data: src.charData ?? '' }))
          : c.files.length
            ? tRaw('Exports can declare it. Look for {file} on this device.', { file: c.files[0]! })
            : t('Exports can declare it. Load its profile to compare against it.');
        const label = found
          ? tRaw('Compare against {name}', { name: c.info })
          : src
            ? tRaw('Get the profile for {name}', { name: c.info })
            : tRaw('Choose the profile for {name}', { name: c.info });
        return presetRowHtml({
          attr: 'data-labp-cond', id: c.id, identifier: c.identifier, name: c.info,
          note, label, state,
        });
      }).join('');

      // The display presets, same three facts and the same row. There is no `declare`
      // state here - a display profile is nothing an export names, so a preset with no
      // source would be a row with nothing to do, and none is listed.
      loadedDisplays.clear();
      for (const e of rows) {
        const desc = (e.description || e.name).toLowerCase();
        for (const d of DISPLAY_PRESETS) {
          if (!loadedDisplays.has(d.id) && d.match.some(m => desc.includes(m))) loadedDisplays.set(d.id, e);
        }
      }
      displays.innerHTML = DISPLAY_PRESETS.map((d) => {
        const found = loadedDisplays.get(d.id);
        return presetRowHtml({
          attr: 'data-labp-display',
          id: d.id,
          identifier: d.identifier,
          name: d.info,
          note: found
            ? tRaw('Loaded - {name}', { name: found.description || found.name })
            : tRaw('Get {file} - free from the ICC registry', { file: d.source.name }),
          label: found
            ? tRaw('Compare against {name}', { name: d.info })
            : tRaw('Get the profile for {name}', { name: d.info }),
          state: found ? 'loaded' : 'fetch',
        });
      }).join('');
    }

    /**
     * A condition row was pressed. Never a dead end - the three states it can be in
     * are the three useful things to do:
     *
     * 1. the profile is here → chart against it and get out of the way (this is the
     *    one that must feel instant: it is the same act as pressing its intent pill);
     * 2. a licence-clean source exists → fetch it once, store it on-device, chart it.
     *    Deliberately NOT the drop zone's ingest≠activate split: a drop only stocks the
     *    library, but pressing a condition IS the request to compare against it;
     * 3. nothing to fetch → open the picker the user already has open, and name the
     *    file to look for. A filename is two clicks; a folder is a search.
     */
    async function pickCondition(id: string): Promise<void> {
      const c = PRESS_CONDITIONS.find(x => x.id === id);
      if (!c) return;
      const found = loaded.get(id);
      if (found) { await chartAgainst(found.digest, found.activeIntent); return; }
      const src = fetchSourceFor(c);
      if (!src) { wantFile(c); return; }

      const bytes = await fetchInto(`[data-labp-cond="${CSS.escape(id)}"]`, src, c.files);
      if (!bytes) return;
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.iccprofile' });
      // Record WHERE this came from. A registry fetch for condition `c` pairs the
      // profile with that condition by construction, which is what lets a Print PDF
      // embed it and still declare a registered name (press-profile-embed.ts). Note
      // it is recorded even for SWOP, whose source states CGATS TR003: sourceIsExact
      // is false there, so the pairing step declines it and the export says `Custom`.
      //
      // Unless the bytes that actually arrived contradict the row - if the registry
      // ever re-points a filename, the file's own `targ` says so, and an origin that
      // is wrong is worse than no origin at all. Refusing to record it here is
      // cheaper than repairing it on every export (the embed path re-checks anyway).
      const provenance = originContradicted(bytes, c.id)
        ? null
        : { kind: 'registry' as const, url: src.url, conditionId: c.id, charData: src.charData };
      const r = await ingestProfile(
        opts.host,
        typeof File === 'function' ? new File([blob], src.name, { type: blob.type }) : blob,
        provenance ? { origin: provenance } : {},
      ).catch(() => ({ error: 'unreadable' as const }));
      if (isIngestFailure(r)) {
        say(t('That file isn’t a profile this can read.'));
        return;
      }
      await opts.onIngest?.(r.digest);
      await chartAgainst(r.digest, r.activeIntent);
    }

    /**
     * Fetch a preset's bytes with the row saying so, or null and a line saying why not.
     *
     * Shared by both preset kinds: the row keeps its place while the fetch is in flight
     * (`data-busy` stops a second press), the note says which file is coming, and a
     * failure names the file to look for on this device rather than the network's
     * complaint - offline, the profile is very likely already installed.
     */
    async function fetchInto(
      sel: string, src: FetchSource, files: readonly string[],
    ): Promise<Uint8Array | null> {
      const row = el.querySelector<HTMLElement>(sel)?.closest<HTMLElement>('.labp-cond');
      const note = row?.querySelector<HTMLElement>('[data-labp-cond-note]');
      const was = note?.textContent ?? '';
      row?.setAttribute('data-busy', '');
      if (note) note.textContent = tRaw('Fetching {file}…', { file: src.name });
      const bytes = await fetchPressProfile(src);
      row?.removeAttribute('data-busy');
      if (note) note.textContent = was;
      if (!bytes) {
        say(files.length
          ? tRaw('Couldn’t fetch it. Look for {file} on this device.', { file: files[0]! })
          : t('Couldn’t fetch it - add the file yourself.'));
        return null;
      }
      return bytes;
    }

    /**
     * A display preset was pressed. Two states, not three: it is either here (chart it)
     * or fetchable (get it, then chart it). No `origin` is recorded - provenance exists
     * to let a Print PDF declare a registered press condition (press-profile-embed.ts),
     * and a display profile declares nothing, so inventing an origin for it would put a
     * claim in the store that no export could honour.
     */
    async function pickDisplay(id: string): Promise<void> {
      const d = DISPLAY_PRESETS.find(x => x.id === id);
      if (!d) return;
      const found = loadedDisplays.get(id);
      if (found) { await chartAgainst(found.digest, found.activeIntent); return; }
      const bytes = await fetchInto(`[data-labp-display="${CSS.escape(id)}"]`, d.source, d.files);
      if (!bytes) return;
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.iccprofile' });
      const r = await ingestProfile(
        opts.host,
        typeof File === 'function' ? new File([blob], d.source.name, { type: blob.type }) : blob,
      ).catch(() => ({ error: 'unreadable' as const }));
      if (isIngestFailure(r)) {
        say(t('That file isn’t a profile this can read.'));
        return;
      }
      await opts.onIngest?.(r.digest);
      await chartAgainst(r.digest, r.activeIntent);
    }

    /** Chart against a profile and close, or say why the charts did not move. */
    async function chartAgainst(digest: string, intent: RenderingIntent): Promise<void> {
      const ok = await opts.onActivate(digest, intent);
      if (ok) { opts.active = { digest, intent }; modal.close(); return; }
      say(t('That profile could not be read - add the file again.'));
      await refresh();
    }

    /** No source to fetch: open the picker and name the file worth looking for. */
    function wantFile(c: PressCondition): void {
      if (c.files.length) say(tRaw('Look for {file} in {where}', { file: c.files.join(t(' or ')), where: locationHint() }));
      file.click();
    }

    async function take(files: FileList | null): Promise<void> {
      if (!files?.length) return;
      drop.classList.add('is-busy');
      for (const f of Array.from(files)) {
        const r = await ingestProfile(opts.host, f).catch(() => ({ error: 'unreadable' as const }));
        if (!isIngestFailure(r)) {
          say('');
          await opts.onIngest?.(r.digest);
          continue;
        }
        say(r.error === 'unreadable'
          ? t('That file isn’t a profile this can read.')
          : t('This profile has no gamut to compare against.'));
      }
      drop.classList.remove('is-busy');
      file.value = '';
      await refresh();
    }

    file.addEventListener('change', () => { void take(file.files); });
    for (const evt of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
    }
    for (const evt of ['dragenter', 'dragover']) {
      drop.addEventListener(evt, () => drop.classList.add('is-dragover'));
    }
    for (const evt of ['dragleave', 'drop']) {
      drop.addEventListener(evt, () => drop.classList.remove('is-dragover'));
    }
    drop.addEventListener('drop', (e) => { void take((e as DragEvent).dataTransfer?.files ?? null); });

    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-labp-close]')) { modal.close(); return; }
      const preset = target.closest<HTMLElement>('[data-labp-cond], [data-labp-display]');
      if (preset) {
        if (preset.closest('.labp-cond')?.hasAttribute('data-busy')) return;  // a fetch is in flight
        const { labpCond, labpDisplay } = preset.dataset;
        if (labpCond) void pickCondition(labpCond);
        else if (labpDisplay) void pickDisplay(labpDisplay);
        return;
      }
      const row = target.closest<HTMLElement>('[data-labp-digest]');
      const digest = row?.dataset.labpDigest;
      if (!digest) return;
      if (target.closest('[data-labp-remove]')) {
        void Promise.resolve(opts.onRemove(digest)).then(() => {
          opts.active = opts.active?.digest === digest ? null : opts.active;
          return refresh();
        });
        return;
      }
      const btn = target.closest<HTMLElement>('[data-lab-intent]');
      const intent = btn?.dataset.labIntent as RenderingIntent | undefined;
      if (!intent) return;
      if (btn?.getAttribute('aria-disabled') === 'true') {
        // Focusable on purpose (see rowHtml), so this is reachable by touch and keyboard
        // rather than being a button that silently does nothing.
        say(tRaw('No {i} table in this file', { i: intentName(intent).toLowerCase() }));
        return;
      }
      void Promise.resolve(opts.onActivate(digest, intent)).then((ok) => {
        if (ok) {
          opts.active = { digest, intent };
          say('');
        } else {
          // The charts did NOT move, so the button must not read pressed. Say what
          // is true of the file rather than of the click: re-adding it is the fix.
          say(t('That profile could not be read - add the file again.'));
        }
        return refresh();
      });
    });

    void refresh();
  });
}
