#!/usr/bin/env node
/**
 * Third-party license / NOTICE generator.
 *
 * Run as: npm run build:licenses  (or directly: node scripts/build-licenses.js)
 *
 * Regenerates the two attribution files Lolly ships so that every third-party
 * component distributed to a user travels with its required copyright +
 * permission notice (the duty common to MIT / ISC / BSD / Apache-2.0 / MPL-2.0):
 *
 *   1. THIRD-PARTY-NOTICES.md                     (repo root, human-readable)
 *        Full inventory: web-bundled deps, the CLI-only dep, vendored libraries,
 *        icons, fonts, and map data.
 *   2. shells/web/public/THIRD-PARTY-LICENSES.txt (served at /THIRD-PARTY-LICENSES.txt)
 *        Plain text, scoped to exactly what ships in the *web* build.
 *
 * Design notes:
 *   - Self-contained on purpose (mirrors scripts/build-sbom.js). No network, no
 *     new dependency. The npm half is read straight from node_modules: each
 *     component's installed package.json (version + license) and its LICENSE
 *     file text, verbatim. We don't re-derive license text — we copy what npm
 *     actually installed, so this file cannot disagree with the install.
 *   - The non-npm half (vendored d3 / topojson, the Lucide icons, the upstream
 *     HarfBuzz WASM, the SUSE OFL fonts, and the bundled map data) cannot be
 *     discovered from node_modules, so it lives in a small hand-maintained
 *     MANIFEST below with fixed, canonical license texts.
 *   - DETERMINISTIC + idempotent: ordering is fixed by the arrays below and no
 *     timestamp is emitted, so re-running with an unchanged dependency set
 *     produces byte-identical files (an empty `git diff` is the drift signal).
 *   - NOT wired into the app build. This is a manual refresh tool — run it after
 *     changing a distributed dependency, then commit the regenerated files.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = join(ROOT, 'node_modules');

const MD_OUT = join(ROOT, 'THIRD-PARTY-NOTICES.md');
const TXT_OUT = join(ROOT, 'shells', 'web', 'public', 'THIRD-PARTY-LICENSES.txt');

type Where = 'web' | 'cli';

/** One rendered attribution entry — an npm component or a MANIFEST item. */
interface LicenseEntry {
  name: string;
  version: string;
  spdx: string;
  copyright?: string;
  files?: string;
  text: string;
  note?: string | null;
  where?: Where;
}

interface NpmComponentSpec {
  pkg: string;
  where: Where;
  elect?: string;
  transitiveVia?: string;
}

// ─── npm components that are DISTRIBUTED to users ────────────────────────────
// `where: 'web'`  → bundled into the web PWA (engine runtime deps + web deps +
//                    the two transitive deps jspdf pulls in that get bundled).
// `where: 'cli'`  → ships only with the Node CLI shell.
// Order here is the order they appear in the output. Versions + license text
// are read live from node_modules; only the curation/scoping is declared.
const NPM_COMPONENTS: NpmComponentSpec[] = [
  // Engine runtime deps — @lolly/engine is bundled into the web app (and also
  // drives the CLI). Listed under the web group; cross-referenced from the CLI.
  { pkg: 'handlebars', where: 'web' },
  { pkg: 'ajv', where: 'web' },

  // shells/web direct dependencies — bundled into the PWA.
  { pkg: 'dompurify', where: 'web', elect: 'MPL-2.0' },
  { pkg: 'pdf-lib', where: 'web' },
  { pkg: 'jspdf', where: 'web' },
  { pkg: 'dom-to-image-more', where: 'web' },
  { pkg: 'fflate', where: 'web' },
  { pkg: 'flatpickr', where: 'web' },
  { pkg: 'gifenc', where: 'web' },
  { pkg: 'idb', where: 'web' },
  { pkg: 'harfbuzzjs', where: 'web' },

  // Transitive deps that jspdf pulls in and that land in the web bundle.
  { pkg: 'html2canvas', where: 'web', transitiveVia: 'jspdf' },
  { pkg: 'core-js', where: 'web', transitiveVia: 'jspdf' },

  // shells/cli direct dependency that is NOT shared with the web build.
  // (pdf-lib is also a CLI dep but is documented once, above.)
  { pkg: 'jsdom', where: 'cli' },
];

