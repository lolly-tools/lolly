// SPDX-License-Identifier: MPL-2.0
/**
 * The web app manifest is a contract with the operating system, and nothing else
 * in the build reads it - so a stale entry in it fails silently, on someone's
 * installed app, months later. That is what happened to the "Batch mode"
 * shortcut: it pointed at `/pro`, the pre-2026-08-20 spelling of `/batch`, and
 * kept doing so through the rename because no test looked.
 *
 * So this reads the shipping `public/manifest.webmanifest` and holds it against
 * the three things it promises:
 *
 *   1. Every `shortcuts[].url` resolves to a route main.ts actually mounts - a
 *      hash route word, a single-segment path branch, or a real tool id from the
 *      catalog. The route vocabulary is read out of main.ts itself, so a route
 *      renamed there fails here rather than in a launcher menu.
 *   2. Every file type the DESKTOP app claims (tauri.conf.json fileAssociations)
 *      is claimed by the installed web app too. The two shells open the same
 *      files through the same drop chooser; a type added to one and not the
 *      other is the drift this catches.
 *   3. The share target's action is the path the service worker intercepts, and
 *      its file field is the name the worker reads (`files`). Those three
 *      literals live in three files and are useless apart.
 *
 * Run with: node --test shells/web/src/lib/manifest-contract.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { deepLinkToHash } from './deep-link.ts';

const at = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string): string => readFileSync(at(rel), 'utf8');

interface Shortcut { name?: string; url?: string }
interface FileHandler { action?: string; accept?: Record<string, string[]> }
interface Manifest {
  scope?: string;
  shortcuts?: Shortcut[];
  file_handlers?: FileHandler[];
  protocol_handlers?: Array<{ protocol?: string; url?: string }>;
  launch_handler?: { client_mode?: string };
  share_target?: {
    action?: string; method?: string; enctype?: string;
    params?: { files?: Array<{ name?: string; accept?: string[] }> };
  };
}

const manifest = JSON.parse(read('../../public/manifest.webmanifest')) as Manifest;
const MAIN = read('../main.ts');
const SW = read('../../public/sw.js');
const TAURI = read('../../../tauri-desktop/src-tauri/tauri.conf.json');

/** Every word main.ts answers in the `#/<word>` form (parseRoute's hash branch). */
const hashWords = new Set([...MAIN.matchAll(/parts\[0\] === '([a-z-]+)'/g)].map((m) => m[1]!));
/** Every word it answers as a single-segment PATH: the explicit branches plus the
 *  PATH_VIEWS table of view shortlinks. */
