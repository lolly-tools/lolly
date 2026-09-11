// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the Type room - fonts, specimens and role cards.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { displayFontFamily, italicFontFamily, listUserFonts, monoFontFamily, primaryFontFamily } from '../../user-fonts.ts';
import type { FontRole, UserFontFamily } from '../../user-fonts.ts';
import { collapsedFaceText, faceLine } from '../design-system/type-compare.ts';
import { fmtBytes } from '../device-info.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { FONT_ROLES, reportOwnership } from '../design-system/ownership.ts';
import { typeBeat } from '../design-system/beats-type.ts';
import { TYPE_ROLES, blankFaces, typeRoleActStrings, typeRoleLabel } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** A face of the design system's own. Every row in this list is one - the
 *  starter's faces are never rows, they are the fold below - so `is-own` is
 *  the tint every row wears and the green PRIMARY badge is earned by the one
 *  that serves the primary role (plan 182 section 4.2). */
export const fontRow = (bedit: BrandEditorCtx, f: UserFontFamily): string => {
  return `
    <li class="be-font-row is-own" data-font-family="${escapeText(f.family)}">
      <span class="be-font-aa" style="font-family:'${escapeText(f.family)}'" aria-hidden="true">Aa</span>
      <span class="be-font-meta"><span class="be-font-name" style="font-family:'${escapeText(f.family)}'">${escapeText(f.family)}</span>
        <span class="be-font-sub">${escapeText(f.weights)} · ${fmtBytes(f.bytes)}</span></span>
      <span class="be-font-roles">
      ${f.primary ? `<span class="be-font-badge">${t('Primary')}</span>`
        : `<button type="button" class="be-btn be-font-mp" data-mp="${escapeText(f.family)}">${t('Make primary')}</button>`}
      ${bedit.roles.roleControl(f.family, f.family === bedit.displayFamily, t('Headings'), 'display', 'data-display', t('Use for headings'), tRaw('Use {family} for h1/h2 headings', { family: f.family }))}
      ${bedit.roles.roleControl(f.family, f.family === bedit.monoFamily, t('Code'), 'mono', 'data-mono', t('Use for code'), tRaw('Use {family} for code & data', { family: f.family }))}
      ${bedit.roles.roleControl(f.family, f.family === bedit.italicFamily, t('Italic'), 'italic', 'data-italic', t('Use for italic'), tRaw('Use {family} for italic text', { family: f.family }))}
      </span>
      <button type="button" class="be-font-del" data-del="${escapeText(f.family)}" aria-label="${escapeText(tRaw('Remove {family}', { family: f.family }))}">&#x2715;</button>
    </li>`;
};
// The list of everything the person themself installed, plus one folded row
// for what the app shipped. Two registers, one list (plan 182 section 6.5):
// an own face is a row with its roles and a delete; the starter's faces are a
// fold that says which roles they are serving until somebody chooses.
export const joinWords = (_bedit: BrandEditorCtx, items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} ${t('and')} ${items[items.length - 1]}`;
export const starterFoldHtml = (bedit: BrandEditorCtx): string => {
  // family -> the roles it is serving, in the order the room shows them.
  const served = new Map<string, string[]>();
  for (const role of FONT_ROLES) {
    const face = bedit.faces[role];
    if (face.state !== 'inherited' || !face.family) continue;
    const list = served.get(face.family) ?? [];
    list.push(typeRoleLabel(role));
    served.set(face.family, list);
  }
  if (!served.size) return '';
  const summary = t('{families} · serving {roles} until you choose', {
    families: [...served.keys()].join(', '),
    roles: joinWords(bedit, [...served.values()].flat()),
  });
  const rows = [...served.entries()].map(([family, roles]) => `
      <div class="be-font-row be-font-row--starter">
        <span class="be-font-aa" style="font-family:'${escapeText(family)}'" aria-hidden="true">Aa</span>
        <span class="be-font-meta"><span class="be-font-name">${escapeText(family)}</span>
          <span class="be-font-sub">${t('Serving {roles}', { roles: joinWords(bedit, roles) })}</span></span>
      </div>`).join('');
  return `
    <li class="be-font-starter">
      <details class="be-subst-details be-font-starterfold">
        <summary><span class="be-pal-starter">${t('Starter')}</span><span class="be-font-startersum">${summary}</span></summary>
        <div class="be-font-starterbody">${rows}</div>
      </details>
    </li>`;
};
// The live specimen (Type roles panel): each role rendered in the face that
// actually serves it - --font-brand / --font-mono, whatever set them.
/** The face under a specimen block: the family plus the state it is in, so the
 *  same face can appear three times without three of them looking chosen
 *  (plan 182 T2). Text - it is escape()d into the sink below. */
export const specimenWho = (bedit: BrandEditorCtx, role: FontRole): string => {
  const face = bedit.faces[role];
  const family = face.family;
  if (face.state === 'own') return family;
  if (face.state === 'inherited') return family ? `${family} · ${t('starter')}` : t('starter');
  if (face.state === 'follows') return family ? `${family} · ${t('follows Primary')}` : t('follows Primary');
  return collapsedFaceText(role, face, tRaw);
};
export const paintSpecimen = (bedit: BrandEditorCtx): void => {
  const { root } = bedit;
  const mount = bedit.ramps.$('[data-be-specimen]') as HTMLElement | null; if (!mount) return;
  if (!root.isConnected) return;
  mount.innerHTML = `
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Heading (h1/h2)')}</span>
        <span class="be-typerole-sample be-typerole-sample--h" style="font-family:var(--font-display, var(--font-brand))">${t('Pack my box with five dozen liqueur jugs')}</span>
        <span class="be-typerole-face">${escapeText(specimenWho(bedit, 'display'))}</span>
      </div>
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Body')}</span>
        <span class="be-typerole-sample" style="font-family:var(--font-brand)">${t('Every tool, page and export follows the primary face - headings, body copy and UI alike. Sub-heading, call-to-action and italic roles arrive here as tokens tools can read.')}</span>
        <span class="be-typerole-face">${escapeText(specimenWho(bedit, 'brand'))}</span>
      </div>
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Italic')}</span>
        <span class="be-typerole-sample" style="font-family:var(--font-italic, var(--font-brand));font-style:italic">${t('Emphasis, quotations and asides wear the italic face.')}</span>
        <span class="be-typerole-face">${escapeText(specimenWho(bedit, 'italic'))}</span>
      </div>
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Code &amp; data')}</span>
        <span class="be-typerole-sample be-typerole-sample--mono" style="font-family:var(--font-mono)">lolly qr-code --url=https://example.com --export=svg</span>
        <span class="be-typerole-face">${escapeText(specimenWho(bedit, 'mono'))}</span>
      </div>`;
};
/**
 * The four role cards (level 0), updated IN PLACE - every dynamic string is
 * written as textContent onto nodes the scaffold already built. Deliberately
 * not a re-render: a repaint that replaced the cards would take the keyboard
 * off the button that caused it, and no family name would then be a step away
 * from a markup sink. The specimen itself needs no touching at all - it paints
 * through the role's CSS var, which applyChromeBrandVars has already moved.
 *
 * The card says which of four states its face is in (plan 182 section 4.2):
 * `is-own` is the tint, and it is earned only by a face the person installed -
 * an inherited one wears the Starter pill instead, a following one draws the
 * arrow and the role it follows. The button reads "Change" only on an own
 * face, because everything else is still a first choice.
 */
export const paintRoleCards = (bedit: BrandEditorCtx): void => {
  const { root, typeCardsPanel } = bedit;
  const grid = bedit.ramps.$('[data-be-typecards]') as HTMLElement | null;
  if (!grid || !root.isConnected) return;
  typeCardsPanel?.toggleAttribute('data-collapsed', bedit.stageOpen);
  for (const def of TYPE_ROLES) {
    const card = grid.querySelector<HTMLElement>(`[data-be-typecard="${def.id}"]`);
    if (!card) continue;
    const face = bedit.faces[def.id];
    const own = face.state === 'own';
    card.classList.toggle('is-own', own);
    card.classList.toggle('is-choosing', bedit.choosingRole === def.id);
    // tRaw, not t: these are written with textContent, so a family with an
    // ampersand in it must arrive as the ampersand (see type-compare.ts's
    // note on the two translators).
    const line = faceLine(def.id, face, tRaw);
    const faceEl = card.querySelector<HTMLElement>('[data-be-typecard-face]');
    if (faceEl) faceEl.textContent = line.text;
    const tagEl = card.querySelector<HTMLElement>('[data-be-typecard-tag]');
    if (tagEl) { tagEl.textContent = line.tag; tagEl.hidden = !line.tag; }
    const chipEl = card.querySelector<HTMLElement>('[data-be-typecard-chip]');
    if (chipEl) chipEl.textContent = collapsedFaceText(def.id, face, tRaw, bedit.choosingRole === def.id);
    // The label and the accessible name move together - see typeRoleActStrings.
    const act = typeRoleActStrings(typeRoleLabel(def.id), own);
    const actEl = card.querySelector<HTMLElement>('[data-be-typecard-actlabel]');
    if (actEl) actEl.textContent = act.text;
    const btn = card.querySelector<HTMLElement>('[data-be-typecard-choose]');
    btn?.setAttribute('aria-label', act.name);
    // Beat 0's one card carries the room's only decision, so its button is the
    // filled primary rather than the outline every card wears at beat 1. A
    // class swap, not a second fill recipe (buttons.css owns the fill).
    const hero = bedit.typeRoomBeat === 0 && def.id === 'brand';
    btn?.classList.toggle('be-cta', hero);
    btn?.classList.toggle('be-btn', !hero);
  }
};
export const paintFonts = async (bedit: BrandEditorCtx): Promise<void> => {
  const { fontsHost, root, tokens, typePanel } = bedit;
  const list = bedit.ramps.$('[data-be-fonts]') as HTMLElement | null; if (!list) return;
  bedit.fontFamilies = await listUserFonts(fontsHost).catch(() => []);
  bedit.monoFamily = await monoFontFamily(fontsHost).catch(() => '');
  bedit.displayFamily = await displayFontFamily(fontsHost).catch(() => '');
  bedit.italicFamily = await italicFontFamily(fontsHost).catch(() => '');
  bedit.brandFace = await primaryFontFamily(fontsHost).catch(() => '');
  const liveDoc = await tokens?.raw().catch(() => null) ?? null;
  if (!root.isConnected) return;
  // FACES ONLY. Two empty palette halves are what stop the read walking both
  // documents for an answer this room never asks for; face state does not
  // consult the starter document at all, since a declared family is the
  // person's own when it names a face installed HERE and inherited otherwise
  // (ownership.ts, `faceState`).
  const report = reportOwnership({
    doc: liveDoc,
    starterDoc: null,
    palette: { colors: [], starter: [] },
    userFontFamilies: bedit.fontFamilies.map(f => f.family),
    resolvedFaces: { brand: bedit.brandFace, display: bedit.displayFamily, mono: bedit.monoFamily, italic: bedit.italicFamily },
  });
  bedit.faces = report.faces;
  // An installed face with no role still needs its row, so the count of
  // families is part of the question - see beats-type.ts.
  bedit.typeRoomBeat = typeBeat(report, bedit.fontFamilies.length);
  typePanel?.setAttribute('data-be-beat', String(bedit.typeRoomBeat));
  const rows: string[] = [];
  if (bedit.fontFamilies.length) rows.push(`<li class="be-font-glabel" role="presentation">${t('In the design system')}</li>`);
  rows.push(...bedit.fontFamilies.map(bedit.type.fontRow));
  const fold = starterFoldHtml(bedit);
  rows.push(fold);
  if (!bedit.fontFamilies.length && !fold) rows.push(`<li class="be-font-empty">${t('No fonts added yet. Choose a face on a card above.')}</li>`);
  list.innerHTML = rows.join('');
  paintSpecimen(bedit);
  paintRoleCards(bedit);
  // A stage opened from a cold `?focus=stage` mount painted its pinned chips
  // before these faces resolved, so the starter's own SUSE and SUSE Mono were
  // offered as things to add. The faces are known now: repaint the row.
  if (bedit.stageOpen) bedit.compareStage.paintStagePins();
};
export function seedFonts(bedit: BrandEditorCtx): void {
  bedit.fontFamilies = [];
  bedit.monoFamily = '';    // the font.mono role's family, '' when the platform default serves
  bedit.displayFamily = ''; // the font.display (h1/h2 heading) role's family
  bedit.italicFamily = '';  // the font.italic role's family
  bedit.brandFace = '';     // what the primary role RESOLVES to (a starter face counts)
  /**
   * Which faces are the person's own and which came with the app - one read of
   * ownership.ts per paintFonts, and the cards, the rows, the specimen and the
   * BEAT all print from it. Before it says otherwise every role reads `unset`,
   * which is the honest resting state: nothing has been read yet.
   */
  bedit.faces = blankFaces();
  /** 0 = no face of its own (one card, one decision), 1 = the room. Named for
   *  its room: the Colours room keeps its own beat in this same mount scope. */
  bedit.typeRoomBeat = 0;
  /** The role the open stage is choosing for, and whether one is open at all.
   *  Held here rather than read off the stage block below, which is declared
   *  after the paints that need it. */
  bedit.choosingRole = null;
  bedit.stageOpen = false;
  const typePanel = bedit.ramps.$('[data-be-tab-panel="type"]') as HTMLElement | null; bedit.typePanel = typePanel;
  const typeCardsPanel = bedit.ramps.$('[data-be-typecards-panel]') as HTMLElement | null; bedit.typeCardsPanel = typeCardsPanel;
}

export function paintTypeRoom(bedit: BrandEditorCtx): void {
  void bedit.type.paintFonts();
  // ── The compare stage (plan 97 section 7.2) ────────────────────────────────────────
  // type-compare.ts renders candidates side by side and installs NOTHING; this
  // block owns opening it, seeding it, persisting a choice and closing it.
  //
  // NETWORK HONESTY. Google Fonts is the one egress in the studio and it stays
  // behind the same one-time consent it always was: `ensureGoogleFontsConsent`
  // is handed to the stage as its gate, so a PREVIEW asks exactly as an install
  // used to. Fetching a Google Font sends the family name and, unavoidably, the
  // user's IP address to Google, which is a third-party transfer they get to
  // refuse. (A German court has awarded damages over exactly this transfer:
  // LG München I, 3 O 17493/20.) Nothing else here reaches the network.
  const stageEl = bedit.ramps.$('[data-be-typestage]') as HTMLElement | null; bedit.stageEl = stageEl;
  const stageMount = bedit.ramps.$('[data-be-typestage-mount]') as HTMLElement | null; bedit.stageMount = stageMount;
  const stageTitleEl = bedit.ramps.$('[data-be-typestage-title]') as HTMLElement | null; bedit.stageTitleEl = stageTitleEl;
  const stageQ = bedit.ramps.$('[data-be-typestage-q]') as HTMLInputElement | null; bedit.stageQ = stageQ;
  const stageErr = bedit.ramps.$('[data-be-typestage-err]') as HTMLElement | null; bedit.stageErr = stageErr;
  bedit.stage = null;
  // Which role the open stage is choosing for lives in `choosingRole`, declared
  // up with the paints - they read it on every repaint to tint the card that is
  // choosing and to write "choosing…" into its collapsed pill. Null = the Fonts
  // panel's "Add a face": the face installs and takes no role beyond the
  // only-font promotion every install has always done.
  /** The control the stage was opened from - where the keyboard goes when it
   *  closes, however it closes. */
  bedit.stageReturn = null;
  /** Lowercased family → the tray candidate that put it on the stage, so a
   *  chosen face stops being pending in the tray instead of being offered again
   *  next week. */
  const stageFromTray = new Map<string, string>(); bedit.stageFromTray = stageFromTray;
  /** How many tray faces the stage opens with. Six cards fit; the point of the
   *  stage is the comparison the person is making, so a source's finds seed it
   *  without filling it. */
  const TRAY_SEED_MAX = 3; bedit.TRAY_SEED_MAX = TRAY_SEED_MAX;
}

export function typeOps(bedit: BrandEditorCtx) {
  return {
    fontRow: bindOp(bedit, fontRow),
    joinWords: bindOp(bedit, joinWords),
    starterFoldHtml: bindOp(bedit, starterFoldHtml),
    specimenWho: bindOp(bedit, specimenWho),
    paintSpecimen: bindOp(bedit, paintSpecimen),
    paintRoleCards: bindOp(bedit, paintRoleCards),
    paintFonts: bindOp(bedit, paintFonts),
    seedFonts: bindOp(bedit, seedFonts),
    paintTypeRoom: bindOp(bedit, paintTypeRoom),
  };
}
