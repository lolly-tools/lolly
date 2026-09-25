// SPDX-License-Identifier: MPL-2.0
/** Versioned licence identifiers, the reviewed licence profiles the rights evaluator applies, and the one locator rule every credit reads (plan 253). */
import type { CreativeClassificationV1, CreativeUseRoleV1, UseContextV1 } from '@lolly-tools/core/rights-v1';

/**
 * The version of the whole rule set in this file and in rights-evaluate.ts. It
 * goes into every evaluation fingerprint, so a rule change invalidates the
 * decisions a person recorded against the old rules instead of carrying them
 * forward. Bump it in the same commit as any rule or profile edit.
 */
export const RIGHTS_RULES_VERSION = 'rights-rules-2026-09-13.2';

/** What a licence asks of one use: nothing, a credit, or a notice text kept verbatim. */
export type RoleObligationV1 = 'none' | 'attribution' | 'notice';

/** Which parts of a credit the licence asks for. A part is included only when the source supplied it. */
export interface AttributionPartsV1 {
  creator: boolean;
  title: boolean;
  copyrightNotice: boolean;
  licenceNameAndLink: boolean;
  sourceLink: boolean;
  modificationIndication: boolean;
}

/**
 * A use the licence does not cover. Every stated field must match the use for
 * the limit to apply, so an empty limit list means the profile forbids nothing.
 * All seven reviewed profiles carry an empty list; NC and ND conditions belong
 * here once their exact texts have been reviewed.
 */
export interface LicenceLimitV1 {
  /** Plain words for the person, naming the licence and the use. */
  summary: string;
  commercial?: true;
  audiences?: UseContextV1['audience'][];
  classifications?: CreativeClassificationV1[];
  roles?: CreativeUseRoleV1[];
}

/**
 * A licence a shared adaptation may carry, from the Creative Commons list of
 * BY-SA Compatible Licenses, carried here as data with the date CC approved it.
 * A name that merely looks similar is never enough.
 */
export interface CompatibleOutputLicenceV1 {
  /** The identifier a recorded decision names. */
  id: string;
  /** The licence's own name, as a remedy button should print it. */
  name: string;
  url: string;
  /** The date Creative Commons approved it, for the entries that came from the list. */
  approved?: string;
  /**
   * True when the compatibility runs one way only: an adaptation may go out
   * under it, and material under it may not come back the other way.
   */
  oneWay?: boolean;
}

/**
 * One licence's reviewed rules. `reviewed: false` means the identifier is
 * recognised and its conditions are recorded, and that no rule here interprets
 * them: no automatic pass, no automatic ban.
 */
export interface LicenceProfileV1 {
  id: string;
  /** The licence's own name, as the credit line should print it. */
  name: string;
  version?: string;
  url: string;
  reviewed: boolean;
  /** The reviewed version of THIS profile, recorded in every plan it shaped. */
  profileVersion: string;
  /** The licence elements the source declared, recorded whether or not they are interpreted. */
  conditions: string[];
  /** The obligation for a use whose role has no entry below. */
  obligation: RoleObligationV1;
  roleObligations: Partial<Record<CreativeUseRoleV1, RoleObligationV1>>;
  attribution: AttributionPartsV1;
  /** A credit is welcome and is not a condition (a dedication, a certification). */
  courtesyCredit: boolean;
  shareAlike: boolean;
  /** Licences a shared adaptation may carry. Data from the CC compatible list, never a name match. */
  compatibleOutputLicences: CompatibleOutputLicenceV1[];
  redistributeSource: 'permitted-with-notices' | 'unknown' | 'not-permitted';
  /** The licence asks for a notice text to travel with the work, and its absence is a gap. */
  noticeRequired: boolean;
  /**
   * The licence asks the licensee to retain notices the licensor SUPPLIED, and
   * asks for nothing when none was supplied. CC BY 4.0 section 3(a)(1)(A)(iv)
   * is the case: a notice referring to the disclaimer of warranties is retained
   * if the licensor supplied one. So a recorded notice travels in the credits
   * and a work that carries none raises nothing.
   */
  retainSuppliedNotices: boolean;
  limits: LicenceLimitV1[];
  /** The exact section of the legal code every rule above came from. */
  citation: string;
}

