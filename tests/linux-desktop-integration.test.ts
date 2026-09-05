// SPDX-License-Identifier: MPL-2.0
/**
 * Linux desktop integration - contract tests for plans/174-linux-desktop-home.md.
 *
 * Three build agents (rust / web / packaging) land their columns in parallel, so
 * every assertion here SKIPS with an actionable reason while its subject file does
 * not exist yet, and FAILS once it exists and violates the plan's contract. That
 * keeps the suite green mid-build and enforcing afterwards - re-run it at each
 * stage.
 *
 * What is held:
 *  1. IPC drift, both directions - every TS `invoke('desktop_*')` names a Rust
 *     `#[tauri::command]`, the plan's remaining contract commands all exist Rust-side,
 *     and each desktop_ command is reachable (listed in a generate_handler!).
 *  2. shared-mime-info XML - well-formed (parsed here, no xmllint dependency),
 *     declares the canonical MIME + `*.lolly` glob, and the MIME string cannot
 *     drift from LOLLY_MIME in shells/web/src/lib/lolly-pack.ts.
 *  3. .desktop files (linux/ + flatpak/) - [Desktop Entry] first, required keys,
 *     Actions= ids each have a [Desktop Action <id>] block, MimeType lists end
 *     with ';', Exec lines reference the lolly-desktop binary.
 *  4. GNOME search-provider .ini - required keys, and its BusName is actually
 *     granted by the flatpak manifest's --own-name.
 *  5. The thumbnailer script - run for real via python3 against a synthesized
 *     minimal lolly-share zip (PNG magic out, exit 0) and refusal cases (exit 1).
 *  6. tauri.conf.json bundle.fileAssociations names .lolly with the canonical MIME.
 *  7. systemd example units - basic ini shape, no ExecStart into a repo-absolute
 *     path that does not exist.
 *  8. AUR recipe (linux/arch/PKGBUILD + .SRCINFO) - mandatory fields, pinned
 *     pkgname/license spellings, the source URL derived from $pkgver on host
 *     lolli.li, real sha256 (64 hex, never SKIP), .SRCINFO generated-not-drifted
 *     against the PKGBUILD, and pkgver locked to tauri.conf.json's version so a
 *     release bump loudly demands the AUR ritual.
 *
 * All parsing here is intentionally small and local (INI + XML well-formedness) -
 * the point is zero extra dependencies so `npm test` stays green on a bare machine.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP_SHELL = path.join(ROOT, 'shells/tauri-desktop');
const SRC_TAURI_SRC = path.join(DESKTOP_SHELL, 'src-tauri/src');
const TAURI_CONF = path.join(DESKTOP_SHELL, 'src-tauri/tauri.conf.json');
const LINUX_DIR = path.join(DESKTOP_SHELL, 'linux');
const FLATPAK_DIR = path.join(DESKTOP_SHELL, 'flatpak');
const WEB_SRC = path.join(ROOT, 'shells/web/src');
const BRIDGE_OVERRIDES = path.join(DESKTOP_SHELL, 'bridge-overrides');

// The plan's IPC contract commands, verbatim ("The IPC contract" section), less
// the one plan 202 retired.
const CONTRACT_COMMANDS = [
  'desktop_pick_color',
  'desktop_set_wallpaper',
  'desktop_read_accent',
  'desktop_hotfolder_set',
  // desktop_clipboard_read was the sixth. Plan 202 WP4.1 removed its
  // #[tauri::command] and its lib.rs registration: no JS ever invoked it, and the
  // tray calls the plain Rust function directly. The function is still there, so
  // the behaviour plans/174 wanted is intact - only the IPC door is gone.
  'desktop_poll_events',
] as const;

// ── Shared helpers ────────────────────────────────────────────────────────────

// Build/vendor trees under flatpak/ are huge (extracted debs, cargo vendor dirs)
// and full of third-party .desktop/.service/.xml files that are not ours to lint.
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist',
  '.flatpak-builder', 'build-dir', 'repo', 'screenshots',
]);

/** Recursive file walk; [] when the root does not exist. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile()) out.push(p);
  }
  return out;
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

/** Read a `export const NAME = '...'` string literal straight from a source file -
 *  importing lolly-pack.ts would drag the whole web-shell module graph into a
 *  node:test process for the sake of two constants. A miss FAILS the caller so
 *  the constant cannot silently move out from under this drift guard. */
function readSourceConst(file: string, name: string): string {
  const src = readFileSync(file, 'utf8');
  const m = new RegExp(`export const ${name}\\s*=\\s*'([^']+)'`).exec(src);
  assert.ok(m, `expected \`export const ${name} = '...'\` in ${rel(file)} - the drift anchor moved; update this test's readSourceConst call site`);
  return m![1]!;
}

const canonicalMime = () => readSourceConst(path.join(WEB_SRC, 'lib/lolly-pack.ts'), 'LOLLY_MIME');
const canonicalExt = () => readSourceConst(path.join(WEB_SRC, 'lib/lolly-pack.ts'), 'LOLLY_EXT');

// ── Tiny INI parser (freedesktop .desktop / .ini / systemd units) ─────────────

interface IniEntry { key: string; value: string; line: number }
interface IniSection { name: string; line: number; entries: IniEntry[] }
interface IniFile { sections: IniSection[]; errors: string[] }

/** Parse the freedesktop/systemd INI dialect. Collects shape errors rather than
 *  throwing so a test can report every problem in a file at once. Duplicate keys
 *  are allowed (systemd's ExecStartPre repeats legitimately); `get` returns the
 *  first occurrence. */
function parseIni(text: string): IniFile {
  const sections: IniSection[] = [];
  const errors: string[] = [];
  let current: IniSection | null = null;
  const lines = text.split('\n');
  for (let n = 0; n < lines.length; n++) {
    let line = lines[n]!.replace(/\r$/, '');
    const lineNo = n + 1;
    // systemd line continuation - a trailing backslash joins the next line
    while (line.endsWith('\\') && n + 1 < lines.length) {
      n += 1;
      line = line.slice(0, -1) + ' ' + lines[n]!.replace(/\r$/, '');
    }
    const t = line.trim();
    if (t === '' || t.startsWith('#') || t.startsWith(';')) continue;
    const sec = /^\[([^\]]+)\]$/.exec(t);
    if (sec) {
      current = { name: sec[1]!, line: lineNo, entries: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      errors.push(`line ${lineNo}: entry before any [section] header`);
      continue;
    }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(t);
    if (!kv) {
      errors.push(`line ${lineNo}: not a Key=Value line: ${t.slice(0, 60)}`);
      continue;
    }
    const key = kv[1]!;
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*(\[[A-Za-z0-9@_.\-]+\])?$/.test(key)) {
      errors.push(`line ${lineNo}: malformed key '${key}'`);
      continue;
    }
    current.entries.push({ key, value: kv[2]!, line: lineNo });
  }
  return { sections, errors };
}

