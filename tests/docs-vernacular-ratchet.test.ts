/**
 * The "ends in it" rules (owner-banned 2026-09-26): a heading that ends in "it"
 * is a hard ban in the docs sources, and a sentence that ends in "it" is a
 * ratchet. It is too common in the existing pages to ban at once, so each file
 * carries a count in scripts/vernacular-docs-baseline.json that may only go
 * down. The comment and UI-copy gates fold the sentence rule into their own
 * baselines; their tests cover that drift. The last test covers the hard ban
 * on a short assertion tacked on after a comma.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { ratchetDrift, BANNED_PHRASES, RATCHETED_PHRASES } from '../scripts/check-docs-vernacular.ts';
import { VERNACULAR_WHY } from '../scripts/lib/vernacular-why.ts';

test('the ratcheted docs phrases only go down', () => {
  const d = ratchetDrift();
  assert.deepStrictEqual(
    [
      ...d.over.map(x => `${x.file}: rose ${x.was} -> ${x.now}`),
      ...d.fresh.map(x => `${x.file}: new file with ${x.now} hit(s)`),
      ...d.under.map(x => `${x.file}: improved ${x.was} -> ${x.now}, record with node scripts/check-docs-vernacular.ts --write`),
    ],
    [],
    `Ratcheted phrase drift in docs sources.\n${VERNACULAR_WHY}`,
  );
});

test('a heading that ends in "it" is caught, and a heading that names the thing is not', () => {
  const rule = BANNED_PHRASES.find(p => p.what.startsWith('heading that ends in'));
  assert.ok(rule);
  for (const hit of ['## How to hold us to it', '### Hear it', '## Governance (when you want it)',
    '## Self-host it?', '<h2 class="x">What we made of it</h2>', '## Why *it*']) {
    assert.ok(rule.re.test(hit), `should flag: ${hit}`);
  }
  for (const pass of ['## Check these claims yourself', '## Hear the original', '## Ask IT',
    '## Commit', '## Use `it.skip` in tests', 'Plain prose that ends in it', '<p>Keep it</p>']) {
    assert.ok(!rule.re.test(pass), `should pass: ${pass}`);
  }
});

test('a sentence that ends in "it" is counted, and code tokens are not', () => {
  const rule = RATCHETED_PHRASES.find(p => p.what.startsWith('sentence that ends in'));
  assert.ok(rule);
  for (const hit of ['Here is how to check it.', 'A box you have not animated shows Animate, so press it.', 'Why use it?',
    'Say it!', 'Nothing else does (it).', '**Send it.** Every control', 'It.']) {
    assert.ok(rule.re.test(hit), `should flag: ${hit}`);
  }
  for (const pass of ['Talk to IT.', 'Use `it.skip` to park a test.', 'it.each works too', 'Commit.',
    'The word "its" ends here.', 'It is fine.', 'Wait for it...']) {
    assert.ok(!rule.re.test(pass), `should pass: ${pass}`);
  }
});

test('a short assertion after a comma is caught, and a tag that carries a fact is not', () => {
  // Owner-banned 2026-09-27, a hard ban like the heading rule above.
  const rule = BANNED_PHRASES.find(p => p.what.startsWith('short assertion after a comma'));
  assert.ok(rule);
  for (const hit of ['Replace the address with yours, in full.', '## Lifecycle, end to end',
    'Lint is not among them, by design.', '**Revocation, honestly: there is none.**',
    'It ships, on purpose, without a server.', '**Black out, for good.**',
    'Two slots, no more.', 'The same bytes, byte-for-byte.']) {
    assert.ok(rule.re.test(hit), `should flag: ${hit}`);
  }
  for (const pass of ['The full text is in full.md.', 'Quoted, verbatim: "a short-lived token".',
    'The file passes through, unchanged.', 'Check it by design review.', 'No more than two slots.',
    'In full screen, the canvas fills the window.', 'Built by design teams, for design teams.']) {
    assert.ok(!rule.re.test(pass), `should pass: ${pass}`);
  }
});
