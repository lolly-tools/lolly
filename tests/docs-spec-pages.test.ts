/**
 * The document model specification as its own web document (plan 276, stage 1).
 *
 * The chapters in `docs/spec/document-model/` are built by `docs/spec-pages.ts`,
 * not by the page registry, so nothing else in the docs suite looks at them. This
 * suite is what does: it builds every chapter through the real renderer and then
 * checks the things a draft specification can get wrong quietly.
 *
 *  - Every chapter renders, and every heading carries a unique id, because the
 *    in-app browser deep-links to headings by id and `index.json` promises them.
 *  - Every repository path a chapter cites in backticks exists on disk. A
 *    specification that cites a file which moved is worse than one that cites
 *    nothing: a reader checks the citation, finds nothing, and stops trusting
 *    the rest. Paths that a public clone does not hold are listed with their reason.
 *  - "Profile" keeps the three meanings the tree already gave it (content profile,
 *    colour profile, user profile). The plan's own review found the word carrying
 *    five meanings across thirty uses, and fixed the vocabulary instead.
 *  - Every picture is a diagram that exists under `docs/diagrams/`.
 *  - Every chapter opens with the draft notice, so no chapter can be read as
 *    settled by someone who arrived at it from a search engine.
 *
 * Run: node --test tests/docs-spec-pages.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToHtml, type DocsRenderContext } from '../packages/docs-render/src/index.ts';
import {
  buildSpecPages,
  chapterSlug,
  headingsOf,
  readSpecChapters,
  SPEC_BASE,
  SPEC_HOME_HREF,
  SPEC_INDEX_FILE,
  SPEC_TWIN_FILE,
  type SpecIndex,
  type SpecWrapPage,
} from '../docs/spec-pages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chapters = readSpecChapters();
/** The chapters land in parallel with this suite; an empty directory skips by name. */
const skip = chapters.length ? false : 'docs/spec/document-model holds no chapters yet';

/**
 * A DocsRenderContext with nothing behind it. The chapters use no screenshots, no
 * banked art and no credentials - they are prose, tables, code blocks and diagram
 * images - so every resolver here answers "nothing", and what is exercised is the
 * block renderer itself: the same `mdToHtml` the site and the in-app docs view run.
 */
const ctx: DocsRenderContext = {
  lang: 'en',
  htmlLang: 'en',
  t: (s) => s,
  docIcon: () => '',
  docLogo: () => '',
  docLogoBlock: () => '',
  nextCredId: (() => { let n = 0; return () => `shot-cred-${++n}`; })(),
  localizedShot: () => null,
  darkShot: () => null,
  shotSize: () => null,
  credential: () => null,
  tryLink: () => null,
  showcase: () => null,
  art: () => null,
};

/** Every page the builder wrapped, keyed by chapter slug, for the rail checks. */
const wrapped = new Map<string, SpecWrapPage>();

const built = chapters.length
  ? buildSpecPages({
      render: (md) => mdToHtml(md, ctx),
      // The page chrome is docs/build.ts's own `wrapPage`; this suite checks the
      // document, not the chrome, so the wrapper here is the identity. The page it
      // is handed is kept: the rail is the builder's, not the chrome's.
      wrap: (page, content) => { wrapped.set(page.slug, page); return content; },
    })
  : {};

/** Fenced code out, then inline code out. What is left is prose. */
function prose(md: string): string {
  return md.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, ' ');
}

/** Every inline code span in a chapter, fenced blocks excluded. */
function codeSpans(md: string): string[] {
  const stripped = md.replace(/^```[\s\S]*?^```/gm, '');
  return [...stripped.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!.trim());
}

/**
 * Repository paths a chapter cites that a public clone does not hold, each with
 * the reason it cannot be checked here. Everything else must exist.
 */