function iniGet(section: IniSection | undefined, key: string): string | undefined {
  return section?.entries.find((e) => e.key === key)?.value;
}

function iniSection(file: IniFile, name: string): IniSection | undefined {
  return file.sections.find((s) => s.name === name);
}

// ── Tiny XML well-formedness checker (no xmllint dependency) ──────────────────

/** Returns null when well-formed, else a human-readable error. Covers what a
 *  lint needs: balanced/matching tags, quoted attributes, one root, terminated
 *  comments/CDATA/PIs, no unescaped '&'. Not a validator - just enough that a
 *  broken mime XML or metainfo cannot land looking green. */
function xmlError(src: string): string | null {
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = src.length;
  const stack: string[] = [];
  let roots = 0;
  while (i < n) {
    const lt = src.indexOf('<', i);
    const text = src.slice(i, lt === -1 ? n : lt);
    if (/&(?!(?:[A-Za-z][A-Za-z0-9]*|#[0-9]+|#x[0-9a-fA-F]+);)/.test(text)) {
      return `unescaped '&' in text near "${text.trim().slice(0, 40)}"`;
    }
    if (text.trim() && stack.length === 0) return `text outside the root element: "${text.trim().slice(0, 40)}"`;
    if (lt === -1) break;
    i = lt;
    if (src.startsWith('<?', i)) {
      const e = src.indexOf('?>', i);
      if (e === -1) return 'unterminated <? ... ?>';
      i = e + 2; continue;
    }
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      if (e === -1) return 'unterminated comment';
      i = e + 3; continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i + 9);
      if (e === -1) return 'unterminated CDATA section';
      i = e + 3; continue;
    }
    if (src.startsWith('<!', i)) {
      const e = src.indexOf('>', i);
      if (e === -1) return 'unterminated <! ... > declaration';
      i = e + 1; continue;
    }
    const close = src.startsWith('</', i);
    const end = src.indexOf('>', i);
    if (end === -1) return `unterminated tag at offset ${i}`;
    let body = src.slice(i + (close ? 2 : 1), end);
    const selfClose = !close && body.endsWith('/');
    if (selfClose) body = body.slice(0, -1);
    const nameM = /^([A-Za-z_][\w.:\-]*)/.exec(body);
    if (!nameM) return `malformed tag <${body.slice(0, 30)}>`;
    const tag = nameM[1]!;
    if (close) {
      if (body.trim() !== tag) return `malformed closing tag </${body.trim()}>`;
      const open = stack.pop();
      if (open !== tag) return `mismatched </${tag}> (open element is <${open ?? 'none'}>)`;
    } else {
      let restAttrs = body.slice(tag.length);
      const attrRe = /^\s+[A-Za-z_][\w.:\-]*\s*=\s*("[^"<]*"|'[^'<]*')/;
      while (restAttrs.trim()) {
        const a = attrRe.exec(restAttrs);
        if (!a) return `malformed attribute in <${tag} ...>: "${restAttrs.trim().slice(0, 40)}"`;
        restAttrs = restAttrs.slice(a[0].length);
      }
      if (stack.length === 0) {
        roots += 1;
        if (roots > 1) return 'multiple root elements';
      }
      if (!selfClose) stack.push(tag);
    }
    i = end + 1;
  }
  if (stack.length) return `unclosed <${stack[stack.length - 1]}>`;
  if (roots === 0) return 'no root element';
  return null;
}

// ── 0. Linter self-checks ─────────────────────────────────────────────────────
// The XML/INI checkers above are local, dependency-free implementations - prove
// here that they actually reject the failure shapes the file tests rely on
// catching, so a parser bug can never turn the whole suite vacuously green.

test('self-check: xmlError rejects the malformations the lint depends on', () => {
  assert.equal(xmlError('<?xml version="1.0"?>\n<!-- c -->\n<a x="1"><b/>text<![CDATA[<raw>]]></a>'), null);
  assert.match(xmlError('<a><b></a>') ?? '', /mismatched/);
  assert.match(xmlError('<a attr=oops></a>') ?? '', /malformed attribute/);
  assert.match(xmlError('<a>&nope</a>') ?? '', /unescaped '&'/);
  assert.match(xmlError('<a/><b/>') ?? '', /multiple root/);
  assert.match(xmlError('<a><!-- never closed </a>') ?? '', /unterminated comment/);
  assert.match(xmlError('<a>') ?? '', /unclosed <a>/);
  assert.match(xmlError('hello') ?? '', /outside the root|no root/);
});

test('self-check: parseIni rejects the malformations the lint depends on', () => {
  const ok = parseIni('# c\n[Desktop Entry]\nType=Application\nName[en_AU]=G\n\n[Desktop Action new-qr]\nName=New QR\n');
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.sections[0]?.name, 'Desktop Entry');
  assert.equal(iniGet(iniSection(ok, 'Desktop Action new-qr'), 'Name'), 'New QR');
  assert.match(parseIni('Type=Application\n').errors[0] ?? '', /before any \[section\]/);
  assert.match(parseIni('[S]\njust some words\n').errors[0] ?? '', /not a Key=Value/);
  assert.match(parseIni('[S]\nbad key=v\n').errors[0] ?? '', /malformed key/);
  // systemd continuation joins lines into one value
  const cont = parseIni('[Service]\nExecStart=/usr/bin/foo \\\n  --flag\n');
  assert.equal(iniGet(iniSection(cont, 'Service'), 'ExecStart'), '/usr/bin/foo    --flag');
});

// ── 1. IPC drift ──────────────────────────────────────────────────────────────

/** All `#[tauri::command]` fn names in src-tauri/src (any other attributes may
 *  sit between the command attribute and the fn). */
function rustCommands(): Set<string> {
  const names = new Set<string>();
  for (const file of walk(SRC_TAURI_SRC).filter((f) => f.endsWith('.rs'))) {
    const src = readFileSync(file, 'utf8');
    const re = /#\[tauri::command[^\]]*\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/g;
    for (let m = re.exec(src); m; m = re.exec(src)) names.add(m[1]!);
  }
  return names;
}

/** Bodies of every `generate_handler![ ... ]` in src-tauri/src, concatenated. */
function generateHandlerBodies(): string[] {
  const bodies: string[] = [];
  for (const file of walk(SRC_TAURI_SRC).filter((f) => f.endsWith('.rs'))) {
    const src = readFileSync(file, 'utf8');
    const re = /generate_handler!\s*\[([\s\S]*?)\]/g;
    for (let m = re.exec(src); m; m = re.exec(src)) bodies.push(m[1]!);
  }
  return bodies;
}

/** Every command name passed to invoke()/tauriInvoke() in the web shell and the
 *  bridge-overrides - first string literal after the call opens, so a generic
 *  type argument (invoke<DesktopEvent[]>(...)) does not defeat the match.
 *  Co-located .test.ts files are excluded: a test stubbing an invoke name is
 *  not a call site the Rust side must serve. */
