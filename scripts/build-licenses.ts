#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Third-party license / NOTICE generator.
 *
 * Run as: npm run build:licenses  (or directly: node scripts/build-licenses.ts)
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
 *   - Self-contained on purpose (mirrors scripts/build-sbom.ts). No network, no
 *     new dependency. License TEXT is read straight from node_modules - each
 *     component's LICENSE file, verbatim - so this file cannot disagree with
 *     what npm actually installed.
 *   - VERSIONS come from package-lock.json, not from the installed tree (same
 *     source of truth as build-sbom.ts). CI regenerates this file after a clean
 *     `npm ci` and fails on any diff, so a version read from a working copy's
 *     node_modules turns "my install is a few days stale" into a red drift gate
 *     for whoever regenerates next. The lock is committed; node_modules is not.
 *     Only the version moves - text and SPDX still come from the install, which
 *     is what keeps the notice honest about the bytes we ship.
 *   - The non-npm half (vendored d3 / topojson, the Lucide icons, the upstream
 *     HarfBuzz WASM, the SUSE OFL fonts, and the bundled map data) cannot be
 *     discovered from node_modules, so it lives in a small hand-maintained
 *     MANIFEST below with fixed, canonical license texts.
 *   - DETERMINISTIC + idempotent: ordering is fixed by the arrays below and no
 *     timestamp is emitted, so re-running with an unchanged dependency set
 *     produces byte-identical files (an empty `git diff` is the drift signal).
 *   - NOT wired into the app build. This is a manual refresh tool - run it after
 *     changing a distributed dependency, then commit the regenerated files.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// A single rendered attribution record, shared by the npm-loaded components, the
// hand-maintained MANIFEST entries, and the HarfBuzz WASM entry.
interface Entry {
  name: string;
  version: string;
  spdx: string;
  copyright?: string;
  files?: string;
  note?: string | null;
  text: string;
  where: string;
}

// Declared curation for an npm component distributed to users.
interface NpmComponent {
  pkg: string;
  where: string;
  elect?: string;
  transitiveVia?: string;
  // Extra per-component notice line (e.g. the LGPL dynamic-loading note).
  note?: string;
  // Canonical license text for packages that publish no LICENSE file to npm
  // (the license is declared in package.json only). Used verbatim.
  fallbackText?: string;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = join(ROOT, 'node_modules');

const MD_OUT = join(ROOT, 'THIRD-PARTY-NOTICES.md');
const TXT_OUT = join(ROOT, 'shells', 'web', 'public', 'THIRD-PARTY-LICENSES.txt');

// package-lock.json is the version source of truth (see the header note).
// lockfileVersion 3 keys every installed node by its path, so a top-level
// component is `node_modules/<pkg>`; anything npm nested elsewhere returns
// undefined here and falls back to the installed package.json.
const LOCK_PACKAGES = (
  JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { version?: string }>;
  }
).packages ?? {};

function lockedVersion(pkg: string): string | undefined {
  return LOCK_PACKAGES[`node_modules/${pkg}`]?.version;
}

// ─── LGPL-3.0 dynamic-loading note ───────────────────────────────────────────
// Two web components are LGPL-3.0. Both are loaded exclusively via dynamic
// `import()` as self-contained modules - never statically linked into Lolly's
// own code - so a user can swap in a modified copy of the library. The note is
// attached to each entry so the obligation story travels with the notice.
function lgplDynamicNote(pkg: string, what: string): string {
  return (
    `LGPL-3.0 component (${what}). Loaded only via dynamic import() as a ` +
    `self-contained JS/WASM module; it is not statically linked into Lolly's own ` +
    `code and can be replaced with a modified copy of the library. Complete ` +
    `corresponding source is available from the npm registry ` +
    `(https://www.npmjs.com/package/${pkg}) and the upstream repository. A formal ` +
    `LGPL relink/substitution analysis is tracked as an open compliance task.`
  );
}

