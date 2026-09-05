// SPDX-License-Identifier: MPL-2.0
/**
 * tests/linux-pack.test.ts - the content-aware pack layer: planIconSet's hicolor
 * paths, and buildLinuxPack producing font / app-icon / generic RPMs whose payload
 * installs at the idiomatic paths. Payloads are listed with libarchive
 * (bsdtar reads a .rpm directly) when available; determinism is always checked.
 * The scriptlet + dependency correctness (fc-cache, gtk-update-icon-cache,
 * Requires: hicolor-icon-theme/fontconfig) is verified in an openSUSE container
 * (plan 197 section 11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { planIconSet } from '../engine/src/icon-set.ts';
import { buildLinuxPack, buildHomeTarball, packageRender } from '../engine/src/linux-pack.ts';
import { gunzipSync } from 'node:zlib';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const eq = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

function haveBsdtar(): boolean {
  try { execFileSync('bsdtar', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}
/** List the payload paths of a .rpm via libarchive. */
function payloadPaths(rpm: Uint8Array): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-lp-'));
  try {
    const p = join(dir, 'p.rpm');
    writeFileSync(p, rpm);
    return execFileSync('bsdtar', ['-tf', p], { encoding: 'utf8' }).trim().split('\n').map((s) => s.replace(/\/$/, '')).sort();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const META = { name: 'lolly-test', version: '1.0', release: '1', summary: 's', license: 'MIT' };

test('planIconSet places scalable, symbolic and raster at hicolor paths', () => {
  const plan = planIconSet([
    { id: 'org.acme.App', svg: enc('<svg/>'), symbolicSvg: enc('<svg/>'), rasters: [{ size: 48, png: Uint8Array.of(1) }] },
  ]);
  const paths = plan.files.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    '/usr/share/icons/hicolor/48x48/apps/org.acme.App.png',
    '/usr/share/icons/hicolor/scalable/apps/org.acme.App.svg',
    '/usr/share/icons/hicolor/symbolic/apps/org.acme.App-symbolic.svg',
  ]);
  assert.deepEqual(plan.requires, []); // icon cache via file trigger; no rpmlint-flagged theme require
  assert.match(plan.scriptlet, /gtk-update-icon-cache/);
});

test('planIconSet rejects an icon with no artwork', () => {
  assert.throws(() => planIconSet([{ id: 'x' }]), /no svg/);
});

test('font pack installs under /usr/share/fonts/<foundry> and is deterministic', async (t) => {
  const rpm = await buildLinuxPack({
    type: 'font',
    meta: { ...META, name: 'acme-fonts', license: 'OFL-1.1', summary: 'Acme fonts' },
    foundry: 'acme',
    fonts: [{ name: 'Acme-Regular.ttf', data: enc('FAKE-TTF') }, { name: 'Acme-Bold.ttf', data: enc('FAKE-TTF-BOLD') }],
  });
  assert.ok(eq(rpm, await buildLinuxPack({
    type: 'font', meta: { ...META, name: 'acme-fonts', license: 'OFL-1.1', summary: 'Acme fonts' },
    foundry: 'acme', fonts: [{ name: 'Acme-Regular.ttf', data: enc('FAKE-TTF') }, { name: 'Acme-Bold.ttf', data: enc('FAKE-TTF-BOLD') }],
  })), 'deterministic');

  if (!haveBsdtar()) { t.skip('no bsdtar'); return; }
  const paths = payloadPaths(rpm);
  assert.ok(paths.includes('./usr/share/fonts/acme/Acme-Regular.ttf'), 'regular font placed');
  assert.ok(paths.includes('./usr/share/fonts/acme/Acme-Bold.ttf'), 'bold font placed');
});

test('app-icons pack lands scalable SVG + desktop entry', async (t) => {
  const rpm = await buildLinuxPack({
    type: 'app-icons',
    meta: { ...META, name: 'acme-icons', summary: 'Acme icons' },
    icons: [{ id: 'org.acme.App', svg: enc('<svg/>') }],
    desktopEntries: [{ id: 'org.acme.App', data: enc('[Desktop Entry]\nName=Acme\nExec=acme\nIcon=org.acme.App\nType=Application\n') }],
  });
  if (!haveBsdtar()) { t.skip('no bsdtar'); return; }
  const paths = payloadPaths(rpm);
  assert.ok(paths.includes('./usr/share/icons/hicolor/scalable/apps/org.acme.App.svg'), 'scalable icon');
  assert.ok(paths.includes('./usr/share/applications/org.acme.App.desktop'), 'desktop entry');
});

test('buildHomeTarball strips leading / and is a readable .tar.gz', (t) => {
  const targz = buildHomeTarball([
    { path: '/.local/share/fonts/acme/Acme.ttf', data: enc('FONT') },
    { path: '.local/share/backgrounds/hero.svg', data: enc('<svg/>') },
  ]);
  // gzip magic
  assert.equal(targz[0], 0x1f); assert.equal(targz[1], 0x8b);
  const tar = new Uint8Array(gunzipSync(Buffer.from(targz)));
  assert.equal(tar.length % 512, 0, 'a whole number of tar blocks');
  if (!haveBsdtar()) { t.skip('no bsdtar'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'lolly-tgz-'));
  try {
    const p = join(dir, 'home.tar.gz'); writeFileSync(p, targz);
    const list = execFileSync('bsdtar', ['-tf', p], { encoding: 'utf8' }).trim().split('\n').sort();
    assert.deepEqual(list, ['.local/share/backgrounds/hero.svg', '.local/share/fonts/acme/Acme.ttf']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('packageRender wraps one render at dest/filename', async (t) => {
  const rpm = await packageRender({
    bytes: enc('<svg/>'), filename: 'hero.svg', dest: '/usr/share/backgrounds/acme/',
    meta: { ...META, name: 'acme-wallpapers', summary: 'Acme wallpapers', license: 'CC-BY-4.0' },
  });
  if (!haveBsdtar()) { t.skip('no bsdtar'); return; }
  assert.ok(payloadPaths(rpm).includes('./usr/share/backgrounds/acme/hero.svg'));
});

test('generic pack ships files verbatim', async (t) => {
  const rpm = await buildLinuxPack({
    type: 'generic',
    meta: { ...META, name: 'acme-data', summary: 'Acme data' },
    files: [{ path: '/usr/share/acme/data.json', data: enc('{}') }],
  });
  if (!haveBsdtar()) { t.skip('no bsdtar'); return; }
  assert.ok(payloadPaths(rpm).includes('./usr/share/acme/data.json'));
});