function tsInvokedCommands(): { all: Set<string>; sites: Map<string, string[]> } {
  const all = new Set<string>();
  const sites = new Map<string, string[]>();
  const files = [...walk(WEB_SRC), ...walk(BRIDGE_OVERRIDES)]
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const re = /\b(?:invoke|tauriInvoke)\b[^'"`]{0,200}?['"`]([A-Za-z0-9_]+)['"`]/gs;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      all.add(m[1]!);
      const list = sites.get(m[1]!) ?? [];
      list.push(rel(file));
      sites.set(m[1]!, list);
    }
  }
  return { all, sites };
}

test('ipc: extractors still see the live tree (canary)', () => {
  // If either scraper regex rots, every desktop_ assertion below would skip or
  // pass vacuously forever - so pin them to commands that exist today.
  const rust = rustCommands();
  assert.ok(rust.has('capture_page'), 'Rust command extractor found no capture_page - the #[tauri::command] regex no longer matches the tree');
  const { all } = tsInvokedCommands();
  assert.ok(all.has('capture_page'), 'TS invoke extractor found no capture_page call - the invoke() regex no longer matches bridge-overrides/capture.ts');
});

test('ipc: the plan\'s five remaining desktop_ contract commands exist Rust-side', (t) => {
  const rust = rustCommands();
  const desktop = [...rust].filter((n) => n.startsWith('desktop_'));
  if (desktop.length === 0) {
    return t.skip('no desktop_ #[tauri::command] in shells/tauri-desktop/src-tauri/src yet - rust agent owns it');
  }
  for (const name of CONTRACT_COMMANDS) {
    assert.ok(rust.has(name), `plans/174 contract command ${name} missing from src-tauri/src (have: ${desktop.sort().join(', ')})`);
  }
});

test('ipc: every TS invoke(\'desktop_*\') names an existing Rust command', (t) => {
  const rust = rustCommands();
  if (![...rust].some((n) => n.startsWith('desktop_'))) {
    return t.skip('no desktop_ #[tauri::command] in shells/tauri-desktop/src-tauri/src yet - rust agent owns it; TS call sites are checked once it lands');
  }
  const { all, sites } = tsInvokedCommands();
  for (const name of [...all].filter((n) => n.startsWith('desktop_'))) {
    assert.ok(rust.has(name), `TS invokes '${name}' (${(sites.get(name) ?? []).join(', ')}) but no #[tauri::command] fn ${name} exists in src-tauri/src`);
  }
});

test('ipc: every desktop_ command is registered in a generate_handler!', (t) => {
  const desktop = [...rustCommands()].filter((n) => n.startsWith('desktop_'));
  if (desktop.length === 0) {
    return t.skip('no desktop_ #[tauri::command] in shells/tauri-desktop/src-tauri/src yet - rust agent owns it');
  }
  const bodies = generateHandlerBodies();
  assert.ok(bodies.length > 0, 'no generate_handler![...] found in src-tauri/src - the registration extractor regex no longer matches');
  for (const name of desktop) {
    const registered = bodies.some((b) => new RegExp(`\\b${name}\\b`).test(b));
    assert.ok(registered, `#[tauri::command] fn ${name} exists but appears in no generate_handler![...] - it is unreachable from the webview`);
  }
});

// ── 2. shared-mime-info XML ───────────────────────────────────────────────────

const mimeXmlFiles = () => walk(path.join(LINUX_DIR, 'mime')).filter((f) => f.endsWith('.xml'));

test('mime xml: well-formed and declares the .lolly type + glob', (t) => {
  const files = mimeXmlFiles();
  if (files.length === 0) {
    return t.skip('shells/tauri-desktop/linux/mime/*.xml not built yet - packaging agent owns it');
  }
  const mime = canonicalMime();
  const ext = canonicalExt();
  let declares = false;
  let hasGlob = false;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const err = xmlError(src);
    assert.equal(err, null, `${rel(file)} is not well-formed XML: ${err}`);
    // Attribute-level reads are safe post-well-formedness; a full DOM would be overkill.
    if (new RegExp(`<mime-type[^>]*\\btype="${mime.replace('+', '\\+')}"`).test(src)) {
      declares = true;
      if (new RegExp(`<glob[^>]*\\bpattern="\\*${ext.replace('.', '\\.')}"`).test(src)) hasGlob = true;
      // Drift trap - any OTHER vnd.lolly MIME string in the XML is a typo'd sibling.
      const strays = [...src.matchAll(/type="(application\/[^"]*lolly[^"]*)"/g)]
        .map((m) => m[1]).filter((v) => v !== mime);
      assert.deepEqual(strays, [], `${rel(file)} declares a lolly MIME that is not LOLLY_MIME ('${mime}') from shells/web/src/lib/lolly-pack.ts: ${strays.join(', ')}`);
    }
  }
  assert.ok(declares, `no mime XML under linux/mime declares <mime-type type="${mime}"> (LOLLY_MIME in shells/web/src/lib/lolly-pack.ts)`);
  assert.ok(hasGlob, `the ${mime} <mime-type> has no <glob pattern="*${ext}"> - file managers will never match .lolly files`);
});

// ── 3. .desktop files ─────────────────────────────────────────────────────────

const desktopFiles = () => [...walk(LINUX_DIR), ...walk(FLATPAK_DIR)].filter((f) => f.endsWith('.desktop'));

