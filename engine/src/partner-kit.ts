// SPDX-License-Identifier: MPL-2.0
/**
 * Reads a partner kit (`partner-kit-v1`, Lolly Work plan 82 M8) and proposes its colours.
 *
 * A kit is a partner company's logos pinned by asset version, up to twelve named colours
 * in closed roles and optional placement rules. It is a guest in the lead brand's work:
 * it is never a design system, never a `tokens` asset and never carries fonts. This one
 * reader is what the web app, the CLI and Lolly Work's server all use, so a kit one of
 * them accepts is a kit the others accept.
 *
 * The two proposers help someone make a kit from what a partner sent: the colours a token
 * document's semantic slots hold, or the inks of the partner's own SVG logo. Each returns
 * a proposal for a person to rename, keep or remove. Neither reads a rule: Lolly does not
 * know a partner's rules, so the rules are always typed by a person.
 *
 * Pure: no DOM, no network, no clock.
 */
import Ajv, { type ValidateFunction } from 'ajv';
import schema from '@lolly-tools/core/schema/partner-kit-v1.schema.json' with { type: 'json' };
import {
  PARTNER_KIT_LOGO_SURFACES,
  PARTNER_KIT_MAX_BYTES,
  PARTNER_KIT_MAX_COLOURS,
  PARTNER_KIT_MAX_COLOUR_NAME,
  type PartnerKitColourRoleV1,
  type PartnerKitColourV1,
  type PartnerKitIssueV1,
  type PartnerKitV1,
} from '@lolly-tools/core/partner-kit-v1';
import { colorToHex, createTokenSet, toSwatch } from './tokens.ts';
import { colorToHexString, parseColor } from './css-color.ts';
import { hexToOklch } from './brand-derive.ts';

let validator: ValidateFunction<PartnerKitV1> | undefined;
function schemaValidator(): ValidateFunction<PartnerKitV1> {
  if (!validator) validator = new Ajv({ allErrors: false }).compile<PartnerKitV1>(schema);
  return validator;
}

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

/** The result of reading a kit: the kit, or why it was refused. */
export type PartnerKitReadResult = { ok: true; kit: PartnerKitV1 } | { ok: false; issues: PartnerKitIssueV1[] };

/**
 * Read a kit from its JSON text or from a parsed value. Refuses a kit over 64 KB, one that
 * does not match `partner-kit-v1`, and one that pins the same logo asset twice. Returns a
 * copy with colour values in lower case.
 */
export function checkPartnerKit(input: unknown): PartnerKitReadResult {
  let value: unknown = input;
  let size: number;
  if (typeof input === 'string') {
    size = utf8Length(input);
    if (size > PARTNER_KIT_MAX_BYTES) return tooLarge(size);
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, issues: [{ code: 'kit.json', message: 'The kit is not JSON.' }] };
    }
  } else {
    let text: string | undefined;
    try {
      text = JSON.stringify(input);
    } catch {
      text = undefined;
    }
    if (typeof text !== 'string') return { ok: false, issues: [{ code: 'kit.json', message: 'The kit cannot be written as JSON.' }] };
    size = utf8Length(text);
    if (size > PARTNER_KIT_MAX_BYTES) return tooLarge(size);
  }
  const validate = schemaValidator();
  if (!validate(value)) {
    const error = validate.errors?.[0];
    const path = error?.instancePath || '';
    return {
      ok: false,
      issues: [{ code: 'kit.schema', message: `The kit does not match partner-kit-v1${path ? ` at ${path}` : ''}: ${error?.message ?? 'unknown problem'}.`, ...(path ? { path } : {}) }],
    };
  }
  const seen = new Set<string>();
  for (const surface of PARTNER_KIT_LOGO_SURFACES) {
    const logo = value.logos[surface];
    if (!logo) continue;
    if (seen.has(logo.id)) {
      return { ok: false, issues: [{ code: 'kit.logo-duplicate', message: `The kit pins the logo ${logo.id} twice.`, path: `/logos/${surface}` }] };
    }
    seen.add(logo.id);
  }
  const kit = structuredClone(value);
  kit.colours = kit.colours.map(c => ({ ...c, value: c.value.toLowerCase() }));
  return { ok: true, kit };
}

