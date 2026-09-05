// SPDX-License-Identifier: MPL-2.0
/**
 * tests/appstream.test.ts - AppStream font MetaInfo + .desktop generation. Structure
 * and XML escaping here; `appstreamcli validate` / `desktop-file-validate` clean is
 * checked in an openSUSE container (plan 197 section 11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontMetainfo, desktopEntry, metainfoPath } from '../engine/src/appstream.ts';

test('fontMetainfo has the required font-component structure', () => {
  const xml = fontMetainfo({
    id: 'com.acme.AcmeSans', name: 'Acme Sans', summary: 'The Acme Sans family',
    fontFamilies: ['Acme Sans', 'Acme Sans Bold'], projectLicense: 'OFL-1.1',
    developerName: 'Acme', url: 'https://acme.example', version: '1.0', epoch: 1756944000,
  });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<component type="font">/);
  assert.match(xml, /<id>com\.acme\.AcmeSans<\/id>/);
  assert.match(xml, /<metadata_license>CC0-1\.0<\/metadata_license>/); // default
  assert.match(xml, /<project_license>OFL-1\.1<\/project_license>/);
  assert.match(xml, /<font>Acme Sans<\/font>/);
  assert.match(xml, /<font>Acme Sans Bold<\/font>/);
  assert.match(xml, /<release version="1\.0" date="2025-09-04"\/>/);
});

test('fontMetainfo escapes XML metacharacters', () => {
  const xml = fontMetainfo({
    id: 'com.acme.X', name: 'A & B <C>', summary: 'x "y" & z',
    fontFamilies: ['A & B'], projectLicense: 'MIT',
  });
  assert.match(xml, /<name>A &amp; B &lt;C&gt;<\/name>/);
  assert.match(xml, /<font>A &amp; B<\/font>/);
  assert.doesNotMatch(xml, /<name>A & B/); // raw ampersand never leaks
});

test('metainfoPath matches the component id', () => {
  assert.equal(metainfoPath('com.acme.AcmeSans'), '/usr/share/metainfo/com.acme.AcmeSans.metainfo.xml');
});

test('desktopEntry has the required keys', () => {
  const d = desktopEntry({ name: 'Acme', exec: 'acme', icon: 'com.acme.App', comment: 'Acme app', categories: ['Graphics'] });
  assert.match(d, /^\[Desktop Entry\]/);
  assert.match(d, /\nType=Application\n/);
  assert.match(d, /\nName=Acme\n/);
  assert.match(d, /\nExec=acme\n/);
  assert.match(d, /\nIcon=com\.acme\.App\n/);
  assert.match(d, /\nCategories=Graphics;\n/);
});
