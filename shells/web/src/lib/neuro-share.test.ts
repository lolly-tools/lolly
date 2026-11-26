// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkTo, momentParts, readNeuroShare, shareableId, shareRoute, withoutNeuroShare } from './neuro-share.ts';

const at = (url: string) => { const u = new URL(url); return { pathname: u.pathname, search: u.search, hash: u.hash }; };

test('a moment link reads back as the track, the bar or second, and the visualiser look', () => {
  const station = linkTo('https://lolly.tools', '/', '#/', ['lofi=jazz.123456', ...momentParts({ bar: 11, viz: { preset: 'tunnel', scheme: '0c322c', tint: 'subtle', cycle: 20 } })]);
  assert.equal(station, 'https://lolly.tools/#/?lofi=jazz.123456&ns.at=11&ns.viz=tunnel&ns.colours=0c322c&ns.tint=subtle&ns.cycle=20');
  assert.deepEqual(readNeuroShare(at(station)), { moment: { bar: 11, viz: { preset: 'tunnel', scheme: '0c322c', tint: 'subtle', cycle: 20 } } });
  const radio = linkTo('https://lolly.tools', '/', '#/u', [`listen=${encodeURIComponent('radio/somafm/groovesalad')}`, ...momentParts({ seconds: 83.4, viz: { preset: 'Geiss - Spiral Artifact (2) [mix]' } })]);
  const read = readNeuroShare(at(radio));
  assert.equal(read?.listen, 'radio/somafm/groovesalad');
  assert.equal(read?.moment.seconds, 83);
  assert.equal(read?.moment.viz?.preset, 'Geiss - Spiral Artifact (2) [mix]', 'an artist preset name survives the trip');
  assert.equal(readNeuroShare(at('https://lolly.tools/#/u?q=jazz')), null, 'nothing shared, nothing read');
  // The address's search is read too, after the hash.
  assert.equal(readNeuroShare({ hash: '#/', search: '?listen=lolly%2Fmusic%2Fbed' })?.listen, 'lolly/music/bed');
});

test('anything malformed or device-only in a link is left out', () => {
  const read = readNeuroShare({ hash: '#/?listen=user%2Fmy-song&ns.at=-3&ns.t=999999&ns.viz=%3Cscript%3E&ns.colours=%23fff%22&ns.tint=loud&ns.cycle=7', search: '' });
  assert.deepEqual(read, { moment: {} });
  assert.equal(shareableId('user/audio/abc'), false, 'an upload stays on its device');
  assert.equal(shareableId('lofi:jazz'), false, 'a station travels as its tune, not its id');
  assert.equal(shareableId('radio/somafm/groovesalad'), true);
  assert.equal(shareableId('lolly/music/sunrise'), true);
  // Only valid values are written into a link.
  assert.deepEqual(momentParts({ bar: -1, seconds: Number.NaN, viz: { preset: '<b>', scheme: 'x y', tint: 'loud', cycle: 3 } }), []);
});

test('the shared track and moment come out of the address after they are applied, and nothing else does', () => {
  assert.equal(withoutNeuroShare(at('https://lolly.tools/#/u?q=jazz&listen=radio%2Fsomafm%2Fx&ns.at=3&ns.viz=tunnel')), '/#/u?q=jazz');
  assert.equal(withoutNeuroShare({ pathname: '/', search: '?listen=a%2Fb&lang=fr', hash: '#/?ns.tint=full' }), '/?lang=fr#/');
  assert.equal(withoutNeuroShare(at('https://lolly.tools/#/?lofi=jazz.1')), '/#/?lofi=jazz.1', 'a tune link is left for its own reader');
});

test('a link lands on the gallery, utilities or assets as it is, and on the gallery from anywhere else', () => {
  assert.equal(shareRoute(''), '#/');
  assert.equal(shareRoute('#/'), '#/');
  assert.equal(shareRoute('#/u?q=x'), '#/u');
  assert.equal(shareRoute('#/assets'), '#/assets');
  assert.equal(shareRoute('#/tool/qr-code?url=x'), '#/', 'a tool with its own settings is not where a song lands');
  assert.equal(shareRoute('#/projects/abc'), '#/', 'nor is someone\'s own project');
});