// ─── Canonical texts for npm packages that publish NO LICENSE file ───────────
// Both declare MIT in package.json but ship no license text in the npm tarball,
// so readLicenseText() has nothing to copy. The canonical MIT body plus the
// upstream copyright line is recorded here instead.
const MIT_BODY = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// onnxruntime-web's npm tarball carries no LICENSE file; the project (ONNX
// Runtime, https://github.com/microsoft/onnxruntime) is MIT, © Microsoft.
const ONNXRUNTIME_WEB_TEXT = `MIT License

Copyright (c) Microsoft Corporation. All rights reserved.

${MIT_BODY}

(The onnxruntime-web npm package publishes no LICENSE file; this is the MIT
license of the ONNX Runtime project, https://github.com/microsoft/onnxruntime.)`;

// kiwi-schema's npm tarball carries no LICENSE file; the upstream project
// (https://github.com/evanw/kiwi) is MIT, © 2016 Evan Wallace.
const KIWI_SCHEMA_TEXT = `The MIT License (MIT)

Copyright (c) 2016 Evan Wallace

${MIT_BODY}

(The kiwi-schema npm package publishes no LICENSE file; this is the MIT
license of the upstream project, https://github.com/evanw/kiwi.)`;

// ─── npm components that are DISTRIBUTED to users ────────────────────────────
// `where: 'web'`  → bundled into the web PWA (engine runtime deps + web deps +
//                    the two transitive deps jspdf pulls in that get bundled).
// `where: 'cli'`  → ships only with the Node CLI shell.
// Order here is the order they appear in the output. Versions + license text
// are read live from node_modules; only the curation/scoping is declared.
const NPM_COMPONENTS: NpmComponent[] = [
  // Engine runtime deps - @lolly/engine is bundled into the web app (and also
  // drives the CLI). Listed under the web group; cross-referenced from the CLI.
  { pkg: 'handlebars', where: 'web' },
  { pkg: 'ajv', where: 'web' },

  // shells/web direct dependencies - bundled into the PWA.
  { pkg: 'dompurify', where: 'web', elect: 'MPL-2.0' },
  { pkg: 'pdf-lib', where: 'web' },
  { pkg: 'jspdf', where: 'web' },
  { pkg: 'dom-to-image-more', where: 'web' },
  { pkg: 'fflate', where: 'web' },
  { pkg: 'flatpickr', where: 'web' },
  { pkg: 'gifenc', where: 'web' },
  { pkg: 'idb', where: 'web' },
  { pkg: 'harfbuzzjs', where: 'web' },
  // Demux + WebCodecs decode for timeline/sequence video export. Lazy-imported, so it
  // only reaches a user who exports a timed composition - but it IS distributed.
  { pkg: 'mediabunny', where: 'web', elect: 'MPL-2.0' },
  // FLAC encode for the signed-FLAC export path (engine C2PA placer). Same project,
  // same licence, same lazy-import distribution story as mediabunny itself.
  { pkg: '@mediabunny/flac-encoder', where: 'web', elect: 'MPL-2.0' },

  // Rich-text editing (Tiptap + its bundled ProseMirror). All MIT, one project.
  { pkg: '@tiptap/core', where: 'web' },
  { pkg: '@tiptap/pm', where: 'web' },
  { pkg: '@tiptap/starter-kit', where: 'web' },
  { pkg: '@tiptap/extension-image', where: 'web' },
  { pkg: '@tiptap/extension-placeholder', where: 'web' },
  { pkg: '@tiptap/extension-table', where: 'web' },
  { pkg: '@tiptap/extension-table-cell', where: 'web' },
  { pkg: '@tiptap/extension-table-header', where: 'web' },
  { pkg: '@tiptap/extension-table-row', where: 'web' },
  { pkg: '@tiptap/extension-text-align', where: 'web' },
  { pkg: '@tiptap/extension-text-style', where: 'web' },

  // The emoji picker behind a `table` input's `emoji` column, and the two
  // packages it pulls in (all three MIT, all three by Julien Marcou): the raw
  // Unicode Emoji data and the custom scrollbar the grid scrolls with. Its own
  // chunk, fetched the first time someone opens an emoji cell - but shipped.
  { pkg: 'unicode-emoji-picker', where: 'web' },
  { pkg: 'unicode-emoji', where: 'web', transitiveVia: 'unicode-emoji-picker' },
  { pkg: 'scrollable-component', where: 'web', transitiveVia: 'unicode-emoji-picker' },

  // Media / export pipeline (all lazy-imported, but distributed all the same).
  { pkg: 'butterchurn', where: 'web' },
  { pkg: 'butterchurn-presets', where: 'web' },
  { pkg: 'lottie-web', where: 'web' },
  { pkg: 'onnxruntime-web', where: 'web', fallbackText: ONNXRUNTIME_WEB_TEXT },
  { pkg: 'woff2-encoder', where: 'web' },
  { pkg: 'fzstd', where: 'web' },
  { pkg: 'kiwi-schema', where: 'web', fallbackText: KIWI_SCHEMA_TEXT },

  // On-device code reader (plans/162 Part 2, host.scan). The MIT JS wrapper; the
  // zxing-cpp engine it compiles (Apache-2.0) is attributed separately below.
  // Lazy-imported as the fallback rung, but bundled + PWA-precached all the same.
  { pkg: 'zxing-wasm', where: 'web', note: 'zxing-wasm is the MIT JS/WASM wrapper; the ZXing C++ engine it embeds is Apache-2.0 (see the separate "ZXing C++ (compiled WASM)" entry).' },

  // On-device speech (Apache-2.0, both from the transformers.js author). Lazy-
  // imported by the Kokoro TTS and Whisper workers - a user who never asks for
  // speech never fetches them, but they ship in the PWA all the same. Declared
  // dependencies of shells/web since 2026-08-02; they were absent from this
  // list, which is what the coverage gate below exists to catch.
  { pkg: '@huggingface/transformers', where: 'web' },
  { pkg: 'phonemizer', where: 'web' },

  // LGPL-3.0 components - dynamically imported, self-contained modules. Each
  // carries the LGPL dynamic-loading note (see LGPL_DYNAMIC_NOTE).
  { pkg: 'heic-to', where: 'web', note: lgplDynamicNote('heic-to', 'the libheif HEIC/HEIF decoder compiled to WebAssembly') },
  { pkg: '@breezystack/lamejs', where: 'web', note: lgplDynamicNote('@breezystack/lamejs', 'the LAME MP3 encoder ported to JavaScript') },

  // Transitive deps that jspdf pulls in and that land in the web bundle.
  { pkg: 'html2canvas', where: 'web', transitiveVia: 'jspdf' },
  { pkg: 'core-js', where: 'web', transitiveVia: 'jspdf' },

  // shells/cli direct dependencies that are NOT shared with the web build.
  // (pdf-lib and fflate are also CLI deps but are documented once, above.)
  { pkg: 'jsdom', where: 'cli' },
  { pkg: '@resvg/resvg-js', where: 'cli' },
  { pkg: 'playwright-core', where: 'cli' },
];