test('.desktop files: entry shape, actions, mime lists, Exec target', (t) => {
  const files = desktopFiles();
  if (files.length === 0) {
    return t.skip('no .desktop files under shells/tauri-desktop/{linux,flatpak} yet - packaging agent owns them');
  }
  const mime = canonicalMime();
  for (const file of files) {
    const ini = parseIni(readFileSync(file, 'utf8'));
    assert.deepEqual(ini.errors, [], `${rel(file)}: INI shape errors:\n  ${ini.errors.join('\n  ')}`);
    assert.ok(ini.sections.length > 0, `${rel(file)}: no sections`);
    assert.equal(ini.sections[0]?.name, 'Desktop Entry', `${rel(file)}: first section must be [Desktop Entry], got [${ini.sections[0]?.name}]`);
    const entry = ini.sections[0];
    const type = iniGet(entry, 'Type');
    assert.ok(type, `${rel(file)}: [Desktop Entry] missing Type=`);
    assert.ok(iniGet(entry, 'Name'), `${rel(file)}: [Desktop Entry] missing Name=`);
    if (type === 'Application') {
      assert.ok(iniGet(entry, 'Exec'), `${rel(file)}: Type=Application entry missing Exec=`);
    }
    // Every Exec in the file (entry + actions) must launch our binary, not a stale name.
    for (const s of ini.sections) {
      const exec = iniGet(s, 'Exec');
      if (exec !== undefined) {
        assert.ok(exec.includes('lolly-desktop'), `${rel(file)} [${s.name}]: Exec does not reference lolly-desktop: '${exec}'`);
      }
    }
    // freedesktop multi-value lists terminate with ';' - MimeType is the one that
    // breaks associations silently when it doesn't.
    const mimeList = iniGet(entry, 'MimeType');
    if (mimeList !== undefined) {
      assert.ok(mimeList.endsWith(';'), `${rel(file)}: MimeType list must end with ';': '${mimeList}'`);
      if (type === 'Application') {
        assert.ok(mimeList.split(';').includes(mime), `${rel(file)}: Application MimeType= does not include the canonical '${mime}' (plans/174 feature 2)`);
      }
    }
    // Actions= - every id needs its [Desktop Action <id>] block, with Name+Exec.
    const actions = iniGet(entry, 'Actions');
    if (actions !== undefined) {
      assert.ok(actions.endsWith(';'), `${rel(file)}: Actions list must end with ';': '${actions}'`);
      for (const id of actions.split(';').filter(Boolean)) {
        const block = iniSection(ini, `Desktop Action ${id}`);
        assert.ok(block, `${rel(file)}: Actions= names '${id}' but there is no [Desktop Action ${id}] section`);
        assert.ok(iniGet(block!, 'Name'), `${rel(file)} [Desktop Action ${id}]: missing Name=`);
        assert.ok(iniGet(block!, 'Exec'), `${rel(file)} [Desktop Action ${id}]: missing Exec=`);
      }
    }
    // The reverse direction - an action block whose id was dropped from Actions= is dead.
    for (const s of ini.sections) {
      const m = /^Desktop Action (.+)$/.exec(s.name);
      if (m) {
        const ids = (actions ?? '').split(';').filter(Boolean);
        assert.ok(ids.includes(m[1]!), `${rel(file)}: [${s.name}] exists but '${m[1]}' is not listed in Actions= - unreachable action block`);
      }
    }
  }
});

// ── 4. GNOME search provider ──────────────────────────────────────────────────

/** The search-provider .ini is identified by content, not filename - it carries a
 *  [Shell Search Provider] section. */
function searchProviderInis(): { file: string; ini: IniFile }[] {
  return walk(LINUX_DIR)
    .filter((f) => f.endsWith('.ini'))
    .map((file) => ({ file, ini: parseIni(readFileSync(file, 'utf8')) }))
    .filter(({ ini }) => iniSection(ini, 'Shell Search Provider') !== undefined);
}

function flatpakOwnNames(): { grants: string[]; manifests: string[] } {
  const manifests = walk(FLATPAK_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  const grants: string[] = [];
  for (const file of manifests) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/--own-name=([^\s'"]+)/g)) grants.push(m[1]!);
  }
  return { grants, manifests: manifests.map(rel) };
}

test('search provider: .ini keys present', (t) => {
  const inis = searchProviderInis();
  if (inis.length === 0) {
    return t.skip('no [Shell Search Provider] .ini under shells/tauri-desktop/linux yet - packaging agent owns it');
  }
  for (const { file, ini } of inis) {
    assert.deepEqual(ini.errors, [], `${rel(file)}: INI shape errors:\n  ${ini.errors.join('\n  ')}`);
    const sec = iniSection(ini, 'Shell Search Provider')!;
    for (const key of ['BusName', 'ObjectPath', 'DesktopId', 'Version']) {
      assert.ok(iniGet(sec, key), `${rel(file)}: [Shell Search Provider] missing ${key}=`);
    }
    const objectPath = iniGet(sec, 'ObjectPath')!;
    assert.ok(objectPath.startsWith('/'), `${rel(file)}: ObjectPath must be an absolute D-Bus path, got '${objectPath}'`);
  }
});

test('search provider: BusName is granted by the flatpak --own-name', (t) => {
  const inis = searchProviderInis();
  if (inis.length === 0) {
    return t.skip('no [Shell Search Provider] .ini under shells/tauri-desktop/linux yet - packaging agent owns it');
  }
  const { grants, manifests } = flatpakOwnNames();
  if (grants.length === 0) {
    return t.skip(`no --own-name finish-arg in ${manifests.join(', ') || 'the flatpak manifests'} yet - packaging agent owns it; the sandboxed provider cannot claim its bus name without one`);
  }
  for (const { file, ini } of inis) {
    const busName = iniGet(iniSection(ini, 'Shell Search Provider')!, 'BusName')!;
    // A grant may be exact or a `prefix.*` wildcard.
    const granted = grants.some((g) => g === busName || (g.endsWith('.*') && busName.startsWith(g.slice(0, -1))));
    assert.ok(granted, `${rel(file)}: BusName=${busName} is not covered by any --own-name grant (${grants.join(', ')}) - GNOME Shell will activate a name the sandbox cannot own`);
  }
});

test('search provider: BusName has a matching D-Bus .service activation file', (t) => {
  const inis = searchProviderInis();
  if (inis.length === 0) {
    return t.skip('no [Shell Search Provider] .ini under shells/tauri-desktop/linux yet - packaging agent owns it');
  }
  // D-Bus activation files are .service files with a [D-BUS Service] section -
  // distinguished from systemd units by content (both use the extension).
  const dbusServices = walk(LINUX_DIR)
    .filter((f) => f.endsWith('.service'))
    .map((file) => ({ file, ini: parseIni(readFileSync(file, 'utf8')) }))
    .filter(({ ini }) => iniSection(ini, 'D-BUS Service') !== undefined);
  if (dbusServices.length === 0) {
    return t.skip('no [D-BUS Service] activation file under shells/tauri-desktop/linux yet - packaging agent owns it; GNOME activates the provider by bus name, so one must ship');
  }
  const names = dbusServices.map(({ file, ini }) => {
    const sec = iniSection(ini, 'D-BUS Service')!;
    assert.ok(iniGet(sec, 'Name'), `${rel(file)}: [D-BUS Service] missing Name=`);
    assert.ok(iniGet(sec, 'Exec'), `${rel(file)}: [D-BUS Service] missing Exec=`);
    return iniGet(sec, 'Name')!;
  });
  for (const { file, ini } of inis) {
    const busName = iniGet(iniSection(ini, 'Shell Search Provider')!, 'BusName')!;
    assert.ok(names.includes(busName), `${rel(file)}: BusName=${busName} has no D-Bus .service activation file (have: ${names.join(', ')})`);
  }
});

// ── 5. Thumbnailer ────────────────────────────────────────────────────────────

// A real 1x1 transparent PNG - the fixture thumb the script must decode and re-emit.
const PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function thumbnailerScript(): string | null {
  const dir = path.join(LINUX_DIR, 'thumbnailer');
  const hit = walk(dir).find((f) => path.basename(f).startsWith('lolly-thumbnail') && !f.endsWith('.thumbnailer'));
  return hit ?? null;
}

function python3(): boolean {
  return spawnSync('python3', ['--version'], { stdio: 'ignore' }).status === 0;
}

/** Build argv for the script from the shipped .thumbnailer Exec= line when there
 *  is one (so this test exercises the REAL registered invocation, flags and
 *  argument order included), else the conventional `<in> <out> <size>`. */
function thumbnailerArgv(input: string, output: string): string[] {
  const tnFile = walk(LINUX_DIR).find((f) => f.endsWith('.thumbnailer'));
  if (tnFile) {
    const exec = iniGet(iniSection(parseIni(readFileSync(tnFile, 'utf8')), 'Thumbnailer Entry'), 'Exec');
    if (exec) {
      const argv: string[] = [];
      for (const tok of exec.trim().split(/\s+/).slice(1)) { // slice(1): drop the program itself
        if (tok === '%i' || tok === '%u') argv.push(tok === '%u' ? `file://${input}` : input);
        else if (tok === '%o') argv.push(output);
        else if (tok === '%s') argv.push('128');
        else argv.push(tok); // literal flag like -s
      }
      if (argv.length > 0) return argv;
    }
  }
  return [input, output, '128'];
}

function runThumbnailer(manifest: Record<string, unknown>): { status: number | null; out: string; stderr: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'lolly-thumb-'));
  const input = path.join(dir, 'fixture.lolly');
  const out = path.join(dir, 'thumb.png');
  writeFileSync(input, zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) }));
  const res = spawnSync('python3', [thumbnailerScript()!, ...thumbnailerArgv(input, out)], { encoding: 'utf8', timeout: 30_000 });
  return { status: res.status, out, stderr: res.stderr ?? '' };
}