const UNCHECKABLE: ReadonlyArray<{ prefix: string; why: string }> = [
  { prefix: 'plans/', why: 'plans/ is gitignored and local to the maintainer' },
  { prefix: 'brands/suse/', why: 'the SUSE brand pack is a private submodule, absent from a public clone' },
  { prefix: 'lolly-work/', why: 'Lolly Work is a separate repository' },
  // Chapter 7 cites Lolly Work the way that repository refers to its own files, and
  // says so in prose and again under Precedents. This tree has services/, not
  // server/, so the prefix cannot collide with a path that should have been checked.
  { prefix: 'server/src/', why: 'a path relative to the Lolly Work checkout, which is a separate repository' },
  { prefix: 'node_modules/', why: 'installed dependencies, not source' },
];

/** Does this code span read as a repository path, rather than a type or a command? */
function looksLikePath(span: string): boolean {
  if (/\s/.test(span)) return false;                 // a command line, not a path
  if (!span.includes('/')) return false;             // a bare identifier
  if (/^[a-z]+:\/\//.test(span) || span.startsWith('//')) return false; // a URL
  if (span.startsWith('/') || span.startsWith('~')) return false;       // a served or absolute path
  if (/[<>{}*?|]/.test(span)) return false;          // a placeholder or a glob
  if (span.startsWith('#') || span.startsWith('@')) return false;       // a route or a package name
  return /\/[\w.-]+\.[a-z0-9]{1,6}$/.test(span);     // ends in a filename with an extension
}

test('every chapter builds, and every chapter file has a page', { skip }, () => {
  for (const c of chapters) {
    const key = `${SPEC_BASE}/${c.slug}.html`;
    assert.ok(built[key], `${c.file} produced no page at ${key}`);
    assert.ok(built[key]!.length > 500, `${c.file} rendered to almost nothing`);
    assert.ok(c.title.length > 2, `${c.file} has no H1 to take a title from`);
    assert.equal(c.slug, chapterSlug(c.file));
  }
  assert.ok(built[`${SPEC_BASE}/${SPEC_INDEX_FILE}`], 'no index.json was built');
  assert.ok(built[`${SPEC_BASE}/${SPEC_TWIN_FILE}`], 'no concatenated markdown was built');
});

test('every heading carries an id, and no id repeats inside a chapter', { skip }, () => {
  for (const c of chapters) {
    const html = built[`${SPEC_BASE}/${c.slug}.html`]!;
    const opened = [...html.matchAll(/<h([1-4])(\s[^>]*)?>/g)];
    const missing = opened.filter((m) => !/\bid="[^"]+"/.test(m[2] ?? ''));
    assert.deepStrictEqual(missing.map((m) => m[0]), [], `${c.file} has a heading with no id`);

    const headings = headingsOf(html);
    assert.ok(headings.length > 0, `${c.file} has no H2 - a chapter needs sections to link to`);
    const seen = new Set<string>();
    const repeated: string[] = [];
    for (const h of headings) {
      if (seen.has(h.id)) repeated.push(h.id);
      seen.add(h.id);
    }
    assert.deepStrictEqual(repeated, [], `${c.file} repeats a heading id, so a deep link is ambiguous`);
    for (const h of headings) assert.ok(h.text.length > 0, `${c.file} has an empty heading at #${h.id}`);
  }
});

test('index.json lists every chapter in order, with its headings', { skip }, () => {
  const index = JSON.parse(built[`${SPEC_BASE}/${SPEC_INDEX_FILE}`]!) as SpecIndex;
  assert.match(index.version, /^draft-\d{4}-\d{2}-\d{2}$/);
  assert.match(index.updatedAt, /^\d{4}-\d{2}-\d{2}/);
  assert.deepStrictEqual(index.chapters.map((c) => c.slug), chapters.map((c) => c.slug));
  assert.deepStrictEqual(index.chapters.map((c) => c.file), chapters.map((c) => c.file));
  for (const row of index.chapters) {
    const html = built[`${SPEC_BASE}/${row.slug}.html`]!;
    assert.deepStrictEqual(row.headings, headingsOf(html), `${row.file}: index.json headings are not the page's`);
    assert.ok(row.title.length > 2, `${row.file} has no title in index.json`);
  }
});

test('the concatenated markdown holds every chapter in order', { skip }, () => {
  const twin = built[`${SPEC_BASE}/${SPEC_TWIN_FILE}`]!;
  let at = 0;
  for (const c of chapters) {
    const found = twin.indexOf(`# ${c.title}\n`, at);
    assert.notEqual(found, -1, `${c.file} is missing from ${SPEC_TWIN_FILE}, or is out of order`);
    at = found + 1;
  }
});

/**
 * A line that tells the reader the file is not there. The status chapter's "what is
 * not built" list names files on purpose - `packages/core/src/document-v1.ts` is the
 * point of the sentence - so a path is exempt exactly where the prose says so, and
 * the exemption is written for the reader rather than kept in a list here.
 */
const SAYS_ABSENT = /\b(?:do(?:es)? not exist|is not built|are not built|not built yet|does not hold|holds no)\b/i;

test('every repository path a chapter cites exists on disk', { skip }, () => {
  const missing: string[] = [];
  let checked = 0;
  for (const c of chapters) {
    for (const line of c.md.replace(/^```[\s\S]*?^```/gm, '').split('\n')) {
      if (SAYS_ABSENT.test(line)) continue;
      for (const span of new Set(codeSpans(line))) {
        if (!looksLikePath(span)) continue;
        if (UNCHECKABLE.some((u) => span.startsWith(u.prefix))) continue;
        checked++;
        if (!existsSync(resolve(ROOT, span))) missing.push(`${c.file}: ${span}`);
      }
    }
  }
  assert.deepStrictEqual(missing, [], 'a chapter cites a repository file that is not there - fix the citation, or say in the sentence that the file does not exist');
  assert.ok(checked > 20, `only ${checked} cited paths were checked - the citation matcher has stopped matching`);
});

test('"profile" keeps its three meanings', { skip }, () => {
  // Content profile, colour profile, user profile. The plan's section 3 fixes the
  // vocabulary for everything the draft used to call a profile: conformance suite,
  // feature, execution class, output target. Code spans are exempt, so
  // `profiles.json` and `bindToProfile` read as themselves.
  const allowed = /(content|colour|color|user)[\s-]*$/i;
  const wrong: string[] = [];
  for (const c of chapters) {
    const lines = prose(c.md).split('\n');
    lines.forEach((line, i) => {
      // A link target can carry the word without meaning it in prose.
      const text = line.replace(/\]\([^)]*\)/g, '] ');
      for (const m of text.matchAll(/\bprofiles?\b/gi)) {
        if (!allowed.test(text.slice(0, m.index))) {
          wrong.push(`${c.file}:${i + 1} ${text.trim().slice(0, 100)}`);
        }
      }
    });
  }
  assert.deepStrictEqual(wrong, [], 'say which profile is meant (content, colour or user), or use the vocabulary of the plan\'s section 3');
});