// dompurify is dual-licensed "MPL-2.0 OR Apache-2.0"; Lolly elects MPL-2.0 to
// match the project license. We therefore do NOT dump dompurify's bundled
// Apache text - we record the election + the MPL Exhibit A notice and point at
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

// SUSE / SUSE Mono fonts - OFL-1.1. Full OFL text is NOT inlined here; it ships
// verbatim at catalog/fonts/OFL.txt (copied into the web build's /catalog/).
const SUSE_FONTS_TEXT = `Copyright 2025 The SUSE Project Authors (https://github.com/SUSE/suse-font)

The SUSE and SUSE Mono typefaces are licensed under the SIL Open Font
License, Version 1.1 (OFL-1.1). The full license is NOT reproduced here to
avoid divergence; it ships verbatim with the fonts at:

  catalog/fonts/OFL.txt   (served in the web build at /catalog/fonts/OFL.txt)

and is also carried in-band in every binary's name table (IDs 0, 13, 14).
"SUSE" is a trademark of SUSE; the OFL grant does not include trademark
rights (see OFL section 3-4).`;

// Google's Noto Color Emoji, COLRv1 build, served from the web shell's own
// /fonts/ so the emoji picker shows Unicode Emoji 17.0 on any device. Same
// no-divergence rule as the SUSE faces: the OFL ships verbatim beside the font.
const NOTO_EMOJI_TEXT = `Copyright 2013 Google LLC (https://github.com/googlefonts/noto-emoji)

Noto Color Emoji is licensed under the SIL Open Font License, Version 1.1
(OFL-1.1). The full license is NOT reproduced here to avoid divergence; it
ships verbatim beside the font at:

  shells/web/public/fonts/OFL-NotoColorEmoji.txt
  (served in the web build at /fonts/OFL-NotoColorEmoji.txt)

The shipped file is the COLRv1 build from release v2.051 (the Unicode 17.0
update), recompressed to WOFF2 for the web. No glyphs, metrics or name-table
entries were changed.`;