// dompurify is dual-licensed "MPL-2.0 OR Apache-2.0"; Lolly elects MPL-2.0 to
// match the project license. We therefore do NOT dump dompurify's bundled
// Apache text — we record the election + the MPL Exhibit A notice and point at
// the project's own MPL-2.0 copy (repo root LICENSE).
const DOMPURIFY_ELECTION_TEXT = `DOMPurify is dual-licensed under "MPL-2.0 OR Apache-2.0". Lolly elects to
use it under the Mozilla Public License, Version 2.0 (MPL-2.0), to match the
project's own license.

The full text of the MPL-2.0 is identical to the project license shipped at
/LICENSE (repository root) and is also available at https://mozilla.org/MPL/2.0/.

Exhibit A - Source Code Form License Notice:

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at https://mozilla.org/MPL/2.0/.`;

// ─── Canonical license texts for non-npm (vendored / asset) components ───────
// These never appear in node_modules, so their texts are fixed here.

// Canonical ISC permission body (used by d3 and topojson-client).
const ISC_BODY = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;

// Lucide ISC license, including the upstream Feather (MIT, © Cole Bemis) note.
const LUCIDE_TEXT = `ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
part of Feather (MIT). All other copyright (c) for Lucide are held by
Lucide Contributors 2022.

Copyright (c) 2022, Lucide Contributors

${ISC_BODY}`;

// Canonical HarfBuzz "Old MIT" license. harfbuzzjs's own LICENSE (MIT, the JS
// glue) does NOT carry this upstream notice for the compiled harfbuzz*.wasm.
const HARFBUZZ_OLD_MIT_TEXT = `HarfBuzz is licensed under the so-called "Old MIT" license.  Details follow.

Copyright © 2010-2022  Google, Inc.
Copyright © 2015-2020  Ebrahim Byagowi
Copyright © 2019,2020  Facebook, Inc.
Copyright © 2012,2015  Mozilla Foundation
Copyright © 2011  Codethink Limited
Copyright © 2008,2010  Nokia Corporation and/or its subsidiary(-ies)
Copyright © 2009  Keith Stribley
Copyright © 2011  Martin Hosken and SIL International
Copyright © 2007  Chris Wilson
Copyright © 2005,2006,2020,2021,2022,2023  Behdad Esfahbod
Copyright © 2004,2007,2008,2009,2010,2013,2021,2022,2023  Red Hat, Inc.
Copyright © 1998-2005  David Turner and Werner Lemberg
Copyright © 2016  Igalia S.L.
Copyright © 2022  Matthias Clasen
Copyright © 2018,2021  Khaled Hosny
Copyright © 2018,2019,2020  Adobe, Inc
Copyright © 2013-2015  Alexei Podtelezhnikov

For full copyright notices consult the individual files in the package.


Permission is hereby granted, without written agreement and without
license or royalty fees, to use, copy, modify, and distribute this
software and its documentation for any purpose, provided that the
above copyright notice and the following two paragraphs appear in
all copies of this software.

IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE TO ANY PARTY FOR
DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES
ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN
IF THE COPYRIGHT HOLDER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.

THE COPYRIGHT HOLDER SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING,
BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE.  THE SOFTWARE PROVIDED HEREUNDER IS
ON AN "AS IS" BASIS, AND THE COPYRIGHT HOLDER HAS NO OBLIGATION TO
PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.`;

// SUSE / SUSE Mono fonts — OFL-1.1. Full OFL text is NOT inlined here; it ships
// verbatim at catalog/fonts/OFL.txt (copied into the web build's /catalog/).
const SUSE_FONTS_TEXT = `Copyright 2025 The SUSE Project Authors (https://github.com/SUSE/suse-font)

The SUSE and SUSE Mono typefaces are licensed under the SIL Open Font
License, Version 1.1 (OFL-1.1). The full license is NOT reproduced here to
avoid divergence; it ships verbatim with the fonts at:

  catalog/fonts/OFL.txt   (served in the web build at /catalog/fonts/OFL.txt)

and is also carried in-band in every binary's name table (IDs 0, 13, 14).
"SUSE" is a trademark of SUSE; the OFL grant does not include trademark
rights (see OFL §3-4).`;

// world-atlas TopoJSON bundled for the meeting-planner map.
const WORLD_ATLAS_TEXT = `tools/meeting-planner/lib/countries-110m.json is a world-atlas TopoJSON
build (https://github.com/topojson/world-atlas), under the ISC License,
Copyright Mike Bostock. Its geometry is derived from Natural Earth
(https://www.naturalearthdata.com), which is released into the public
domain (Natural Earth Terms of Use).

${ISC_BODY}`;

