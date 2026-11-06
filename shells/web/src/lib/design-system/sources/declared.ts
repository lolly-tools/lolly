// SPDX-License-Identifier: MPL-2.0
/**
 * A source that states its design system outright: a `DESIGN.md`, or a brand page
 * folder. Both read here into one proposal for the Try these colours review, and
 * nothing is applied until the person presses Apply there.
 *
 * Everything in these files is someone else's data. The prose is kept as text for
 * the person to read, and goes no further than a draft skill marked internal unless
 * they change that. A folder is checked against its own `brand.json` first, so a file
 * that changed after the page was built refuses the whole folder rather than
 * quietly becoming part of a design system.
 */
import type { BrandPageFileV1, BrandPageV1 } from '@lolly-tools/core/brand-page-v1';
import { isAgentSkillName } from '@lolly-tools/core/skill-frontmatter-v1';
import type { BrandSkillMetaV1 } from '@lolly-tools/core/brand-skill-v1';
import { brandPageDigest } from '../../../../../../engine/src/brand-page.ts';
import { bytesToHex, sha256 } from '../../../../../../engine/src/bytes.ts';
import { parseDesignMd } from '../../../../../../engine/src/design-md.ts';
import { brandSkillScopeHints, coerceTokensDoc } from '@lolly/engine';

/** A `DESIGN.md` is hand-written text. */
export const DESIGN_MD_MAX_BYTES = 2 * 1024 * 1024;
/** How many files a brand page folder may hold, and how many bytes they may sum to. */
export const PAGE_FOLDER_MAX_FILES = 2000;
export const PAGE_FOLDER_MAX_BYTES = 256 * 1024 * 1024;

export interface DeclaredDraftSkill {
  name: string;
  label: string;
  description: string;
  markdown: string;
}

export interface DeclaredSource {
  method: 'design-md' | 'brand-page';
  /** The file or folder name. */
  label: string;
  /** The name the source states, when it states one. */
  name: string | null;
  doc: Record<string, unknown>;
  /** What could not be taken as written, in the engine's words. */
  findings: string[];
  /** The source's own words, or empty. */
  prose: string;
  /** The prose as a skill, ready to keep. Null when there is no prose. */
  draftSkill: DeclaredDraftSkill | null;
  /** A brand page's usage statement and contact, in its publisher's words. */
  usage: { statement?: string; contact?: string } | null;
  /** How many logos and fonts a folder carries, which this path does not add. */
  files: { logos: number; fonts: number };
}

export type DeclaredRead = { ok: true; source: DeclaredSource } | { ok: false; reason: 'too-large' | 'not-design-md' | 'no-tokens' | 'not-a-page' | 'digest' | 'unsafe-path'; detail?: string };

const FOLDER_REFUSALS = new Set(['not-a-page', 'digest', 'unsafe-path']);
export const isFolderRefusal = (reason: string): boolean => FOLDER_REFUSALS.has(reason);

const kebab = (text: string): string => text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');

/**
 * The source's words as a skill record's body. The front matter is ours and the
 * words are theirs, so a heading and the description say where they came from. The
 * record's status says nobody has kept them yet.
 */
export function draftSkillOf(prose: string, stated: string): DeclaredDraftSkill | null {
  const body = prose.trim();
  if (!body) return null;
  // The record's own words stay ours: a file's name can say anything.
  const title = brandSkillScopeHints(stated).length ? 'Imported source' : stated;
  const slug = kebab(title);
  const name = isAgentSkillName(`${slug}-notes`) ? `${slug}-notes` : 'imported-notes';
  const label = `${title.trim().slice(0, 80)} notes`;
  const description = `Notes that came with ${title.trim().slice(0, 120)}.`;
  const markdown = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n# ${label.replace(/[\r\n]+/g, ' ')}\n\n${body}\n`;
  return { name, label, description, markdown };
}

/** The record a draft skill is stored with: internal and unapproved, so it never publishes by itself. */
export function draftSkillMeta(draft: DeclaredDraftSkill): BrandSkillMetaV1 {
  return { name: draft.name, description: draft.description, discipline: 'brand', audience: 'internal', status: 'draft', skillRevision: '1' };
}

/** Read a `DESIGN.md`. It refuses rather than guesses, so a refusal keeps the parser's own reason. */
export function readDesignMdSource(text: string, label: string): DeclaredRead {
  const parsed = parseDesignMd(text);
  if (!parsed.ok) return { ok: false, reason: 'not-design-md', detail: parsed.reason };
  const { proposal } = parsed;
  const extraction = coerceTokensDoc(proposal.tokens);
  if (!extraction.doc) return { ok: false, reason: 'no-tokens', ...(extraction.warnings[0] ? { detail: extraction.warnings[0] } : {}) };
  const name = proposal.name?.trim() || null;
  return {
    ok: true,
    source: {
      method: 'design-md', label, name,
      doc: extraction.doc as Record<string, unknown>,
      findings: [...proposal.findings.filter(f => f.severity !== 'info').map(f => f.message), ...extraction.warnings],
      prose: proposal.prose,
      draftSkill: draftSkillOf(proposal.prose, name ?? label.replace(/\.[^.]+$/, '')),
      usage: null,
      files: { logos: 0, fonts: 0 },
    },
  };
}