const NO_CREDIT: AttributionPartsV1 = {
  creator: false,
  title: false,
  copyrightNotice: false,
  licenceNameAndLink: false,
  sourceLink: false,
  modificationIndication: false,
};

/** The CC 4.0 attribution parts, shared by BY and BY-SA. See the citations below. */
const CC_BY_CREDIT: AttributionPartsV1 = {
  creator: true,
  title: true,
  copyrightNotice: true,
  licenceNameAndLink: true,
  sourceLink: true,
  modificationIndication: true,
};

/**
 * The reviewed profiles. Each rule below carries the section of the primary
 * text it came from; none of it is a legal determination, and none of it was
 * derived from a licence summary page.
 */
const REVIEWED: LicenceProfileV1[] = [
  {
    // CC BY 4.0 legal code, https://creativecommons.org/licenses/by/4.0/legalcode.en
    // Section 3(a)(1)(A) asks the licensee to retain, if supplied: the creator
    // identification, a copyright notice, a notice referring to the licence, a
    // notice referring to the warranty disclaimer and a URI for the material.
    // Section 3(a)(1)(B) asks for an indication that the material was modified,
    // keeping any earlier indication. Section 3(a)(1)(C) asks for an indication
    // that the material is licensed under this licence, with its text or a link.
    // Section 2(a)(1) permits reproduction and adapted material for any
    // purpose, commercial included, so this profile forbids no use.
    id: 'CC-BY-4.0',
    name: 'CC BY 4.0',
    version: '4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    reviewed: true,
    profileVersion: 'cc-by-4.0-2026-09-13',
    conditions: ['Attribution'],
    obligation: 'attribution',
    roleObligations: {},
    attribution: CC_BY_CREDIT,
    courtesyCredit: false,
    shareAlike: false,
    compatibleOutputLicences: [],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: false,
    retainSuppliedNotices: true,
    limits: [],
    citation: 'CC BY 4.0 legal code, sections 2(a)(1) and 3(a)',
  },
  {
    // CC BY-SA 4.0 legal code, https://creativecommons.org/licenses/by-sa/4.0/legalcode.en
    // Section 3(a) repeats BY's attribution conditions. Section 3(b)(1) adds
    // ShareAlike: an adapter's licence must be a Creative Commons licence with
    // the same elements, this version or later, or a BY-SA compatible licence
    // from the list at https://creativecommons.org/compatible-licenses/.
    // Section 3(b) applies when Adapted Material is SHARED, so a private
    // adaptation carries no ShareAlike step, which the evaluator honours by
    // raising nothing when the audience is private.
    // 4.0 is the latest BY-SA version, so a later CC BY-SA version adds no entry
    // yet. The published list of BY-SA Compatible Licenses names two further
    // licences, and both are carried below: the Free Art License 1.3, approved
    // on 2014-10-21, and the GNU General Public License version 3, approved on
    // 2015-10-08, whose compatibility with BY-SA runs one way only.
    id: 'CC-BY-SA-4.0',
    name: 'CC BY-SA 4.0',
    version: '4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    reviewed: true,
    profileVersion: 'cc-by-sa-4.0-2026-09-13.2',
    conditions: ['Attribution', 'ShareAlike'],
    obligation: 'attribution',
    roleObligations: {},
    attribution: CC_BY_CREDIT,
    courtesyCredit: false,
    shareAlike: true,
    compatibleOutputLicences: [
      { id: 'CC-BY-SA-4.0', name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      { id: 'FAL-1.3', name: 'Free Art License 1.3', url: 'https://artlibre.org/licence/lal/en/', approved: '2014-10-21' },
      { id: 'GPL-3.0-or-later', name: 'GNU General Public License v3 or later', url: 'https://www.gnu.org/licenses/gpl-3.0.html', approved: '2015-10-08', oneWay: true },
    ],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: false,
    retainSuppliedNotices: true,
    limits: [],
    citation: 'CC BY-SA 4.0 legal code, sections 3(a) and 3(b); the CC compatible-licences list',
  },
  {
    // CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/legalcode.en
    // Section 2 waives every copyright and related right the affirmer holds,
    // "without any conditions". Section 3 is the fallback licence, also with no
    // conditions attached. The CC FAQ on CC0 says attribution is not required
    // and asks that a credit be given where practical, which is a courtesy and
    // not a condition, so this profile asks nothing and offers a credit line.
    id: 'CC0-1.0',
    name: 'CC0 1.0',
    version: '1.0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    reviewed: true,
    profileVersion: 'cc0-1.0-2026-09-13',
    conditions: [],
    obligation: 'none',
    roleObligations: {},
    attribution: NO_CREDIT,
    courtesyCredit: true,
    shareAlike: false,
    compatibleOutputLicences: [],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: false,
    retainSuppliedNotices: false,
    limits: [],
    citation: 'CC0 1.0 Universal, sections 2 and 3; the CC FAQ on crediting CC0 material',
  },
  {
    // Creative Commons Public Domain Dedication and Certification,
    // https://creativecommons.org/licenses/publicdomain/ (SPDX id CC-PDDC).
    // The dedicator either dedicates the work to the public domain or certifies
    // that it is already there. Neither adds a condition, so the profile asks
    // nothing. What matters is the assertion itself: who dedicated or certified
    // the work, which the evidence record keeps beside the identifier. A
    // certification is one party's statement, not proof of public-domain status.
    id: 'CC-PDDC',
    name: 'Creative Commons Public Domain Dedication and Certification',
    url: 'https://creativecommons.org/licenses/publicdomain/',
    reviewed: true,
    profileVersion: 'cc-pddc-2026-09-13',
    conditions: [],
    obligation: 'none',
    roleObligations: {},
    attribution: NO_CREDIT,
    courtesyCredit: true,
    shareAlike: false,
    compatibleOutputLicences: [],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: false,
    retainSuppliedNotices: false,
    limits: [],
    citation: 'Creative Commons Public Domain Dedication and Certification, the dedication and certification paragraphs',
  },
  {
    // Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0
    // Section 4 lets a licensee redistribute the work or derivative works on
    // four conditions: give recipients a copy of the licence (4.1), mark
    // changed files (4.2), keep the copyright, patent, trademark and
    // attribution notices from the source (4.3), and carry the NOTICE file's
    // attribution text in the distributed derivative work (4.4). A rendered
    // composition that carries the artwork is such a distribution, so the
    // NOTICE text is a required notice, delivered in the credential and in the
    // readable credits. Section 4.4's last paragraph allows the notice to sit
    // alongside the work, which is what a companion credits file does.
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    version: '2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
    reviewed: true,
    profileVersion: 'apache-2.0-2026-09-13',
    conditions: ['Attribution', 'NoticeRetention'],
    obligation: 'attribution',
    roleObligations: { runtime: 'none' },
    attribution: {
      creator: true,
      title: true,
      copyrightNotice: true,
      licenceNameAndLink: true,
      sourceLink: true,
      modificationIndication: true,
    },
    courtesyCredit: false,
    shareAlike: false,
    compatibleOutputLicences: [],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: true,
    retainSuppliedNotices: true,
    limits: [],
    citation: 'Apache License 2.0, section 4 (1 to 4)',
  },
  {
    // MIT, https://opensource.org/license/mit
    // One condition: "The above copyright notice and this permission notice
    // shall be included in all copies or substantial portions of the Software."
    // So a distributed copy or substantial portion carries the copyright line
    // and the permission text, which is a notice rather than a credit line with
    // a source link. A runtime use distributes nothing, so it asks nothing.
    id: 'MIT',
    name: 'MIT License',
    url: 'https://opensource.org/license/mit',
    reviewed: true,
    profileVersion: 'mit-2026-09-13',
    conditions: ['NoticeRetention'],
    obligation: 'notice',
    roleObligations: { runtime: 'none', reference: 'none' },
    attribution: {
      creator: true,
      title: false,
      copyrightNotice: true,
      licenceNameAndLink: true,
      sourceLink: false,
      modificationIndication: false,
    },
    courtesyCredit: false,
    shareAlike: false,
    compatibleOutputLicences: [],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: true,
    retainSuppliedNotices: true,
    limits: [],
    citation: 'MIT License, the permission-notice condition',
  },
  {
    // SIL Open Font License 1.1,
    // https://openfontlicense.org/open-font-license-official-text/
    // The permission block covers the FONT SOFTWARE. Condition 2 asks that a
    // redistributed copy, on its own or in a bundle, carry the licence and the
    // copyright notice. Condition 3 is the Reserved Font Name rule. Condition 5
    // says the font software may not be released under another licence. The OFL
    // FAQ (question 1.4 and the "documents" entries) states that documents
    // rendered with the font are not affected by the licence, so a runtime use
    // asks nothing of the text, and only a use that redistributes the font
    // bytes carries the notice.
    id: 'OFL-1.1',
    name: 'SIL Open Font License 1.1',
    version: '1.1',
    url: 'https://openfontlicense.org/open-font-license-official-text/',
    reviewed: true,
    profileVersion: 'ofl-1.1-2026-09-13',
    conditions: ['NoticeRetention', 'ReservedFontName'],
    obligation: 'none',
    roleObligations: { 'source-distribution': 'notice' },
    attribution: {
      creator: true,
      title: true,
      copyrightNotice: true,
      licenceNameAndLink: true,
      sourceLink: false,
      modificationIndication: false,
    },
    courtesyCredit: false,
    shareAlike: false,
    compatibleOutputLicences: [],
    redistributeSource: 'permitted-with-notices',
    noticeRequired: true,
    retainSuppliedNotices: true,
    limits: [],
    citation: 'SIL Open Font License 1.1, conditions 2, 3 and 5; the OFL FAQ on documents',
  },
];

/**
 * Recognised, not interpreted. The NonCommercial and NoDerivatives conditions
 * need their exact combined texts reviewed before any rule reads them, and a
 * commercial context cannot be inferred from a price or an account, so these
 * entries record the conditions and the evaluator reports them as unknown. No
 * automatic pass, no automatic ban.
 */
const RECOGNISED: { id: string; name: string; url: string; conditions: string[] }[] = [
  { id: 'CC-BY-NC-4.0', name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/', conditions: ['Attribution', 'NonCommercial'] },
  { id: 'CC-BY-ND-4.0', name: 'CC BY-ND 4.0', url: 'https://creativecommons.org/licenses/by-nd/4.0/', conditions: ['Attribution', 'NoDerivatives'] },
  { id: 'CC-BY-NC-SA-4.0', name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', conditions: ['Attribution', 'NonCommercial', 'ShareAlike'] },
  { id: 'CC-BY-NC-ND-4.0', name: 'CC BY-NC-ND 4.0', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', conditions: ['Attribution', 'NonCommercial', 'NoDerivatives'] },
];

function recognisedProfile(entry: { id: string; name: string; url: string; conditions: string[] }): LicenceProfileV1 {
  return {
    id: entry.id,
    name: entry.name,
    version: /(\d+\.\d+)$/.exec(entry.id)?.[1],
    url: entry.url,
    reviewed: false,
    profileVersion: 'recorded-not-interpreted-2026-09-13',
    conditions: entry.conditions,
    obligation: 'none',
    roleObligations: {},
    attribution: NO_CREDIT,
    courtesyCredit: false,
    shareAlike: entry.conditions.includes('ShareAlike'),
    compatibleOutputLicences: [],
    redistributeSource: 'unknown',
    noticeRequired: false,
    retainSuppliedNotices: false,
    limits: [],
    citation: 'conditions recorded from the identifier; the exact text is not yet reviewed',
  };
}

const PROFILES = new Map<string, LicenceProfileV1>();
for (const profile of REVIEWED) PROFILES.set(profile.id, profile);
for (const entry of RECOGNISED) PROFILES.set(entry.id, recognisedProfile(entry));

/** Every profile this rules version carries, reviewed and recognised alike, sorted by id. */
export function licenceProfiles(): LicenceProfileV1[] {
  return [...PROFILES.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The profile for a canonical identifier, or null when this rules version
 * carries none. `extra` lets a caller supply further reviewed profiles (a
 * profile pack, or a test's synthetic licence); an extra profile shadows a
 * built-in one of the same id, and every extra id and version goes into the
 * evaluation fingerprint so a swapped rule set is a different evaluation.
 */
export function licenceProfile(id: string | null, extra: readonly LicenceProfileV1[] = []): LicenceProfileV1 | null {
  if (!id) return null;
  for (let i = extra.length - 1; i >= 0; i--) if (extra[i]!.id === id) return extra[i]!;
  return PROFILES.get(id) ?? null;
}

/** The obligation a profile puts on one role. */
export function roleObligation(profile: LicenceProfileV1, role: CreativeUseRoleV1): RoleObligationV1 {
  return profile.roleObligations[role] ?? profile.obligation;
}

/**
 * The readable name for a canonical identifier: the profile's own name, else
 * the name a compatible-licence entry carries, else the identifier itself. One
 * spelling for every surface, so a credit copied from the export panel and the
 * same credit read back out of a file are the same string.
 */
export function licenceDisplayName(id: string, extra: readonly LicenceProfileV1[] = []): string {
  const profile = licenceProfile(id, extra);
  if (profile) return profile.name;
  for (const candidate of [...extra, ...PROFILES.values()]) {
    const entry = candidate.compatibleOutputLicences.find((item) => item.id === id);
    if (entry) return entry.name;
  }
  return id;
}

/**
 * The licences a person can declare for their OWN export, in the order the export
 * panel lists them. No entry means no declaration (all rights reserved), which is
 * also what an unknown id reads as. NC and ND variants are offered because people
 * choose them for their work; declaring one writes the notice and nothing else,
 * since the evaluator does not interpret those conditions (see RECOGNISED).
 * Public Domain Mark is for a work already free of known copyright; CC0 is the
 * dedication an author makes for their own work.
 */
export const OUTPUT_LICENCE_CHOICES: readonly { id: string; name: string; url: string }[] = [
  { id: 'CC0-1.0', name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { id: 'CC-PDM-1.0', name: 'Public Domain Mark 1.0', url: 'https://creativecommons.org/publicdomain/mark/1.0/' },
  { id: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { id: 'CC-BY-SA-4.0', name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id: 'CC-BY-NC-4.0', name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  { id: 'CC-BY-NC-SA-4.0', name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  { id: 'CC-BY-ND-4.0', name: 'CC BY-ND 4.0', url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  { id: 'CC-BY-NC-ND-4.0', name: 'CC BY-NC-ND 4.0', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
];

/** The declared-licence id off untrusted input (a link, a saved session), or null. */
export function outputLicenceId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return OUTPUT_LICENCE_CHOICES.some((c) => c.id === value) ? value : null;
}

/** The notice a metadata licence field carries, `CC BY 4.0 (https://…)`, or '' for none. */
export function outputLicenceNotice(id: string | null | undefined): string {
  const choice = OUTPUT_LICENCE_CHOICES.find((c) => c.id === id);
  return choice ? `${choice.name} (${choice.url})` : '';
}

const LOCATOR_MAX = 2048;

/**
 * The one rule for a locator a credit may print. A source url and a licence url
 * travel into readable credits, a terminal, a clipboard and an MCP result, and
 * they arrive from a catalog entry, a pack manifest or a stranger's credential.
 * Only an ordinary public http(s) address survives: anything else (a
 * `javascript:` url, a `file:///` path, an address carrying a password, an
 * over-long string) comes back empty and the credit prints without it rather
 * than handing a person something to click.
 */
export function publicLocator(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > LOCATOR_MAX || !/^https?:\/\//i.test(text)) return '';
  if (/[\s<>"]/.test(text)) return '';
  let url: URL;
  try { url = new URL(text); } catch { return ''; }
  if (url.username || url.password) return '';
  return text;
}

/**
 * Every spelling of a licence found in this tree and the ones its catalogs and
 * packs are likely to carry next, mapped to one canonical identifier. The key
 * is the declaration lowercased with its runs of whitespace collapsed; the
 * declaration itself is never rewritten, only recorded beside the identifier.
 *
 * A Map, not an object, because declarations arrive from a catalog index, a
 * pack manifest and a stranger's credential: a declaration of `constructor` or
 * `__proto__` must miss, and on a plain object it would hit the prototype and
 * hand back a function as the licence id.
 */
const ALIASES = new Map<string, string>(Object.entries({
  'cc-by-4.0': 'CC-BY-4.0',
  'cc by 4.0': 'CC-BY-4.0',
  'cc by-4.0': 'CC-BY-4.0',
  'cc_by_4.0': 'CC-BY-4.0',
  'creative commons attribution 4.0': 'CC-BY-4.0',
  'cc-by-sa-4.0': 'CC-BY-SA-4.0',
  'cc by-sa 4.0': 'CC-BY-SA-4.0',
  'cc by sa 4.0': 'CC-BY-SA-4.0',
  'creative commons attribution-sharealike 4.0': 'CC-BY-SA-4.0',
  'cc-by-nc-4.0': 'CC-BY-NC-4.0',
  'cc by-nc 4.0': 'CC-BY-NC-4.0',
  'cc-by-nd-4.0': 'CC-BY-ND-4.0',
  'cc by-nd 4.0': 'CC-BY-ND-4.0',
  'cc-by-nc-sa-4.0': 'CC-BY-NC-SA-4.0',
  'cc by-nc-sa 4.0': 'CC-BY-NC-SA-4.0',
  'cc-by-nc-nd-4.0': 'CC-BY-NC-ND-4.0',
  'cc by-nc-nd 4.0': 'CC-BY-NC-ND-4.0',
  'cc0-1.0': 'CC0-1.0',
  'cc0 1.0': 'CC0-1.0',
  cc0: 'CC0-1.0',
  'cc zero': 'CC0-1.0',
  'creative commons zero': 'CC0-1.0',
  'cc-pddc': 'CC-PDDC',
  'cc pddc': 'CC-PDDC',
  'apache-2.0': 'Apache-2.0',
  'apache 2.0': 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'apache-2': 'Apache-2.0',
  mit: 'MIT',
  'mit license': 'MIT',
  'ofl-1.1': 'OFL-1.1',
  'ofl 1.1': 'OFL-1.1',
  ofl: 'OFL-1.1',
  'sil ofl 1.1': 'OFL-1.1',
  'sil open font license 1.1': 'OFL-1.1',
}));

/** A licence identifier read from a declaration, with the declaration kept beside it. */
export interface NormalisedLicenceV1 {
  /** The canonical identifier, or null when nothing recognised the declaration. */
  id: string | null;
  /** The version part of the identifier, when the family carries one. */
  version?: string;
  /** The public URL of the licence or dedication text. */
  url?: string;
  /** True only when a reviewed profile in this file covers the identifier. */
  reviewed: boolean;
  /** The declaration exactly as supplied. */
  original: string;
  /** Present only when nothing recognised the declaration. */
  status?: 'unparsed';
}

const CC_FAMILY = /^cc[ _-]?(by(?:[ _-]nc)?(?:[ _-](?:sa|nd))?)[ _-]?(\d+\.\d+)$/i;
const CC_ZERO = /^cc[ _-]?0[ _-]?(\d+\.\d+)$/i;
const LICENSE_REF = /^licenseref-[A-Za-z0-9.+-]+$/i;

const ccUrl = (elements: string, version: string): string =>
  `https://creativecommons.org/licenses/${elements.toLowerCase()}/${version}/`;

/**
 * A licence declaration to a canonical identifier. `LicenseRef-*` is a pointer
 * to a stored definition and comes back as itself: recognised data, never
 * proprietary by declaration and never an error. A declaration nothing
 * recognises comes back with `id: null` and `status: 'unparsed'`, which is a
 * gap to fill and not a grant.
 */
export function normaliseLicence(text: string, extra: readonly LicenceProfileV1[] = []): NormalisedLicenceV1 {
  const original = text;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { id: null, original, reviewed: false, status: 'unparsed' };

  const supplied = extra.find((profile) => profile.id === trimmed);
  if (supplied) {
    const out: NormalisedLicenceV1 = { id: supplied.id, url: supplied.url, reviewed: supplied.reviewed, original };
    if (supplied.version) out.version = supplied.version;
    return out;
  }

  const alias = ALIASES.get(trimmed.toLowerCase());
  if (alias) return described(alias, original);

  if (PROFILES.has(trimmed)) return described(trimmed, original);

  const family = CC_FAMILY.exec(trimmed);
  if (family) {
    const elements = family[1]!.replace(/[ _]/g, '-').toLowerCase();
    const version = family[2]!;
    const id = `CC-${elements.toUpperCase()}-${version}`;
    const known = PROFILES.get(id);
    // A version this rules set has not reviewed keeps its own version. CC BY 3.0
    // is never reported as CC BY 4.0 because the app's chooser prefers 4.0.
    return known
      ? described(id, original)
      : { id, version, url: ccUrl(elements, version), reviewed: false, original };
  }

  const zero = CC_ZERO.exec(trimmed);
  if (zero) {
    const id = `CC0-${zero[1]!}`;
    return PROFILES.has(id)
      ? described(id, original)
      : { id, version: zero[1]!, url: `https://creativecommons.org/publicdomain/zero/${zero[1]!}/`, reviewed: false, original };
  }

  if (LICENSE_REF.test(trimmed)) return { id: trimmed, reviewed: false, original };

  return { id: null, original, reviewed: false, status: 'unparsed' };
}

function described(id: string, original: string): NormalisedLicenceV1 {
  const profile = PROFILES.get(id);
  if (!profile) return { id, reviewed: false, original };
  const out: NormalisedLicenceV1 = { id, url: profile.url, reviewed: profile.reviewed, original };
  if (profile.version) out.version = profile.version;
  return out;
}

/** How the identifiers in a declaration relate to each other. */
export type LicenceOperatorV1 = 'single' | 'or' | 'and';

export interface LicenceExpressionV1 {
  /** The declaration exactly as supplied. */
  original: string;
  operator: LicenceOperatorV1;
  /** Every identifier in the expression, in written order. */
  terms: NormalisedLicenceV1[];
  /** An `OR` is a choice the rights holder offered; this reader never picks one. */
  selected: null;
}

/**
 * A minimal reader for the SPDX expression forms a creative declaration uses:
 * `A OR B` offers a choice of grant, so every alternative comes back and none
 * is selected, and `A AND B` is cumulative, so every term applies. Anything
 * else, including a parenthesised or mixed expression, is read as one
 * identifier and normalises on its own, which leaves it unparsed rather than
 * flattened into a "most restrictive" label.
 */
export function readLicenceExpression(text: string, extra: readonly LicenceProfileV1[] = []): LicenceExpressionV1 {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const hasOr = / OR /i.test(trimmed);
  const hasAnd = / AND /i.test(trimmed);
  const simple = !trimmed.includes('(') && !trimmed.includes(')') && hasOr !== hasAnd;
  const one = (): LicenceExpressionV1 => ({ original: text, operator: 'single', terms: [normaliseLicence(text, extra)], selected: null });
  if (!simple) return one();
  const parts = trimmed.split(hasOr ? / OR /i : / AND /i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return one();
  return { original: text, operator: hasOr ? 'or' : 'and', terms: parts.map((part) => normaliseLicence(part, extra)), selected: null };
}