test('every picture is a diagram, and every diagram exists', { skip }, () => {
  const offSite: string[] = [];
  const missing: string[] = [];
  for (const c of chapters) {
    for (const m of c.md.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const src = m[1]!;
      if (!src.startsWith('/info/diagrams/')) { offSite.push(`${c.file}: ${src}`); continue; }
      const file = resolve(ROOT, 'docs', src.replace(/^\/info\//, ''));
      if (!existsSync(file)) missing.push(`${c.file}: ${src}`);
    }
  }
  assert.deepStrictEqual(offSite, [], 'a chapter embeds a picture that is not a specification diagram');
  assert.deepStrictEqual(missing, [], 'a chapter embeds a diagram that docs/diagrams/ does not hold - render it with scripts/build-spec-diagrams.ts');
});

test('every chapter opens with the draft notice', { skip }, () => {
  const bad: string[] = [];
  for (const c of chapters) {
    // The preamble: everything before the first section heading.
    const preamble = c.md.split(/^##\s/m)[0] ?? '';
    const has = /draft for review/i.test(preamble) && preamble.includes('2026-09-24');
    if (!has) bad.push(c.file);
  }
  assert.deepStrictEqual(bad, [], 'a chapter is missing its notice: a draft for review, dated 2026-09-24');
});

test('every chapter ends with its open points and its precedents', { skip }, () => {
  // The brief asks each chapter to close with the Q items that touch it and the
  // repository files it relied on. A chapter without them is one nobody can check.
  const bad: string[] = [];
  for (const c of chapters) {
    const heads = headingsOf(built[`${SPEC_BASE}/${c.slug}.html`]!).map((h) => h.text.toLowerCase());
    if (!heads.includes('open points') || !heads.includes('precedents')) bad.push(c.file);
  }
  assert.deepStrictEqual(bad, [], 'a chapter has no "Open points" or no "Precedents" section');
});

test('the summary page is registered and points at the chapters', () => {
  // The front door in the Architecture group (docs/build.ts) and the page it names.
  const buildTs = readFileSync(resolve(ROOT, 'docs/build.ts'), 'utf8');
  assert.match(buildTs, /slug: 'document-model',\s*title: 'Document model draft'/);
  assert.match(buildTs, /\{ slug: 'document-model', label: 'Document model draft' \}/);
  assert.ok(existsSync(resolve(ROOT, 'docs/document-model.md')), 'docs/document-model.md is registered but not on disk');
});

/**
 * A reader inside the specification gets the specification's own chapters beside
 * them. The pathway rail the site puts on an ordinary docs page answers a question
 * they stopped asking when they opened the document, and the draft is not a page of
 * that pathway.
 */
test('every chapter carries a rail naming all twelve chapters, with itself marked', { skip }, () => {
  assert.equal(wrapped.size, chapters.length);
  for (const chapter of chapters) {
    const rail = wrapped.get(chapter.slug)?.rail.aside ?? '';
    for (const other of chapters) {
      assert.ok(
        rail.includes(`href="/info/${SPEC_BASE}/${other.slug}.html"`),
        `${chapter.slug}: the rail does not link to ${other.slug}`,
      );
    }
    const marked = [...rail.matchAll(/aria-current="page"/g)].length;
    assert.equal(marked, 1, `${chapter.slug}: expected exactly one current chapter in its rail`);
    const current = new RegExp(`href="/info/${SPEC_BASE}/${chapter.slug}\\.html" class="active" aria-current="page"`);
    assert.match(rail, current, `${chapter.slug}: the current chapter is not the marked one`);
    assert.ok(rail.includes(`href="${SPEC_HOME_HREF}"`), `${chapter.slug}: the rail has no way back to the summary page`);
  }
});

/** The rail lists the headings of the chapter a reader is on, and only that chapter's. */
test('a chapter rail lists its own headings', { skip }, () => {
  const index = JSON.parse(built[`${SPEC_BASE}/${SPEC_INDEX_FILE}`]!) as SpecIndex;
  for (const entry of index.chapters) {
    const rail = wrapped.get(entry.slug)?.rail.aside ?? '';
    const listed = [...rail.matchAll(/<li><a href="#([^"]+)"/g)].map((m) => m[1]!);
    const expected = entry.headings.filter((h) => h.level <= 3).map((h) => h.id);
    assert.deepEqual(listed, expected, `${entry.slug}: the rail's headings are not the chapter's own`);
  }
});

/** The menu a narrow screen opens lists the same places the rail does. */
test('the mobile chapter list names every chapter', { skip }, () => {
  for (const chapter of chapters) {
    const mobile = wrapped.get(chapter.slug)?.rail.mobile ?? '';
    for (const other of chapters) {
      assert.ok(
        mobile.includes(`href="/info/${SPEC_BASE}/${other.slug}.html"`),
        `${chapter.slug}: the mobile list does not link to ${other.slug}`,
      );
    }
    assert.ok(!mobile.includes('href="#'), `${chapter.slug}: the mobile list should carry no heading links`);
  }
});