// The orphan SVG-path world map used by the daily-card tool.
const WORLD_MAP_TXT_TEXT = `tools/daily-card/world-map.txt is a low-resolution SVG-path outline of the
world's coastlines. The file carries no embedded provenance. Its resolution
and geometry are consistent with Natural Earth public-domain data (the same
source as the bundled world-atlas TopoJSON above), so it is most likely
derived from Natural Earth and therefore public domain. This provenance is
UNCONFIRMED from the file alone and is recorded here honestly as a best
estimate pending confirmation.`;

// Each manifest entry sets `where`: 'web' means it ships in the web build, so it
// appears in BOTH the full notices and the web-scoped THIRD-PARTY-LICENSES.txt.
// (Anything web-only-excluded would use another value; today every entry ships
// in the web build, so all are 'web'.)
const MANIFEST: { vendored: LicenseEntry[]; icons: LicenseEntry[]; fonts: LicenseEntry[]; mapData: LicenseEntry[] } = {
  vendored: [
    {
      name: 'd3',
      version: '7.9.0',
      spdx: 'ISC',
      copyright: 'Copyright 2010-2023 Mike Bostock',
      files: 'tools/street-map/lib/d3.min.js, tools/meeting-planner/lib/d3.min.js',
      text: `Copyright 2010-2023 Mike Bostock\n\n${ISC_BODY}`,
      where: 'web',
    },
    {
      name: 'topojson-client',
      version: '3.1.0',
      spdx: 'ISC',
      copyright: 'Copyright 2019 Mike Bostock',
      files: 'tools/meeting-planner/lib/topojson.min.js',
      text: `Copyright 2019 Mike Bostock\n\n${ISC_BODY}`,
      where: 'web',
    },
  ],
  icons: [
    {
      name: 'Lucide',
      version: '(icon path data)',
      spdx: 'ISC',
      copyright: '© Lucide Contributors (portions © Cole Bemis, Feather, MIT)',
      files: 'all 27 tools/*/icon.svg',
      text: LUCIDE_TEXT,
      where: 'web',
    },
  ],
  fonts: [
    {
      name: 'SUSE & SUSE Mono',
      version: '2.000',
      spdx: 'OFL-1.1',
      copyright: 'Copyright 2025 The SUSE Project Authors',
      files: 'catalog/fonts/',
      text: SUSE_FONTS_TEXT,
      where: 'web',
    },
  ],
  mapData: [
    {
      name: 'world-atlas (countries-110m)',
      version: '(TopoJSON, Natural Earth-derived)',
      spdx: 'ISC AND public-domain',
      copyright: 'Copyright Mike Bostock; underlying data © Natural Earth (public domain)',
      files: 'tools/meeting-planner/lib/countries-110m.json',
      text: WORLD_ATLAS_TEXT,
      where: 'web',
    },
    {
      name: 'daily-card world map',
      version: '(SVG path, provenance unconfirmed)',
      spdx: 'public-domain (likely Natural Earth, unconfirmed)',
      copyright: 'No embedded copyright; likely Natural Earth (public domain)',
      files: 'tools/daily-card/world-map.txt',
      text: WORLD_MAP_TXT_TEXT,
      where: 'web',
    },
  ],
};

// The upstream HarfBuzz WASM is a distinct shipped component carried inside the
// harfbuzzjs npm package, so it sits next to the npm web group rather than in
// the MANIFEST above.
const HARFBUZZ_WASM_ENTRY: LicenseEntry = {
  name: 'HarfBuzz (compiled WASM)',
  version: '(bundled in harfbuzzjs 1.4.0)',
  spdx: 'MIT (HarfBuzz "Old MIT")',
  copyright: '© Google, Behdad Esfahbod, Red Hat, et al.',
  files: 'node_modules/harfbuzzjs/dist/harfbuzz.wasm, harfbuzz-subset.wasm (shipped)',
  text: HARFBUZZ_OLD_MIT_TEXT,
  where: 'web',
};

// ─── package.json shapes read from node_modules ──────────────────────────────
interface LegacyLicenseField {
  type?: string;
}
type LicenseField = string | LegacyLicenseField | LegacyLicenseField[] | undefined;
interface PkgAuthor {
  name?: string;
  email?: string;
}
interface PkgMeta {
  version: string;
  license?: LicenseField;
  author?: string | PkgAuthor;
}