test('thumbnailer: emits a PNG for a lolly-share zip with a thumb', (t) => {
  const script = thumbnailerScript();
  if (!script) return t.skip('shells/tauri-desktop/linux/thumbnailer/lolly-thumbnail not built yet - packaging agent owns it');
  if (!python3()) return t.skip('python3 not on PATH - install it to exercise the thumbnailer');
  const { status, out, stderr } = runThumbnailer({
    format: 'lolly-share', formatVersion: 1, minReader: 1,
    thumb: `data:image/png;base64,${PNG_1X1_B64}`,
  });
  assert.equal(status, 0, `thumbnailer exited ${status} for a valid share zip; stderr: ${stderr.trim()}`);
  assert.ok(existsSync(out), 'thumbnailer exited 0 but wrote no output file');
  const bytes = readFileSync(out);
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'output is not a PNG (bad magic bytes) - file managers require image/png here');
});

test('thumbnailer: exits non-zero for a share zip with no thumb', (t) => {
  const script = thumbnailerScript();
  if (!script) return t.skip('shells/tauri-desktop/linux/thumbnailer/lolly-thumbnail not built yet - packaging agent owns it');
  if (!python3()) return t.skip('python3 not on PATH - install it to exercise the thumbnailer');
  // manifest.thumb is optional in practice (views/tool.ts's share path omits it) -
  // the script must exit non-zero so the file manager falls back to the generic icon.
  const { status, out } = runThumbnailer({ format: 'lolly-share', formatVersion: 1, minReader: 1 });
  assert.notEqual(status, 0, 'thumbnailer must exit non-zero when the manifest has no thumb');
  assert.ok(!existsSync(out) || readFileSync(out).length === 0, 'thumbnailer failed but still left an output file');
});

test('thumbnailer: exits non-zero for a brand pack', (t) => {
  const script = thumbnailerScript();
  if (!script) return t.skip('shells/tauri-desktop/linux/thumbnailer/lolly-thumbnail not built yet - packaging agent owns it');
  if (!python3()) return t.skip('python3 not on PATH - install it to exercise the thumbnailer');
  const { status } = runThumbnailer({ format: 'lolly-brand', formatVersion: 3, minReader: 1 });
  assert.notEqual(status, 0, 'thumbnailer must exit non-zero for a lolly-brand pack (generic icon, per plans/174 feature 3)');
});

test('thumbnailer: .thumbnailer registration names the script and the canonical MIME', (t) => {
  const tnFile = walk(LINUX_DIR).find((f) => f.endsWith('.thumbnailer'));
  if (!tnFile) return t.skip('no .thumbnailer registration file under shells/tauri-desktop/linux yet - packaging agent owns it');
  const ini = parseIni(readFileSync(tnFile, 'utf8'));
  assert.deepEqual(ini.errors, [], `${rel(tnFile)}: INI shape errors:\n  ${ini.errors.join('\n  ')}`);
  const sec = iniSection(ini, 'Thumbnailer Entry');
  assert.ok(sec, `${rel(tnFile)}: missing [Thumbnailer Entry] section`);
  const exec = iniGet(sec!, 'Exec');
  assert.ok(exec?.includes('lolly-thumbnail'), `${rel(tnFile)}: Exec does not reference lolly-thumbnail: '${exec}'`);
  const mimeList = iniGet(sec!, 'MimeType');
  assert.ok(mimeList, `${rel(tnFile)}: missing MimeType=`);
  assert.ok(mimeList!.endsWith(';'), `${rel(tnFile)}: MimeType list must end with ';': '${mimeList}'`);
  assert.ok(mimeList!.split(';').includes(canonicalMime()), `${rel(tnFile)}: MimeType= does not include '${canonicalMime()}'`);
});

// ── 6. tauri.conf.json fileAssociations ───────────────────────────────────────

test('tauri.conf: bundle.fileAssociations names .lolly with the canonical MIME', (t) => {
  const conf = JSON.parse(readFileSync(TAURI_CONF, 'utf8')) as {
    bundle?: { fileAssociations?: { ext?: string[]; mimeType?: string }[] };
  };
  const assocs = conf.bundle?.fileAssociations;
  if (!assocs) {
    return t.skip('bundle.fileAssociations not in shells/tauri-desktop/src-tauri/tauri.conf.json yet - rust agent owns that file');
  }
  // Tauri's schema takes bare extensions without the dot.
  const lolly = assocs.find((a) => (a.ext ?? []).some((e) => e.replace(/^\./, '') === 'lolly'));
  assert.ok(lolly, `bundle.fileAssociations exists but no entry covers the 'lolly' extension: ${JSON.stringify(assocs)}`);
  assert.equal(lolly!.mimeType, canonicalMime(), `fileAssociations mimeType for .lolly must be LOLLY_MIME ('${canonicalMime()}') from shells/web/src/lib/lolly-pack.ts`);
});

// ── 7. systemd example units ──────────────────────────────────────────────────

/** Systemd units are .service/.timer/.path files with a [Unit]/[Service]/[Timer]
 *  section and no [D-BUS Service] - content classification again, because D-Bus
 *  activation files share the .service extension. */
function systemdUnits(): { file: string; ini: IniFile }[] {
  return walk(LINUX_DIR)
    .filter((f) => /\.(service|timer|path)$/.test(f))
    .map((file) => ({ file, ini: parseIni(readFileSync(file, 'utf8')) }))
    .filter(({ ini }) => iniSection(ini, 'D-BUS Service') === undefined);
}