/** A manifest path that stays inside the folder. A bare name or `a/b.svg`, never `..`. */
const safePath = (path: unknown): path is string =>
  typeof path === 'string' && path.length > 0 && path.length < 512 && !path.startsWith('/') && !path.includes('\\')
  && path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');

/** A picked or zipped folder keeps its own name on every path. Take that top level off. */
export function pageFolderFiles(files: Readonly<Record<string, Uint8Array>>): Record<string, Uint8Array> | null {
  const real = Object.entries(files).filter(([path]) => !path.endsWith('/') && !path.includes('__MACOSX/') && !/(^|\/)\.DS_Store$/.test(path));
  const manifest = real.map(([path]) => path).filter(path => /(^|\/)brand\.json$/.test(path)).sort((a, b) => a.length - b.length)[0];
  if (!manifest) return null;
  const prefix = manifest.slice(0, -'brand.json'.length);
  return Object.fromEntries(real.filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
}

const hexOf = async (bytes: Uint8Array): Promise<string> => bytesToHex(await sha256(bytes));

/**
 * Read a brand page folder. Every file its manifest lists must be present with the
 * size and digest the manifest states. A file the manifest does not list is ignored,
 * so a stray file cannot join the design system.
 */
export async function readBrandPageFolder(input: Readonly<Record<string, Uint8Array>>, label: string): Promise<DeclaredRead> {
  const files = pageFolderFiles(input);
  if (!files) return { ok: false, reason: 'not-a-page' };
  const paths = Object.keys(files);
  if (paths.length > PAGE_FOLDER_MAX_FILES || paths.reduce((sum, path) => sum + files[path]!.length, 0) > PAGE_FOLDER_MAX_BYTES) return { ok: false, reason: 'too-large' };
  let manifest: BrandPageV1;
  try { manifest = JSON.parse(new TextDecoder().decode(files['brand.json'])) as BrandPageV1; }
  catch { return { ok: false, reason: 'not-a-page' }; }
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files) || typeof manifest.version !== 'number') return { ok: false, reason: 'not-a-page' };

  // The manifest's own digest first: a list that changed proves nothing about the files.
  if (await brandPageDigest(manifest).catch(() => null) !== manifest.digest) return { ok: false, reason: 'digest', detail: 'brand.json' };
  const listed: BrandPageFileV1[] = manifest.files;
  for (const entry of listed) {
    if (!safePath(entry?.path)) return { ok: false, reason: 'unsafe-path', detail: String(entry?.path ?? '') };
    const bytes = Object.hasOwn(files, entry.path) ? files[entry.path] : undefined;
    if (!bytes || bytes.length !== entry.size || (await hexOf(bytes)) !== String(entry.sha256).replace(/^sha256:/, '')) {
      return { ok: false, reason: 'digest', detail: entry.path };
    }
  }
  const tokens = listed.find(entry => entry.path === 'tokens/tokens.json');
  if (!tokens) return { ok: false, reason: 'no-tokens' };
  let parsedTokens: unknown;
  try { parsedTokens = JSON.parse(new TextDecoder().decode(files[tokens.path])); }
  catch { return { ok: false, reason: 'no-tokens' }; }
  const extraction = coerceTokensDoc(parsedTokens);
  if (!extraction.doc) return { ok: false, reason: 'no-tokens', ...(extraction.warnings[0] ? { detail: extraction.warnings[0] } : {}) };

  // The page's overview, from the DESIGN.md it was built with. Its tokens came from the file above.
  const designMd = listed.find(entry => entry.path === 'DESIGN.md');
  const parsed = designMd ? parseDesignMd(new TextDecoder().decode(files[designMd.path])) : null;
  const prose = parsed?.ok ? parsed.proposal.prose : '';
  const stated = typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim().slice(0, 120) : null;
  const name = stated && !brandSkillScopeHints(stated).length ? stated : null;
  const doc = { ...(extraction.doc as Record<string, unknown>) };
  const findings = [...extraction.warnings];
  const usage = manifest.usage && typeof manifest.usage === 'object' ? {
    ...(typeof manifest.usage.statement === 'string' && manifest.usage.statement.trim() ? { statement: manifest.usage.statement.slice(0, 4000) } : {}),
    ...(typeof manifest.usage.contact === 'string' && manifest.usage.contact.trim() ? { contact: manifest.usage.contact.slice(0, 300) } : {}),
  } : null;
  return {
    ok: true,
    source: {
      method: 'brand-page', label, name, doc, findings,
      prose,
      draftSkill: draftSkillOf(prose, name ?? label),
      usage: usage && Object.keys(usage).length ? usage : null,
      files: {
        logos: listed.filter(entry => entry.path.startsWith('logos/')).length,
        fonts: listed.filter(entry => entry.path.startsWith('fonts/')).length,
      },
    },
  };
}