// world-atlas TopoJSON bundled for the meeting-planner map.
const WORLD_ATLAS_TEXT = `tools/meeting-planner/lib/countries-110m.json is a world-atlas TopoJSON
build (https://github.com/topojson/world-atlas), under the ISC License,
Copyright Mike Bostock. Its geometry is derived from Natural Earth
(https://www.naturalearthdata.com), which is released into the public
domain (Natural Earth Terms of Use).

${ISC_BODY}`;

// The vendored libopenmpt WASM tracker-module decoder (src/vendor/libopenmpt/). Built
// with libopenmpt's DEFAULT internal codecs, so the whole artifact is permissive - no
// LGPL (libmpg123/libvorbis are opt-in only, behind ALLOW_LGPL=1, which we never set).
// See scripts/build-libopenmpt-wasm.sh and the vendor README.
const LIBOPENMPT_TEXT = `Copyright (c) 2004-2026, OpenMPT Project Developers and Contributors
Copyright (c) 1997-2003, Olivier Lapicque
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the OpenMPT project nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Bundled internal codecs, statically linked into the same WASM (all permissive):
  * minimp3 - CC0-1.0 / public domain (MP3 samples in MO3)
  * stb_vorbis - public domain OR MIT, © 2017 Sean Barrett (Vorbis samples)
  * miniz - MIT, © 2013-2014 RAD Game Tools & Valve, © 2010-2014 Rich Geldreich
The Emscripten runtime glue in libopenmpt.mjs is MIT (© Emscripten authors).`;

