// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressAfterLinkPassword, linkPasswordRefusal, standardPdfPasswordIsTypable, withoutLinkPassword } from './export-password.ts';

const SECRET = 'Zq7-right-password';

test('a link can lock a pdf and a zip, and nothing else', () => {
  assert.equal(linkPasswordRefusal('pdf', { password: SECRET }), null);
  assert.equal(linkPasswordRefusal('zip', { password: SECRET }), null);
  assert.equal(linkPasswordRefusal('zip', { password: 'пароль123' }), null, 'a ZIP password is its bytes');
  for (const format of ['png', 'svg', 'jpg', 'html', 'mp4']) {
    assert.match(linkPasswordRefusal(format, { password: SECRET })!, new RegExp(`"${format}" file cannot carry a password, so nothing was written`));
  }
  assert.match(linkPasswordRefusal('pdf-cmyk', { password: SECRET })!, /Strong lock in the export panel/);
  assert.match(linkPasswordRefusal('pdf', { password: SECRET, bleed: '3mm' })!, /bleed or print marks/);
  assert.match(linkPasswordRefusal('pdf', { password: SECRET, marks: { crop: true } })!, /bleed or print marks/);
  assert.match(linkPasswordRefusal('pdf', { password: 'пароль123' })!, /plain ASCII/);
});

test('no refusal repeats the password', () => {
  for (const words of [linkPasswordRefusal('png', { password: SECRET }), linkPasswordRefusal('pdf-cmyk', { password: SECRET }), linkPasswordRefusal('pdf', { password: SECRET, bleed: '3mm' }), linkPasswordRefusal('pdf', { password: 'пароль123' })]) {
    assert.ok(words && !words.includes(SECRET) && !words.includes('пароль123'));
  }
});

test('the standard PDF tier takes printable ASCII only', () => {
  assert.equal(standardPdfPasswordIsTypable('plain ascii ~1!'), true);
  for (const password of ['café', 'пароль', '密码', 'tab\there', '']) assert.equal(standardPdfPasswordIsTypable(password), false, password);
});

test('the password leaves a query and every other value keeps its form', () => {
  assert.equal(withoutLinkPassword('url=a%20b&format=pdf'), 'url=a%20b&format=pdf', 'a query with no password is not rewritten');
  assert.equal(withoutLinkPassword(`url=a&password=${SECRET}&format=pdf&export`), 'url=a&format=pdf&export=');
  assert.equal(withoutLinkPassword(`password=${SECRET}`), '');
  assert.equal(withoutLinkPassword('passwordless=1'), 'passwordless=1', 'only the parameter itself');
});

test('a reload of the address cannot write the same file again without its lock', () => {
  assert.equal(addressAfterLinkPassword(`url=a&format=pdf&password=${SECRET}&export`), 'url=a&format=pdf');
  assert.equal(addressAfterLinkPassword(`url=a&format=pdf&password=${SECRET}&copy`), 'url=a&format=pdf');
});