// ─── Read npm component metadata + license text from node_modules ────────────
function loadNpmComponent({ pkg, where, elect, transitiveVia }: NpmComponentSpec): LicenseEntry {
  const dir = join(NODE_MODULES, pkg);
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PkgMeta;
  const spdx = elect
    ? `${elect} (elected from "${spdxString(meta.license)}")`
    : spdxString(meta.license);

  let text: string;
  let copyright: string;
  if (pkg === 'dompurify') {
    text = DOMPURIFY_ELECTION_TEXT;
    copyright = '(c) Cure53 and other contributors';
  } else {
    text = readLicenseText(dir);
    copyright = extractCopyright(text) || authorString(meta.author);
  }

  return {
    name: pkg,
    version: meta.version,
    spdx,
    copyright,
    text,
    where,
    note: transitiveVia ? `Transitive dependency bundled via ${transitiveVia}.` : null,
  };
}

function spdxString(license: LicenseField): string {
  if (!license) return 'UNKNOWN';
  if (typeof license === 'string') return license;
  // Legacy { type } / [{ type }] forms.
  if (Array.isArray(license)) return license.map((l) => l.type || 'UNKNOWN').join(' OR ');
  return license.type || 'UNKNOWN';
}

function authorString(author: string | PkgAuthor | undefined): string {
  if (!author) return '';
  if (typeof author === 'string') return author;
  return [author.name, author.email && `<${author.email}>`].filter(Boolean).join(' ');
}

// Find the LICENSE file in a package dir, tolerant of the common spellings.
const LICENSE_NAMES = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt',
  'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'LICENSE-MIT', 'LICENSE-MIT.txt',
  'COPYING', 'COPYING.txt',
];
function readLicenseText(dir: string): string {
  for (const name of LICENSE_NAMES) {
    const p = join(dir, name);
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  }
  // Last resort: any file whose name starts with LICEN.
  const hit = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
  if (hit) return readFileSync(join(dir, hit), 'utf8').trim();
  throw new Error(`No LICENSE file found for ${dir}`);
}

// Pull the copyright holder line(s) out of a license body for the summary
// header. Anchored at line start so the "The above copyright notice ..."
// permission boilerplate isn't mistaken for an attribution line.
function extractCopyright(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(copyright\b|\(c\)|©)/i.test(l));
  return lines.join('; ');
}

// ─── Render ──────────────────────────────────────────────────────────────────
function entryMarkdown(e: LicenseEntry): string {
  const lines = [`### ${e.name} ${e.version}`, ''];
  lines.push(`- SPDX-License-Identifier: \`${e.spdx}\``);
  if (e.files) lines.push(`- Files: \`${e.files}\``);
  if (e.copyright) lines.push(`- Copyright: ${e.copyright.replace(/\n\s*/g, '; ')}`);
  if (e.note) lines.push(`- ${e.note}`);
  lines.push('', '```text', e.text, '```', '');
  return lines.join('\n');
}

function entryText(e: LicenseEntry): string {
  const lines = [
    '-'.repeat(80),
    `${e.name} ${e.version}`,
    `SPDX-License-Identifier: ${e.spdx}`,
  ];
  if (e.files) lines.push(`Files: ${e.files}`);
  if (e.copyright) lines.push(`Copyright: ${e.copyright.replace(/\n\s*/g, '; ')}`);
  if (e.note) lines.push(e.note);
  lines.push('', e.text, '');
  return lines.join('\n');
}

function sectionMarkdown(title: string, entries: LicenseEntry[]): string {
  if (!entries.length) return '';
  return `## ${title}\n\n${entries.map(entryMarkdown).join('\n')}`;
}

function sectionText(title: string, entries: LicenseEntry[]): string {
  if (!entries.length) return '';
  return `${'='.repeat(80)}\n${title.toUpperCase()}\n${'='.repeat(80)}\n\n${entries.map(entryText).join('\n')}`;
}

// ─── Assemble component sets ─────────────────────────────────────────────────
const npmLoaded = NPM_COMPONENTS.map(loadNpmComponent);
const webNpm = npmLoaded.filter((c) => c.where === 'web');
const cliNpm = npmLoaded.filter((c) => c.where === 'cli');