const pathWords = new Set([
  ...[...MAIN.matchAll(/pathParts\[0\] === '([a-z-]+)'/g)].map((m) => m[1]!),
  ...[...MAIN.matchAll(/^\s+'?([a-z-]+)'?:\s+\{ hash:/gm)].map((m) => m[1]!),
]);

/** Tool ids in the active profile's catalog - a bare `/<id>` shortcut is one of
 *  these (main.ts's last path branch) and nothing else. */
function toolIds(): Set<string> {
  for (const rel of ['../../../../catalog/tools/index.json', '../../../../brands/lolly-start/catalog/tools/index.json']) {
    if (!existsSync(at(rel))) continue;
    const index = JSON.parse(read(rel)) as { tools?: Array<{ id?: string }> };
    return new Set((index.tools ?? []).map((tool) => tool.id!).filter(Boolean));
  }
  return new Set();
}

// Path words main.ts keeps ONLY to rescue links minted before a rename (each one
// answers with a redirect to the canonical route). A shortcut is minted fresh on
// every install, so it must name the destination, not an old address of it.
const RETIRED_ALIASES = new Set(['pro', 'platform', 'capabilities', 'pdf', 'valid', 'v', 'tools', 'dashboard']);

describe('web app manifest: shortcuts resolve to live routes', () => {
  test('the route vocabulary was actually read out of main.ts', () => {
    // If a refactor changes how routes are written, these sets empty out and every
    // assertion below would pass by accident.
    assert.ok(hashWords.has('batch'), 'the hash route table must be readable');
    assert.ok(pathWords.has('design') && pathWords.has('profile'), 'the path route table must be readable');
    assert.ok(toolIds().has('qr-code'), 'the catalog index must be readable');
  });

  test('every shortcut url is in scope and mounts something', () => {
    const ids = toolIds();
    const shortcuts = manifest.shortcuts ?? [];
    assert.ok(shortcuts.length > 0, 'the manifest declares shortcuts');
    for (const shortcut of shortcuts) {
      const url = shortcut.url ?? '';
      assert.ok(url.startsWith('/'), `${shortcut.name}: a shortcut url must be in scope (${url})`);
      const parsed = new URL(url, 'https://lolly.tools');
      if (parsed.hash) {
        const word = parsed.hash.replace(/^#\/?/, '').split(/[?/]/)[0] ?? '';
        assert.ok(word === '' || hashWords.has(word),
          `${shortcut.name}: #/${word} is not a route main.ts mounts`);
        continue;
      }
      const first = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      if (first === '') continue;   // the gallery
      assert.ok(!RETIRED_ALIASES.has(first),
        `${shortcut.name}: /${first} is a kept alias for old links, not the canonical route`);
      assert.ok(pathWords.has(first) || ids.has(first),
        `${shortcut.name}: /${first} is neither a route nor a tool in this catalog`);
    }
  });
});

describe('web app manifest: the OS handoffs', () => {
  test('the installed app claims every file type the desktop app does', () => {
    const desktop = JSON.parse(TAURI) as {
      bundle?: { fileAssociations?: Array<{ ext?: string[] }> };
    };
    const wanted = (desktop.bundle?.fileAssociations ?? []).flatMap((a) => a.ext ?? []);
    assert.ok(wanted.length >= 15, 'the desktop declares .lolly plus its alternates');
    const claimed = new Set(
      (manifest.file_handlers ?? []).flatMap((h) => Object.values(h.accept ?? {}).flat()),
    );
    for (const ext of wanted) {
      assert.ok(claimed.has(`.${ext}`), `.${ext} is opened by the desktop app but not by the installed web app`);
    }
    assert.ok(
      (manifest.file_handlers ?? []).some((h) => Object.keys(h.accept ?? {}).includes('application/vnd.lolly+zip')),
      'the .lolly bundle keeps its own canonical MIME type',
    );
    for (const handler of manifest.file_handlers ?? []) {
      assert.ok((handler.action ?? '').startsWith('/'), 'a file handler opens an in-scope url');
    }
  });

  test('launching an already-open app focuses it rather than opening a second one', () => {
    assert.equal(manifest.launch_handler?.client_mode, 'focus-existing');
  });

  test('the protocol handler speaks the one scheme deep-link.ts reads', () => {
    const handler = (manifest.protocol_handlers ?? [])[0];
    assert.equal(handler?.protocol, 'web+lolly', 'a web app may only claim a web+ scheme');
    assert.ok(handler?.url?.includes('%s'), 'the launch url carries the link');
    // The param the launch url hands over is the one drop-router.ts takes off it.
    const param = new URL(handler?.url ?? '', 'https://lolly.tools').searchParams;
    const [name] = [...param.keys()];
    assert.equal(name, 'deep-link');
    assert.equal(deepLinkToHash('web+lolly://lab'), '#/lab', 'and the grammar accepts that spelling');
  });

  test('the share target posts where the service worker is listening', () => {
    const share = manifest.share_target;
    assert.equal(share?.method, 'POST');
    assert.equal(share?.enctype, 'multipart/form-data');
    const field = share?.params?.files?.[0];
    assert.ok((field?.accept ?? []).length > 0, 'the share target accepts files');
    assert.ok(SW.includes(`const SHARE_TARGET_PATH = '${share?.action}'`),
      'the worker intercepts exactly the path the manifest posts to');
    assert.ok(SW.includes(`getAll('${field?.name}')`),
      'and reads exactly the form field the manifest names');
  });
});