// Each manifest entry sets `where`: 'web' means it ships in the web build, so it
// appears in BOTH the full notices and the web-scoped THIRD-PARTY-LICENSES.txt.
// (Anything web-only-excluded would use another value; today every entry ships
// in the web build, so all are 'web'.)
const MANIFEST: {
  vendored: Entry[];
  icons: Entry[];
  fonts: Entry[];
  mapData: Entry[];
} = {
  vendored: [
    {
      name: 'bwip-js (with BWIPP)',
      version: '4.11.4 (@bwip-js/generic; BWIPP 2026-05-28)',
      spdx: 'MIT',
      copyright: 'Copyright (c) 2011-2026 Mark Warren; BWIPP Copyright (c) 2004-2024 Terry Burton',
      files: 'tools/qr-code/hooks.js (inlined selective esbuild bundle)',
      text: `Copyright (c) 2011-2026 Mark Warren (bwip-js)\nCopyright (c) 2004-2024 Terry Burton (Barcode Writer in Pure PostScript)\n\n${MIT_BODY}`,
      note: 'Selective bundle: the Data Matrix / GS1 Data Matrix / PDF417 / Aztec / Micro QR / MaxiCode / ITF-14 / Code 39 / Codabar / GS1-128 / GS1 DataBar / ISBN / UPC-E encoders plus the SVG drawing surface. Rebuild instructions sit above the bundle in the hooks file.',
      where: 'web',
    },
    {
      name: 'qrcode-svg',
      version: '1.1.0',
      spdx: 'MIT',
      copyright: 'Copyright (c) 2016 papnkukn',
      files: 'tools/qr-code/hooks.js (inlined)',
      text: `Copyright (c) 2016 papnkukn\n\n${MIT_BODY}`,
      where: 'web',
    },
    {
      name: 'chart',
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
    {
      name: 'libopenmpt (compiled WASM)',
      version: '0.8.7 (Emscripten build)',
      spdx: 'BSD-3-Clause',
      copyright: '© 2004-2026 OpenMPT Project Developers & Contributors; © 1997-2003 Olivier Lapicque',
      files: 'shells/web/src/vendor/libopenmpt/libopenmpt.mjs',
      text: LIBOPENMPT_TEXT,
      note: 'Tracker-module (.mod/.xm/.s3m/.it/…) decoder. Built from source with permissive internal codecs only - see scripts/build-libopenmpt-wasm.sh.',
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
    {
      name: 'Noto Color Emoji',
      version: '(COLRv1, noto-emoji v2.051)',
      spdx: 'OFL-1.1',
      copyright: 'Copyright 2013 Google LLC',
      files: 'shells/web/public/fonts/NotoColorEmoji-COLRv1.woff2',
      text: NOTO_EMOJI_TEXT,
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
  ],
};

// The ZXing C++ engine (Apache-2.0) is compiled into the WASM carried inside the
// zxing-wasm npm package (whose own wrapper is MIT), so - exactly like the
// HarfBuzz WASM below - it is a distinct shipped component declared by hand.
const APACHE_2_0_TEXT = `                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

   "License" shall mean the terms and conditions for use, reproduction, and
   distribution as defined by Sections 1 through 9 of this document.

   "Licensor" shall mean the copyright owner or entity authorized by the
   copyright owner that is granting the License.

   "You" (or "Your") shall mean an individual or Legal Entity exercising
   permissions granted by this License.

   2. Grant of Copyright License. Subject to the terms and conditions of this
   License, each Contributor hereby grants to You a perpetual, worldwide,
   non-exclusive, no-charge, royalty-free, irrevocable copyright license to
   reproduce, prepare Derivative Works of, publicly display, publicly perform,
   sublicense, and distribute the Work and such Derivative Works in Source or
   Object form.

   3. Grant of Patent License. Subject to the terms and conditions of this
   License, each Contributor hereby grants to You a perpetual, worldwide,
   non-exclusive, no-charge, royalty-free, irrevocable (except as stated in
   this section) patent license to make, have made, use, offer to sell, sell,
   import, and otherwise transfer the Work.

   7. Disclaimer of Warranty. Unless required by applicable law or agreed to in
   writing, Licensor provides the Work (and each Contributor provides its
   Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
   KIND, either express or implied.

   8. Limitation of Liability. In no event and under no legal theory shall any
   Contributor be liable to You for damages arising out of the use or inability
   to use the Work.

   Full text: http://www.apache.org/licenses/LICENSE-2.0
`;

const ZXING_CPP_WASM_ENTRY: Entry = {
  name: 'ZXing C++ (compiled WASM)',
  version: '(bundled in zxing-wasm)',
  spdx: 'Apache-2.0',
  copyright: '© ZXing authors; C++ port © Axel Waggershauser (nu-book/zxing-cpp)',
  files: 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm (shipped + PWA-precached)',
  text: APACHE_2_0_TEXT,
  where: 'web',
};

// The upstream HarfBuzz WASM is a distinct shipped component carried inside the
// harfbuzzjs npm package, so it sits next to the npm web group rather than in
// the MANIFEST above.
const HARFBUZZ_WASM_ENTRY: Entry = {
  name: 'HarfBuzz (compiled WASM)',
  version: '(bundled in harfbuzzjs 1.4.0)',
  spdx: 'MIT (HarfBuzz "Old MIT")',
  copyright: '© Google, Behdad Esfahbod, Red Hat, et al.',
  files: 'node_modules/harfbuzzjs/dist/harfbuzz.wasm, harfbuzz-subset.wasm (shipped)',
  text: HARFBUZZ_OLD_MIT_TEXT,
  where: 'web',
};

// ─── Read npm component metadata + license text from node_modules ────────────
function loadNpmComponent({ pkg, where, elect, transitiveVia, note, fallbackText }: NpmComponent): Entry {
  const dir = join(NODE_MODULES, pkg);
  // Installed package.json - dynamic JSON, minimally typed for the fields we read.
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    version: string;
    license?: unknown;
    author?: unknown;
  };
  // Version from the LOCK (see the header note); the install is only the
  // fallback, for a component npm hoisted somewhere other than the root.
  const version = lockedVersion(pkg) ?? meta.version;
  const spdx = elect
    ? `${elect} (elected from "${spdxString(meta.license)}")`
    : spdxString(meta.license);

  let text: string;
  let copyright: string;
  if (pkg === 'dompurify') {
    text = DOMPURIFY_ELECTION_TEXT;
    copyright = '(c) Cure53 and other contributors';
  } else {
    text = fallbackText ?? readLicenseText(dir);
    copyright = extractCopyright(text) || authorString(meta.author);
  }

  return {
    name: pkg,
    version,
    spdx,
    copyright,
    text,
    where,
    note: [transitiveVia && `Transitive dependency bundled via ${transitiveVia}.`, note]
      .filter(Boolean)
      .join(' ') || null,
  };
}

function spdxString(license: unknown): string {
  if (!license) return 'UNKNOWN';
  if (typeof license === 'string') return license;
  // Legacy { type } / [{ type }] forms.
  if (Array.isArray(license)) return license.map((l) => l.type || l).join(' OR ');
  return (license as { type?: string }).type || 'UNKNOWN';
}

function authorString(author: unknown): string {
  if (!author) return '';
  if (typeof author === 'string') return author;
  const a = author as { name?: string; email?: string };
  return [a.name, a.email && `<${a.email}>`].filter(Boolean).join(' ');
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
function entryMarkdown(e: Entry): string {
  const lines = [`### ${e.name} ${e.version}`, ''];
  lines.push(`- SPDX-License-Identifier: \`${e.spdx}\``);
  if (e.files) lines.push(`- Files: \`${e.files}\``);
  if (e.copyright) lines.push(`- Copyright: ${e.copyright.replace(/\n\s*/g, '; ')}`);
  if (e.note) lines.push(`- ${e.note}`);
  lines.push('', '```text', e.text, '```', '');
  return lines.join('\n');
}

function entryText(e: Entry): string {
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

function sectionMarkdown(title: string, entries: Entry[]): string {
  if (!entries.length) return '';
  return `## ${title}\n\n${entries.map(entryMarkdown).join('\n')}`;
}

function sectionText(title: string, entries: Entry[]): string {
  if (!entries.length) return '';
  return `${'='.repeat(80)}\n${title.toUpperCase()}\n${'='.repeat(80)}\n\n${entries.map(entryText).join('\n')}`;
}

// ─── Assemble component sets ─────────────────────────────────────────────────
const npmLoaded = NPM_COMPONENTS.map(loadNpmComponent);
const webNpm = npmLoaded.filter((c) => c.where === 'web');
const cliNpm = npmLoaded.filter((c) => c.where === 'cli');

// "Bundled in the web app" = web npm deps, with the HarfBuzz WASM placed right
// after its harfbuzzjs glue.
const bundledEntries: Entry[] = [];
for (const c of webNpm) {
  bundledEntries.push(c);
  if (c.name === 'harfbuzzjs') bundledEntries.push(HARFBUZZ_WASM_ENTRY);
  if (c.name === 'zxing-wasm') bundledEntries.push(ZXING_CPP_WASM_ENTRY);
}

// Coverage gate: every distributed direct dependency declared in the three
// workspace manifests must be accounted for - a missing one exits 1 so CI blocks.
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
  '_Generated by `scripts/build-licenses.ts` (`npm run build:licenses`). Do not edit by hand._',
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
  'below. Generated by scripts/build-licenses.ts; do not edit by hand.',
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

// ─── Drift gate ──────────────────────────────────────────────────────────────
// Read the declared direct dependencies of the three distributed workspaces and
// FAIL (exit 1) if any is missing from NPM_COMPONENTS - a new shipped dep must
// not land without its notice. CI runs this via `npm run build:licenses`.
function verifyManifestCoverage(): void {
  const declared = new Set<string>();
  for (const rel of ['engine/package.json', 'shells/web/package.json', 'shells/cli/package.json']) {
    const pkg = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      // Internal workspace links (this repo's own MPL-2.0 code), not 3rd party.
      if (dep.startsWith('@lolly/') || dep.startsWith('@lolly-tools/')) continue;
      declared.add(dep);
    }
  }
  const covered = new Set(NPM_COMPONENTS.map((c) => c.pkg));
  const missing = [...declared].filter((d) => !covered.has(d));
  if (missing.length) {
    console.error(
      `✗ ${missing.length} distributed dependency not in NPM_COMPONENTS: ${missing.join(', ')}\n` +
      `  Add it to scripts/build-licenses.ts so its notice is retained.`,
    );
    process.exit(1);
  }
}