// "Bundled in the web app" = web npm deps, with the HarfBuzz WASM placed right
// after its harfbuzzjs glue.
const bundledEntries: LicenseEntry[] = [];
for (const c of webNpm) {
  bundledEntries.push(c);
  if (c.name === 'harfbuzzjs') bundledEntries.push(HARFBUZZ_WASM_ENTRY);
}

// Sanity check: every distributed direct dependency declared in the three
// workspace manifests should be accounted for (warn on drift, don't fail).
verifyManifestCoverage();

// Blocks are joined with a blank line between them; empty sections drop out.
function joinBlocks(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join('\n\n') + '\n';
}

// ─── THIRD-PARTY-NOTICES.md (full, grouped) ──────────────────────────────────
const cliCrossRef = cliNpm.length
  ? '> The CLI shell also uses `@lolly/engine` (handlebars, ajv) and `pdf-lib`, ' +
    'whose notices appear above under "Bundled in the web app".'
  : '';

const mdHeader = [
  '# Third-Party Notices',
  '',
  'This file lists the third-party components Lolly distributes and reproduces their',
  'required copyright and permission notices. Lolly itself is licensed under MPL-2.0',
  '(see [LICENSE](./LICENSE)); the components below keep their own licenses.',
  '',
  '_Generated by `scripts/build-licenses.js` (`npm run build:licenses`). Do not edit by hand._',
].join('\n');

writeFileSync(MD_OUT, joinBlocks([
  mdHeader,
  sectionMarkdown('Bundled in the web app', bundledEntries),
  sectionMarkdown('CLI', cliNpm),
  cliCrossRef,
  sectionMarkdown('Vendored libraries', MANIFEST.vendored),
  sectionMarkdown('Icons', MANIFEST.icons),
  sectionMarkdown('Fonts', MANIFEST.fonts),
  sectionMarkdown('Map data', MANIFEST.mapData),
]));

// ─── THIRD-PARTY-LICENSES.txt (plain text, web build scope only) ─────────────
// Everything that actually ships in the web build: web npm deps + HarfBuzz
// WASM + vendored libs + icons + fonts + map data. The CLI-only dep is omitted.
const txtHeader = [
  'THIRD-PARTY LICENSES',
  '',
  'Lolly (https://lolly.tools) is licensed under MPL-2.0 (see /LICENSE).',
  'The components bundled into this web app retain their own licenses, reproduced',
  'below. Generated by scripts/build-licenses.js; do not edit by hand.',
].join('\n');

writeFileSync(TXT_OUT, joinBlocks([
  txtHeader,
  sectionText('Bundled in the web app', bundledEntries),
  sectionText('Vendored libraries', MANIFEST.vendored.filter((e) => e.where === 'web')),
  sectionText('Icons', MANIFEST.icons.filter((e) => e.where === 'web')),
  sectionText('Fonts', MANIFEST.fonts.filter((e) => e.where === 'web')),
  sectionText('Map data', MANIFEST.mapData.filter((e) => e.where === 'web')),
]));

console.log(
  `✓ Wrote THIRD-PARTY-NOTICES.md (${bundledEntries.length + cliNpm.length} npm + ` +
  `${MANIFEST.vendored.length + MANIFEST.icons.length + MANIFEST.fonts.length + MANIFEST.mapData.length} non-npm components)`,
);
console.log(`✓ Wrote shells/web/public/THIRD-PARTY-LICENSES.txt (web build scope)`);

// ─── Drift guard ─────────────────────────────────────────────────────────────
// Read the declared direct dependencies of the three distributed workspaces and
// warn if any is missing from NPM_COMPONENTS (a new shipped dep we'd under-attribute).
function verifyManifestCoverage(): void {
  const declared = new Set<string>();
  for (const rel of ['engine/package.json', 'shells/web/package.json', 'shells/cli/package.json']) {
    const pkg = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as { dependencies?: Record<string, string> };
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (dep.startsWith('@lolly/')) continue; // internal workspace link
      declared.add(dep);
    }
  }
  const covered = new Set(NPM_COMPONENTS.map((c) => c.pkg));
  const missing = [...declared].filter((d) => !covered.has(d));
  if (missing.length) {
    console.warn(
      `⚠ ${missing.length} distributed dependency not in NPM_COMPONENTS: ${missing.join(', ')}\n` +
      `  Add it to scripts/build-licenses.js so its notice is retained.`,
    );
  }
}