test('systemd example units: ini shape and ExecStart paths', (t) => {
  const units = systemdUnits();
  if (units.length === 0) {
    return t.skip('no systemd example units under shells/tauri-desktop/linux yet - packaging agent owns them');
  }
  for (const { file, ini } of units) {
    assert.deepEqual(ini.errors, [], `${rel(file)}: INI shape errors:\n  ${ini.errors.join('\n  ')}`);
    assert.ok(iniSection(ini, 'Unit'), `${rel(file)}: missing [Unit] section`);
    if (file.endsWith('.service')) {
      const svc = iniSection(ini, 'Service');
      assert.ok(svc, `${rel(file)}: missing [Service] section`);
      const execs = svc!.entries.filter((e) => e.key === 'ExecStart' || e.key === 'ExecStartPre' || e.key === 'ExecStartPost');
      assert.ok(execs.length > 0, `${rel(file)}: [Service] has no ExecStart=`);
      for (const e of execs) {
        // Any absolute path token that points into THIS repo must exist - a unit
        // example referencing a since-moved script rots silently otherwise.
        // systemd specifiers (%h etc.) and $VARs are opaque, and system paths
        // (/usr/bin/...) can't be verified on a dev machine, so only repo paths
        // are held.
        for (const rawTok of e.value.split(/\s+/)) {
          const tok = rawTok.replace(/^[-@+!:]+/, '');
          if (tok.includes('%') || tok.includes('$')) continue;
          if (tok.startsWith(ROOT + path.sep)) {
            assert.ok(existsSync(tok), `${rel(file)} line ${e.line}: ${e.key} references repo-absolute path '${tok}' which does not exist`);
          }
        }
      }
    }
  }
});

// ── Cross-cutting: every shipped XML under linux/ + flatpak/ stays well-formed ─

test('xml lint: all shipped XML under linux/ and flatpak/ is well-formed', () => {
  // Runs today (the flatpak metainfo already ships) - no skip. Broken XML here is
  // dropped silently by appstreamcli/update-mime-database, so it must never land.
  const files = [...walk(LINUX_DIR), ...walk(FLATPAK_DIR)].filter((f) => f.endsWith('.xml'));
  assert.ok(files.length > 0, 'expected at least the flatpak metainfo.xml - the walker excludes are eating real files');
  for (const file of files) {
    const err = xmlError(readFileSync(file, 'utf8'));
    assert.equal(err, null, `${rel(file)} is not well-formed XML: ${err}`);
  }
});

// ── 8. AUR recipe (PKGBUILD + .SRCINFO) ───────────────────────────────────────
// The -bin package repacks the official deb, so the recipe is pure data: a
// PKGBUILD whose every fatal AUR mistake is a *textual* one - a hand-bumped URL
// that forgot pkgver, a SKIP checksum, a .SRCINFO regenerated last release.
// Same policy as above: hand-rolled parsers (no bash execution - `makepkg` does
// not exist on this machine and the point is linting the text, not building),
// skip while agent-owned files are absent, fail once present-and-wrong.

const ARCH_DIR = path.join(LINUX_DIR, 'arch');
const PKGBUILD_PATH = path.join(ARCH_DIR, 'PKGBUILD');
const SRCINFO_PATH = path.join(ARCH_DIR, '.SRCINFO');

interface PkgbuildAssign { values: string[]; raw: string; line: number }
interface Pkgbuild { vars: Map<string, PkgbuildAssign>; errors: string[] }

/** Index of the first ')' outside single/double quotes, or -1. */
function unquotedParen(text: string): number {
  let q: "'" | '"' | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q === "'") { if (c === "'") q = null; continue; }
    if (q === '"') { if (c === '"') q = null; else if (c === '\\') i++; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '#') { const nl = text.indexOf('\n', i); if (nl === -1) return -1; i = nl; continue; }
    if (c === ')') return i;
  }
  return -1;
}

/** Split a PKGBUILD value into shell words, honouring quotes and # comments.
 *  Deliberately no globbing/expansion here - expansion is a separate pass so the
 *  RAW text stays inspectable (the $pkgver-in-source check needs it). */
function shellWords(text: string, errors: string[], where: string): string[] {
  const words: string[] = [];
  let cur = '';
  let started = false;
  let q: "'" | '"' | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q === "'") { if (c === "'") q = null; else cur += c; continue; }
    if (q === '"') {
      if (c === '"') q = null;
      else if (c === '\\' && i + 1 < text.length) { cur += text[++i]!; }
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') { q = c; started = true; continue; }
    if (c === '\\' && i + 1 < text.length) { cur += text[++i]!; started = true; continue; }
    if (c === '#' && !started) { const nl = text.indexOf('\n', i); if (nl === -1) break; i = nl; continue; }
    if (/\s/.test(c)) { if (started) { words.push(cur); cur = ''; started = false; } continue; }
    cur += c; started = true;
  }
  if (q) errors.push(`${where}: unterminated ${q === "'" ? 'single' : 'double'} quote`);
  if (started) words.push(cur);
  return words;
}

/** Parse top-level `name=value` / `name=(array)` assignments. Column-0 anchored
 *  on purpose: package()/build() bodies are indented, so function-local
 *  assignments never shadow the metadata this lint reads. */
function parsePkgbuild(src: string): Pkgbuild {
  const vars = new Map<string, PkgbuildAssign>();
  const errors: string[] = [];
  const lines = src.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(lines[n]!.replace(/\r$/, ''));
    if (!m) continue;
    const name = m[1]!;
    const startLine = n + 1;
    let text: string;
    if (m[2]!.startsWith('(')) {
      let buf = m[2]!.slice(1);
      let close = unquotedParen(buf);
      while (close === -1 && n + 1 < lines.length) {
        n++;
        buf += '\n' + lines[n]!.replace(/\r$/, '');
        close = unquotedParen(buf);
      }
      if (close === -1) { errors.push(`line ${startLine}: unterminated array ${name}=(...`); continue; }
      text = buf.slice(0, close);
    } else {
      text = m[2]!;
    }
    vars.set(name, { values: shellWords(text, errors, `line ${startLine} (${name}=)`), raw: text, line: startLine });
  }
  return { vars, errors };
}

/** Expand $name / ${name} against parsed scalar vars, iterated so nested
 *  references (source using $pkgname AND $pkgver) settle. Unknown names are left
 *  as-is - the assertions then fail loudly on the visible '$', which is right. */