function tooLarge(size: number): PartnerKitReadResult {
  return { ok: false, issues: [{ code: 'kit.too-large', message: `The kit is ${size.toLocaleString('en')} bytes; a kit may take at most ${PARTNER_KIT_MAX_BYTES.toLocaleString('en')}.` }] };
}

/** Read a kit, or null when it is refused. `checkPartnerKit` says why. */
export function readPartnerKit(input: unknown): PartnerKitV1 | null {
  const result = checkPartnerKit(input);
  return result.ok ? result.kit : null;
}

/** The catalog asset ids a kit's logos name, in surface order (light, dark, mark). */
export function partnerKitLogoIds(kit: Pick<PartnerKitV1, 'logos'>): string[] {
  const ids: string[] = [];
  for (const surface of PARTNER_KIT_LOGO_SURFACES) {
    const id = kit.logos?.[surface]?.id;
    if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * `#rrggbb` in lower case for an opaque colour, else null (translucent or unreadable).
 * A token value object goes through `colorToHex`; a CSS colour, named ones included
 * (`red`, `black`, which `colorToHex` and `extractSvgColors` keep as names), goes through
 * the CSS colour parser.
 */
function opaqueHex(value: unknown): string | null {
  const text = typeof value === 'string' ? value : colorToHex(value);
  if (typeof text !== 'string' || !text.trim()) return null;
  const parsed = parseColor(text.trim());
  if (!parsed || parsed.alpha < 1) return null;
  const hex = colorToHexString({ ...parsed, alpha: 1 }).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

const ROLE_WORD: Record<PartnerKitColourRoleV1, string> = {
  primary: 'Primary', secondary: 'Secondary', accent: 'Accent', text: 'Text', surface: 'Surface',
};

/** Where a token document keeps each proposed role, most specific first. */
const TOKEN_SLOT_PATHS: ReadonlyArray<[PartnerKitColourRoleV1, readonly string[]]> = [
  ['primary', ['color.semantic.primary', 'color.primary', 'color.brand.primary']],
  ['secondary', ['color.semantic.secondary', 'color.secondary', 'color.brand.secondary']],
  ['accent', ['color.semantic.accent', 'color.accent', 'color.brand.accent']],
];

/** A token path's last segment as words: `brand.northwind-blue` reads "Northwind blue". */
function leafWords(path: string): string {
  const leaf = (path.split('.').pop() ?? '').replace(/[-_]+/g, ' ').trim();
  return leaf ? leaf[0]!.toUpperCase() + leaf.slice(1) : '';
}

/**
 * The name a document gives a colour outside its semantic slots, so a slot that points at
 * `color.brand.northwind-blue` proposes "Northwind blue" rather than "Primary". A token's
 * description is prose and is not used as a name.
 */
function namedElsewhere(tokens: ReturnType<typeof createTokenSet>, value: string): string | null {
  for (const entry of tokens.query({ type: 'color' })) {
    if (entry.path.startsWith('color.semantic.') || /^color\.(primary|secondary|accent)$/.test(entry.path)) continue;
    let hex: string | null;
    try {
      hex = opaqueHex(toSwatch(entry).value);
    } catch {
      hex = null;
    }
    if (hex === value) return leafWords(entry.path) || null;
  }
  return null;
}

/**
 * The document's own name for its light look, matched without regard to case, so a
 * Tokens Studio file whose themes are `Light` and `Dark` is read in `Light` even when the
 * file was saved with `Dark` active. Undefined when no theme is called light, which reads
 * the document in the theme it is set to.
 */
function lightThemeName(doc: unknown): string | undefined {
  const themes = createTokenSet(doc).themes();
  const light = themes.find(t => t.name.trim().toLowerCase() === 'light') ?? themes.find(t => (t.id ?? '').trim().toLowerCase() === 'light');
  return light ? (light.name || light.id) : undefined;
}

/**
 * Propose kit colours from a DTCG token document (one a reader such as `coerceTokensDoc`,
 * `assembleTokenSetFiles` or `extractPenpotProject` has already produced): the primary,
 * secondary and accent colours of the light look, read from `color.semantic.<role>`, then
 * `color.<role>`, then `color.brand.<role>`. A role the document does not hold, or holds
 * as a translucent or unreadable colour, is left out. The token document is read for its
 * colours only and is never stored in the kit.
 */
export function partnerKitColoursFromTokens(doc: unknown): PartnerKitColourV1[] {
  let tokens: ReturnType<typeof createTokenSet>;
  try {
    const light = lightThemeName(doc);
    tokens = createTokenSet(doc, light ? { theme: light } : {});
  } catch {
    return [];
  }
  const out: PartnerKitColourV1[] = [];
  const values = new Set<string>();
  for (const [role, paths] of TOKEN_SLOT_PATHS) {
    for (const path of paths) {
      const entry = tokens.get(path);
      if (entry?.type !== 'color') continue;
      let swatch: ReturnType<typeof toSwatch>;
      try {
        swatch = toSwatch(entry);
      } catch {
        continue;
      }
      const value = opaqueHex(swatch.value);
      if (!value) continue;
      if (!values.has(value)) {
        values.add(value);
        out.push({ role, name: (namedElsewhere(tokens, value) ?? ROLE_WORD[role]).slice(0, PARTNER_KIT_MAX_COLOUR_NAME), value });
      }
      break;
    }
  }
  return out;
}

/** A colour no darker than this, with almost no chroma, is a knockout and not an ink. */
const WHITE_L = 0.97;
/** Below this chroma a colour reads as neutral (black, grey or white). */
const NEUTRAL_C = 0.03;
/** Darker than this, a colour reads as near black up to `DARK_C` chroma. */
const DARK_L = 0.3;
const DARK_C = 0.06;

/**
 * Propose kit colours from a logo's inks (the colours `extractSvgColors` reads from an SVG,
 * in first-seen order). Chromatic inks become primary, secondary, then accent; the first
 * dark neutral becomes text and the first light neutral that is not white becomes surface.
 * White, translucent and unreadable values are left out, duplicates collapse, and at most
 * twelve come back. A raster logo has no inks to read, so its caller proposes nothing.
 */
export function partnerKitColoursFromInks(colours: readonly string[]): PartnerKitColourV1[] {
  const out: PartnerKitColourV1[] = [];
  const values = new Set<string>();
  let chromatic = 0;
  let accents = 0;
  let text = false;
  let surface = false;
  for (const raw of Array.isArray(colours) ? colours.slice(0, 1000) : []) {
    if (out.length >= PARTNER_KIT_MAX_COLOURS) break;
    const value = opaqueHex(raw);
    if (!value || values.has(value)) continue;
    const lch = hexToOklch(value);
    if (!lch) continue;
    // A near-black with a little hue (a navy or slate wordmark) still reads as text.
    const neutral = lch.c < NEUTRAL_C || (lch.l < DARK_L && lch.c < DARK_C);
    if (neutral && lch.l >= WHITE_L) continue;
    let role: PartnerKitColourRoleV1;
    let name: string;
    if (neutral) {
      if (lch.l < 0.5) {
        if (text) continue;
        text = true;
        role = 'text';
      } else {
        if (surface) continue;
        surface = true;
        role = 'surface';
      }
      name = ROLE_WORD[role];
    } else {
      role = chromatic === 0 ? 'primary' : chromatic === 1 ? 'secondary' : 'accent';
      chromatic++;
      if (role === 'accent') accents++;
      name = role === 'accent' && accents > 1 ? `${ROLE_WORD.accent} ${accents}` : ROLE_WORD[role];
    }
    values.add(value);
    out.push({ role, name, value });
  }
  return out;
}