function expandPkgbuildVars(value: string, pb: Pkgbuild): string {
  let out = value;
  for (let round = 0; round < 5; round++) {
    const next = out.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (whole, braced, bare) => {
      const v = pb.vars.get((braced ?? bare) as string);
      return v && v.values.length === 1 ? v.values[0]! : whole;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Parse .SRCINFO - `key = value` lines under pkgbase/pkgname headers. This
 *  recipe is single-package, so one flat multimap is the honest model; the
 *  pkgbase/pkgname header VALUES are still captured for the name check. */
function parseSrcinfo(src: string): { entries: Map<string, string[]>; errors: string[] } {
  const entries = new Map<string, string[]>();
  const errors: string[] = [];
  const lines = src.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const t = lines[n]!.replace(/\r$/, '').trim();
    if (t === '' || t.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t);
    if (!m) { errors.push(`line ${n + 1}: not a 'key = value' line: ${t.slice(0, 60)}`); continue; }
    const list = entries.get(m[1]!) ?? [];
    list.push(m[2]!);
    entries.set(m[1]!, list);
  }
  return { entries, errors };
}

/** All source-shaped array names, base + arch-suffixed (source_x86_64 etc.), so
 *  the comparison below cannot be defeated by moving the deb under an arch key. */
function keysMatching(prefix: string, names: Iterable<string>): string[] {
  return [...names].filter((k) => k === prefix || k.startsWith(`${prefix}_`)).sort();
}

test('self-check: parsePkgbuild/parseSrcinfo reject and read the shapes the AUR lint depends on', () => {
  const pb = parsePkgbuild([
    'pkgname=lolly-desktop-bin',
    'pkgver=9.9.9',
    "arch=('x86_64') # one line, with a comment",
    'depends=(', "  'gtk3'", '  webkit2gtk-4.1', ')',
    'source=("lolly-desktop-${pkgver}_amd64.deb::https://lolli.li/lolly-desktop-${pkgver}_amd64.deb")',
    '  indented=ignored-function-body-assignment',
  ].join('\n'));
  assert.deepEqual(pb.errors, []);
  assert.equal(pb.vars.get('pkgname')?.values[0], 'lolly-desktop-bin');
  assert.deepEqual(pb.vars.get('arch')?.values, ['x86_64']);
  assert.deepEqual(pb.vars.get('depends')?.values, ['gtk3', 'webkit2gtk-4.1']);
  assert.ok(!pb.vars.has('indented'), 'indented assignments are function-body locals, not metadata');
  assert.equal(
    expandPkgbuildVars(pb.vars.get('source')!.values[0]!, pb),
    'lolly-desktop-9.9.9_amd64.deb::https://lolli.li/lolly-desktop-9.9.9_amd64.deb',
  );
  assert.match(parsePkgbuild('broken=(never closed').errors[0] ?? '', /unterminated array/);
  assert.match(parsePkgbuild("bad='no close\n").errors[0] ?? '', /unterminated single/);
  const si = parseSrcinfo('pkgbase = lolly-desktop-bin\n\tpkgver = 9.9.9\n\tdepends = gtk3\n\tdepends = webkit2gtk-4.1\n\npkgname = lolly-desktop-bin\n');
  assert.deepEqual(si.errors, []);
  assert.deepEqual(si.entries.get('depends'), ['gtk3', 'webkit2gtk-4.1']);
  assert.match(parseSrcinfo('just words\n').errors[0] ?? '', /not a 'key = value'/);
});

test('aur: PKGBUILD mandatory fields, pinned spellings, source URL and checksum shape', (t) => {
  if (!existsSync(PKGBUILD_PATH)) {
    return t.skip('shells/tauri-desktop/linux/arch/PKGBUILD not built yet - packaging agent owns it');
  }
  const pb = parsePkgbuild(readFileSync(PKGBUILD_PATH, 'utf8'));
  assert.deepEqual(pb.errors, [], `PKGBUILD parse errors:\n  ${pb.errors.join('\n  ')}`);

  // Mandatory fields. source/sha256sums may legitimately be arch-suffixed
  // (source_x86_64=) - either spelling satisfies presence, both get linted below.
  for (const name of ['pkgname', 'pkgver', 'pkgrel', 'arch', 'url', 'license', 'depends']) {
    assert.ok(pb.vars.has(name), `PKGBUILD missing mandatory field ${name}=`);
  }
  const sourceKeys = keysMatching('source', pb.vars.keys());
  const sumKeys = keysMatching('sha256sums', pb.vars.keys());
  assert.ok(sourceKeys.length > 0, 'PKGBUILD missing source= (or source_<arch>=)');
  assert.ok(sumKeys.length > 0, 'PKGBUILD missing sha256sums= (or sha256sums_<arch>=)');

  assert.equal(pb.vars.get('pkgname')!.values[0], 'lolly-desktop-bin',
    `pkgname must be lolly-desktop-bin (the AUR repack of the official deb), got '${pb.vars.get('pkgname')!.values[0]}'`);
  assert.match(pb.vars.get('pkgver')!.values[0] ?? '', /^[0-9]+(\.[0-9]+)*$/,
    `pkgver must be a plain dotted version, got '${pb.vars.get('pkgver')!.values[0]}'`);
  assert.match(pb.vars.get('pkgrel')!.values[0] ?? '', /^[0-9]+$/,
    `pkgrel must be a bare integer, got '${pb.vars.get('pkgrel')!.values[0]}'`);
  // The official deb is amd64-only, so 'any'/'i686' would promise installs the
  // package cannot honour.
  assert.deepEqual(pb.vars.get('arch')!.values, ['x86_64'],
    `arch must be exactly ('x86_64') - the upstream artifact is an amd64 deb - got (${pb.vars.get('arch')!.values.join(' ')})`);
  assert.equal((pb.vars.get('url')!.values[0] ?? '').replace(/\/$/, ''), 'https://lolly.tools',
    `url must be the upstream https://lolly.tools, got '${pb.vars.get('url')!.values[0]}'`);
  // License spelling is pinned to the SPDX identifier: Arch switched to SPDX
  // (RFC 16, 2023) and current AUR packages ship 'MPL-2.0'; 'MPL2' is the
  // pre-SPDX legacy spelling namcap now flags.
  assert.deepEqual(pb.vars.get('license')!.values, ['MPL-2.0'],
    `license must be exactly ('MPL-2.0') (SPDX per Arch RFC 16; not the legacy 'MPL2'), got (${pb.vars.get('license')!.values.join(' ')})`);

  // Runtime needs of the shipped payload. The binary links these three, so they
  // are hard depends; /usr/bin/lolly-thumbnail is a python3 script but degrades
  // gracefully (exit 1 = generic icon), so python may legitimately sit in
  // optdepends instead - what is enforced is that it is declared SOMEWHERE.
  const deps = pb.vars.get('depends')!.values.map((d) => d.replace(/[<>=].*$/, ''));
  for (const need of ['webkit2gtk-4.1', 'gtk3', 'libayatana-appindicator']) {
    assert.ok(deps.includes(need), `depends must include ${need} (the binary links it); have: ${deps.join(', ')}`);
  }
  const optdeps = (pb.vars.get('optdepends')?.values ?? []).map((d) => d.split(':')[0]!.replace(/[<>=].*$/, ''));
  assert.ok(deps.includes('python') || optdeps.includes('python'),
    `python must be declared in depends or optdepends - the shipped /usr/bin/lolly-thumbnail is a python3 script; depends: ${deps.join(', ')}; optdepends: ${optdeps.join(', ') || 'none'}`);

  // The deb source entry: derived from $pkgver (so a version bump cannot leave
  // the URL behind), fetched from lolli.li, filename carrying the version.
  const pkgver = pb.vars.get('pkgver')!.values[0]!;
  const allSources = sourceKeys.flatMap((k) => pb.vars.get(k)!.values.map((v) => ({ raw: v, expanded: expandPkgbuildVars(v, pb) })));
  const deb = allSources.find((s) => s.expanded.replace(/^[^:]*::/, '').endsWith('.deb'));
  assert.ok(deb, `no source entry fetches a .deb; sources: ${allSources.map((s) => s.expanded).join(', ')}`);
  assert.match(deb!.raw, /\$\{?pkgver\}?/,
    `the deb source entry must reference \${pkgver}, not hard-code a version - '${deb!.raw}' would silently keep fetching the old deb after a pkgver bump`);
  const urlPart = deb!.expanded.replace(/^[^:]*::/, ''); // strip AUR filename::url rename prefix
  const host = /^https:\/\/([^/]+)\//.exec(urlPart)?.[1];
  assert.equal(host, 'lolli.li', `deb source URL host must be lolli.li, got '${host ?? urlPart}'`);
  assert.ok(urlPart.slice(urlPart.lastIndexOf('/') + 1).includes(pkgver),
    `deb source filename must embed pkgver ${pkgver}: '${urlPart}'`);

  // Checksums: real hashes only. SKIP on a remote binary is the AUR cardinal sin -
  // it turns every install into "run whatever lolli.li serves today".
  for (const key of sumKeys) {
    const sums = pb.vars.get(key)!.values;
    assert.ok(sums.length > 0, `${key}= is empty`);
    for (const sum of sums) {
      assert.notEqual(sum.toUpperCase(), 'SKIP', `${key}= contains SKIP - a remote binary source must carry its real sha256`);
      assert.match(sum, /^[0-9a-f]{64}$/, `${key}= entry is not 64 lowercase hex chars: '${sum}'`);
    }
    assert.equal(sums.length, (pb.vars.get(key.replace(/^sha256sums/, 'source'))?.values ?? []).length,
      `${key}= has ${sums.length} entries but its source array has ${(pb.vars.get(key.replace(/^sha256sums/, 'source'))?.values ?? []).length} - they must pair 1:1`);
  }
});

test('aur: .SRCINFO is the PKGBUILD, not a drifted hand-maintained copy', (t) => {
  if (!existsSync(PKGBUILD_PATH)) {
    return t.skip('shells/tauri-desktop/linux/arch/PKGBUILD not built yet - packaging agent owns it');
  }
  if (!existsSync(SRCINFO_PATH)) {
    return t.skip('shells/tauri-desktop/linux/arch/.SRCINFO not built yet - generate it with `makepkg --printsrcinfo > .SRCINFO` (AUR reads only .SRCINFO, so a PKGBUILD without one never publishes)');
  }
  const pb = parsePkgbuild(readFileSync(PKGBUILD_PATH, 'utf8'));
  const si = parseSrcinfo(readFileSync(SRCINFO_PATH, 'utf8'));
  assert.deepEqual(pb.errors, [], `PKGBUILD parse errors:\n  ${pb.errors.join('\n  ')}`);
  assert.deepEqual(si.errors, [], `.SRCINFO parse errors:\n  ${si.errors.join('\n  ')}`);

  const ritual = 'regenerate it: makepkg --printsrcinfo > .SRCINFO';
  assert.equal(si.entries.get('pkgbase')?.[0], pb.vars.get('pkgname')?.values[0], `.SRCINFO pkgbase != PKGBUILD pkgname - ${ritual}`);
  assert.equal(si.entries.get('pkgname')?.[0], pb.vars.get('pkgname')?.values[0], `.SRCINFO pkgname != PKGBUILD pkgname - ${ritual}`);
  for (const scalar of ['pkgver', 'pkgrel'] as const) {
    assert.equal(si.entries.get(scalar)?.[0], pb.vars.get(scalar)?.values[0],
      `.SRCINFO ${scalar} (${si.entries.get(scalar)?.[0]}) != PKGBUILD ${scalar} (${pb.vars.get(scalar)?.values[0]}) - the classic AUR drift; ${ritual}`);
  }
  assert.deepEqual(si.entries.get('depends') ?? [], pb.vars.get('depends')?.values ?? [],
    `.SRCINFO depends != PKGBUILD depends - ${ritual}`);
  assert.deepEqual(si.entries.get('license') ?? [], pb.vars.get('license')?.values ?? [],
    `.SRCINFO license != PKGBUILD license - ${ritual}`);

  // source/sha256sums compare per exact key (base or arch-suffixed), with the
  // PKGBUILD side expanded - makepkg writes .SRCINFO expanded, so raw-vs-raw
  // would never match and expanded-vs-expanded is the generated truth.
  for (const prefix of ['source', 'sha256sums'] as const) {
    const pbKeys = keysMatching(prefix, pb.vars.keys());
    const siKeys = keysMatching(prefix, si.entries.keys());
    assert.deepEqual(siKeys, pbKeys, `.SRCINFO ${prefix} keys (${siKeys.join(', ') || 'none'}) != PKGBUILD's (${pbKeys.join(', ') || 'none'}) - ${ritual}`);
    for (const key of pbKeys) {
      const expanded = pb.vars.get(key)!.values.map((v) => expandPkgbuildVars(v, pb));
      assert.deepEqual(si.entries.get(key) ?? [], expanded,
        `.SRCINFO ${key} != PKGBUILD ${key} (expanded) - ${ritual}`);
    }
  }
});

test('aur: PKGBUILD pkgver matches tauri.conf.json version', (t) => {
  if (!existsSync(PKGBUILD_PATH)) {
    return t.skip('shells/tauri-desktop/linux/arch/PKGBUILD not built yet - packaging agent owns it');
  }
  const pb = parsePkgbuild(readFileSync(PKGBUILD_PATH, 'utf8'));
  const pkgver = pb.vars.get('pkgver')?.values[0];
  const appVersion = (JSON.parse(readFileSync(TAURI_CONF, 'utf8')) as { version?: string }).version;
  assert.ok(appVersion, 'tauri.conf.json has no version field - the drift anchor moved; update this test');
  // The recipe may trail a release by hours, never silently by a version. If this
  // fails right after a version bump, that is BY DESIGN - it is the reminder to do
  // the AUR ritual, spelled out in the message below.
  assert.equal(pkgver, appVersion,
    `PKGBUILD pkgver (${pkgver}) != tauri.conf.json version (${appVersion}). The recipe may trail a release by hours, never silently by a version - this failure IS the reminder to do the AUR ritual: bump pkgver (reset pkgrel to 1), update sha256sums for the new deb, regenerate .SRCINFO (makepkg --printsrcinfo > .SRCINFO), and push both to the AUR.`);
});
