// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA 2.4 text bindings, WRITE side: section A.7 HTML documents, section A.9 structured text,
 * and the Lolly HTML-fragment profile.
 * Run with: node --test tests/c2pa-text-write.test.ts
 *
 * Ground truth is the C2PA Technical Specification 2.4, section A.7.1.1/section A.7.1.3 and
 * section A.9.3.1/section A.9.4, read verbatim. The read side (M1: c2pa-extract.ts +
 * c2pa-verify.ts) is the verifier here - every fixture goes place → extract →
 * verify, and the exclusion the writer declares is checked against the range the
 * READER derives from the document's own bytes (report.textBinding.exclusionsConform
 * must stay absent: any value means writer and validator disagree about where the
 * carrier is).
 *
 * HONEST LIMIT, restated from plan 105 section 5: c2pa-rs implements none of section A.7/section A.8/
 * section A.9, so there is no external validator to cross-check against. Written-then-
 * read-by-ourselves is necessary but NOT sufficient - a shared misreading of the
 * spec passes this suite. That is why the offsets below are asserted against the
 * spec's own wording (the excluded slice must literally start at `<script` and end
 * at `</script>`; the armour exclusion must literally start at the newline before
 * the block) rather than against whatever the reader happens to return.
 *
 * Deep imports throughout - engine/src/index.ts is another session's file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedC2pa, attachC2paStore, C2PA_FORMATS, C2PA_FRAGMENT_PROFILE } from '../engine/src/c2pa-containers.ts';
import { extractC2paDetailed, extractC2paStore, sniffFormat } from '../engine/src/c2pa-extract.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const textOf = (b: Uint8Array): string => Array.from(b, (c) => String.fromCharCode(c)).join('');
const fakeStore = (n = 240, fill = 0x41): Uint8Array => new Uint8Array(n).fill(fill);

const OPTS = {
  title: 'Fixture',
  claimGenerator: 'Lolly lolly.tools',
  generatorInfo: { name: 'Lolly', version: '1.9.0' },
  environment: { tool: 'Fixture Tool', format: '', surface: 'test', engine: 'node', os: 'test' },
  author: { name: 'Testy McTestface' },
};

// ─── fixtures ─────────────────────────────────────────────────────────────────
// Each host exercises the placement constraint its format actually has: the HTML
// document has a real <head> AND a doctype on line 1; the JS has a shebang (the
// section A.9.3.1 "first line is reserved" case); the fragment has no <head> at all,
// which is the whole reason the Lolly profile exists.

const HTML_DOC = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Example</title>\n</head>\n<body>\n<p>Content here.</p>\n</body>\n</html>\n';
const JS_SRC = '#!/usr/bin/env node\nexport const answer = 42;\n';
const CSS_SRC = ':root { --brand: #30ba78; }\n.masthead { color: var(--brand); }\n';
const MD_SRC = '# Title\n\nSome prose about provenance.\n';
const FRAGMENT = '<figure class="masthead">\n  <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>\n</figure>\n';

const HOSTS: Record<string, string> = {
  html: HTML_DOC, js: JS_SRC, css: CSS_SRC, md: MD_SRC, 'html-fragment': FRAGMENT,
};
const TEXT_FORMATS = Object.keys(HOSTS);
const ARMOR_FORMATS = ['js', 'css', 'md', 'html-fragment'];

const ARMOR_BEGIN = '-----BEGIN C2PA MANIFEST-----';
const ARMOR_END = '-----END C2PA MANIFEST-----';

/** A byte of ORIGINAL host content, outside every exclusion. The armour formats
 *  exclude everything from the last host newline to EOF, so their tamper target
 *  is the front of the file; the HTML document's carrier sits in the head, so
 *  its tail is original content. */
const tamperOffset = (fmt: string, out: Uint8Array): number => (fmt === 'html' ? out.length - 1 : 0);

/** The single exclusion the reader derives from the placed file's own bytes. */
const ex1 = (out: Uint8Array): { start: number; length: number } => {
  const ex = extractC2paDetailed(out)?.exclusions;
  assert.equal(ex?.length, 1, 'exactly one exclusion');
  return ex![0]!;
};

// ─── registration ─────────────────────────────────────────────────────────────

test('the five text formats are registered, appended, and none displaced an old slot', () => {
  const list = [...C2PA_FORMATS];
  assert.deepEqual(list.slice(-5), ['html', 'js', 'css', 'md', 'html-fragment']);
  // The pre-2.4 slots keep their exact positions - shells key export formats off
  // this list, so an id may only ever join the end.
  assert.deepEqual(list.slice(0, -5), ['pdf', 'pdf-cmyk', 'png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'tiff', 'cmyk-tiff', 'webp', 'mp4', 'avif', 'm4a', 'webm', 'mp3', 'wav', 'ogg', 'opus']);
  assert.ok(Object.isFrozen(C2PA_FORMATS));
});

test('the fragment profile names itself honestly and is frozen', () => {
  assert.deepEqual({ ...C2PA_FRAGMENT_PROFILE }, { format: 'html-fragment', mime: 'text/html' });
  assert.ok(Object.isFrozen(C2PA_FRAGMENT_PROFILE));
  assert.ok(C2PA_FORMATS.includes(C2PA_FRAGMENT_PROFILE.format));
});

// ─── round-trips ──────────────────────────────────────────────────────────────

for (const fmt of TEXT_FORMATS) {
  test(`${fmt}: embed → extract → verify, then tamper breaks the binding`, async () => {
    const host = bytesOf(HOSTS[fmt]!);
    const out = await embedC2pa(host, fmt, { ...OPTS, environment: { ...OPTS.environment, format: fmt } });

    // The carrier is discoverable by sniffing alone - no caller-supplied format.
    assert.equal(sniffFormat(out), fmt === 'html' ? 'html' : 'code', `${fmt}: sniffs to its carrier`);

    const read = extractC2paDetailed(out);
    assert.ok(read?.store, `${fmt}: a store comes back out`);
    assert.equal(read!.status, undefined, `${fmt}: carrier is usable - ${read!.detail ?? ''}`);
    assert.equal(read!.exclusions?.length, 1, `${fmt}: section A.7.1.3/section A.9.4 declare exactly one exclusion`);

    const report = await verifyC2pa(out);
    assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
    assert.equal(report.madeWithLolly, true);
    assert.equal(report.environment?.format, fmt);
    assert.equal(report.claim?.title, 'Fixture');
    // The writer's declared exclusion and the reader's own reading of the
    // document agree EXACTLY: any value here means they disagree.
    assert.equal(report.textBinding?.exclusionsConform, undefined, `${fmt}: writer/validator exclusion agreement`);
    assert.equal(report.textBinding?.kind, fmt === 'html' ? 'html' : 'structuredText');

    // The host survives verbatim: take the exclusion back out and the original
    // file is what remains - for the armour formats minus its final newline,
    // which is the one section A.9.4 puts inside the exclusion.
    const bin = textOf(out);
    const ex = ex1(out);
    assert.equal(bin.slice(0, ex.start) + bin.slice(ex.start + ex.length),
      fmt === 'html' ? HOSTS[fmt] : HOSTS[fmt]!.slice(0, -1), `${fmt}: host content is intact`);

    const tampered = out.slice();
    const at = tamperOffset(fmt, out);
    tampered[at] = tampered[at]! ^ 0x01;
    const broken = await verifyC2pa(tampered);
    assert.equal(broken.state, 'invalid', `${fmt}: tamper at ${at}`);
    assert.ok(broken.checks.some((c) => c.code === 'assertion.dataHash.mismatch' && !c.ok), JSON.stringify(broken.checks));
  });
}

// ─── the exclusions, against the spec's own wording ───────────────────────────

test('section A.7.1.3: the exclusion is the WHOLE script element, opening tag through closing tag', async () => {
  const out = await embedC2pa(bytesOf(HTML_DOC), 'html', OPTS);
  const bin = textOf(out);
  const ex = extractC2paDetailed(out)!.exclusions![0]!;
  const carved = bin.slice(ex.start, ex.start + ex.length);
  assert.ok(carved.startsWith('<script type="application/c2pa">'), 'starts at the opening <script tag');
  assert.ok(carved.endsWith('</script>'), 'ends at the closing </script> tag, inclusive');
  // …and nothing but the element: what remains is the host, byte for byte.
  assert.equal(bin.slice(0, ex.start) + bin.slice(ex.start + ex.length), HTML_DOC);
  // section A.7.1.1: in the head. The base64 is one unbroken RFC 4648 section 4 run.
  assert.ok(ex.start < bin.indexOf('</head>'), 'the element sits inside <head>');
  assert.match(carved, /^<script type="application\/c2pa">[A-Za-z0-9+/]+={0,2}<\/script>$/);
});

test('section A.9.4: the exclusion runs from the newline BEFORE the block to end of file', async () => {
  for (const fmt of ARMOR_FORMATS) {
    const out = await embedC2pa(bytesOf(HOSTS[fmt]!), fmt, OPTS);
    const bin = textOf(out);
    const ex = extractC2paDetailed(out)!.exclusions![0]!;
    assert.equal(bin[ex.start], '\n', `${fmt}: exclusion starts at a newline`);
    assert.equal(ex.start + ex.length, bin.length, `${fmt}: …and runs to end of file`);
    // The block is one comment LINE (section A.9.3.1 single-line form), not the
    // front-matter shape - the only thing between that newline and EOF.
    const carved = bin.slice(ex.start + 1, ex.length + ex.start);
    assert.equal(carved.split('\n').filter(Boolean).length, 1, `${fmt}: a single comment line`);
    assert.ok(carved.includes(`${ARMOR_BEGIN} data:application/c2pa;base64,`), `${fmt}: section A.9.3.1 data: URI form`);
    assert.ok(carved.includes(ARMOR_END), `${fmt}: closing delimiter present`);
    // Everything outside the exclusion is the untouched host.
    assert.equal(bin.slice(0, ex.start), HOSTS[fmt]!.slice(0, -1), `${fmt}: host bytes unchanged`);
  }
});

test('each armour host wears its own comment syntax, js AND css with the /*! preservation hint', async () => {
  // section A.9.3.1: "When host formats define comment conventions that signal toolchains
  // to preserve specific comments (e.g., comments beginning with /*! in JavaScript
  // and CSS), claim generators should use them for the reference line." The clause
  // names BOTH languages, and the failure it prevents is concrete: a minifier that
  // honours /*! drops a `//` line, so a signed .js would lose its credential the
  // first time it went through a build. The `//` in section A.9.3.3.1's table is an
  // example of comment styles, not a requirement.
  const shapes: Record<string, RegExp> = {
    js: /^\/\*! -----BEGIN C2PA MANIFEST----- data:/m,
    css: /^\/\*! -----BEGIN C2PA MANIFEST----- data:/m,
    md: /^<!-- -----BEGIN C2PA MANIFEST----- data:/m,
    'html-fragment': /^<!-- -----BEGIN C2PA MANIFEST----- data:/m,
  };
  const closers: Record<string, string> = { js: `${ARMOR_END} */\n`, css: `${ARMOR_END} */\n`, md: `${ARMOR_END} -->\n`, 'html-fragment': `${ARMOR_END} -->\n` };
  for (const fmt of ARMOR_FORMATS) {
    const bin = textOf(await embedC2pa(bytesOf(HOSTS[fmt]!), fmt, OPTS));
    assert.match(bin, shapes[fmt]!, `${fmt}: comment prefix`);
    assert.ok(bin.endsWith(closers[fmt]!), `${fmt}: comment suffix closes the line`);
  }
});

// ─── section A.9.3.1's reserved first line ───────────────────────────────────────────

test('a reserved first line is never disturbed: shebang, XML prolog, doctype', async () => {
  // section A.9.3.1: "When the first line of the file is reserved by the host format
  // (e.g., a shebang line #!/… in scripts, or an XML declaration <?xml …?> in XML
  // documents), the manifest block shall be placed at the end of the file so that
  // the -----END C2PA MANIFEST----- delimiter appears on the last line."
  const cases: Array<[string, string]> = [
    ['js', '#!/usr/bin/env node\nprocess.exit(0);\n'],
    ['md', '<?xml version="1.0" encoding="UTF-8"?>\n<doc>markup with a prolog</doc>\n'],
    ['html-fragment', '<?xml version="1.0" encoding="UTF-8"?>\n<figure><b>hi</b></figure>\n'],
    ['css', '@charset "utf-8";\n:root { --x: 1 }\n'],
  ];
  for (const [fmt, src] of cases) {
    const out = await embedC2pa(bytesOf(src), fmt, OPTS);
    const bin = textOf(out);
    const firstLine = src.slice(0, src.indexOf('\n') + 1);
    assert.ok(bin.startsWith(firstLine), `${fmt}: line 1 is byte-identical`);
    // The END delimiter is on the last line (a trailing terminator still leaves
    // it there - it is the line's terminator, not a new line).
    const lines = bin.split('\n');
    assert.ok(lines[lines.length - 1] === '', `${fmt}: file ends with a terminator`);
    assert.ok(lines[lines.length - 2]!.includes(ARMOR_END), `${fmt}: END is on the last line`);
    assert.equal((await verifyC2pa(out)).state, 'valid', `${fmt}: verifies`);
  }
  // section A.7's carrier goes in the head, so an HTML doctype is equally untouched.
  const html = await embedC2pa(bytesOf(HTML_DOC), 'html', OPTS);
  assert.ok(textOf(html).startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>'), 'the doctype and root tag stay at byte 0');
});

// ─── line endings (section A.9.4) ────────────────────────────────────────────────────

test('CRLF hosts get a CRLF block, and the exclusion still starts at the LF', async () => {
  const src = 'const a = 1;\r\nconst b = 2;\r\n';
  const out = await embedC2pa(bytesOf(src), 'js', OPTS);
  const bin = textOf(out);
  assert.ok(bin.startsWith(src), 'host bytes unchanged, CRLF included');
  assert.ok(bin.endsWith(`${ARMOR_END} */\r\n`), 'the block is terminated CRLF, like its host');
  assert.equal(bin.split('\n').length - 1, 3, 'exactly one line was added');
  const ex = extractC2paDetailed(out)!.exclusions![0]!;
  // section A.9.4 says "the newline character preceding the manifest block" - the LF,
  // which leaves the CR before it inside the hashed content.
  assert.equal(bin[ex.start], '\n');
  assert.equal(bin[ex.start - 1], '\r');
  assert.equal(ex.start + ex.length, bin.length);
  assert.equal((await verifyC2pa(out)).state, 'valid');
});

test('a MIXED-ending host gets LF and keeps its own endings untouched', async () => {
  // section A.9.4: "A claim generator shall not alter the line ending convention of the
  // file content outside the manifest block." Nothing is rewritten; the
  // terminator we INTRODUCE is LF unless every host newline is already CRLF.
  const src = 'a();\r\nb();\nc();';
  const out = await embedC2pa(bytesOf(src), 'js', OPTS);
  const bin = textOf(out);
  assert.ok(bin.startsWith(src), 'the mixed host is preserved verbatim');
  assert.equal(bin[src.length], '\n', 'the separator we add is a bare LF');
  assert.ok(bin.endsWith(`${ARMOR_END} */\n`));
  assert.equal((await verifyC2pa(out)).state, 'valid');
});

test('section A.9.4: a terminator the placer INTRODUCED is inside the exclusion, both its bytes', async () => {
  // section A.9.4: "A claim generator shall not alter the line ending convention of the
  // file content outside the manifest block." A CRLF host with no trailing
  // terminator used to get one appended and then excluded from the LF only - 
  // leaving the CR the placer itself wrote INSIDE the hashed content, so the
  // bound bytes ended in a bare CR, the one convention section A.9.4 declares
  // unsupported. The introduced terminator belongs to the block, not the host.
  // Read WHICH bytes were hashed straight out of the credential: the data-hash
  // assertion carries the digest verbatim, so finding sha256(host) in the store
  // - and not finding sha256(host + CR) - settles it without decoding CBOR.
  const digest = async (s: string): Promise<Uint8Array> =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytesOf(s) as unknown as BufferSource));
  const carries = (hay: Uint8Array, needle: Uint8Array): boolean => {
    for (let i = 0; i + needle.length <= hay.length; i++) {
      let k = 0;
      while (k < needle.length && hay[i + k] === needle[k]) k++;
      if (k === needle.length) return true;
    }
    return false;
  };
  for (const [eol, src] of [['\r\n', 'const a = 1;\r\nconst b = 2;'], ['\n', 'const a = 1;\nconst b = 2;']] as const) {
    const out = await embedC2pa(bytesOf(src), 'js', OPTS);
    const bin = textOf(out);
    const store = extractC2paStore(out)!.store;
    assert.ok(carries(store, await digest(src)), `${JSON.stringify(eol)}: the binding covers the host, byte for byte`);
    assert.ok(!carries(store, await digest(src + eol[0]!)), '…and not a terminator byte the host never had');
    assert.equal(bin.slice(0, src.length), src, 'the host itself is untouched');
    assert.ok(bin.endsWith(`${ARMOR_END} */${eol}`), 'the block wears the host convention');
    // The reader offers the CR reading as an equally-valid alternate
    // (armorExclusion), so writer and validator still agree.
    const report = await verifyC2pa(out);
    assert.equal(report.state, 'valid');
    assert.equal(report.textBinding?.exclusionsConform, undefined, 'writer and validator agree on the range');
  }
});

test('bare-CR hosts are refused rather than silently converted', () => {
  // section A.9.4: bare CR "is not supported by this method … Such files shall be
  // converted to LF or CRLF before embedding" - and converting them here would be
  // the very alteration the next sentence forbids.
  for (const fmt of ARMOR_FORMATS) {
    assert.throws(() => attachC2paStore(bytesOf('a();\rb();\r'), fmt, fakeStore()), /bare CR line endings/, fmt);
  }
  // A lone CR anywhere is enough, even with CRLF elsewhere.
  assert.throws(() => attachC2paStore(bytesOf('a();\r\nb();\rc();\n'), 'js', fakeStore()), /bare CR line endings/);
});

// ─── the two-pass placer contract ─────────────────────────────────────────────

test('placement is content-independent - and, for these placers, length-independent too', () => {
  // embedC2pa's contract is "bytes outside the exclusions depend only on manifest
  // LENGTH". Both text placers are stronger: the carrier is spliced whole into a
  // region that is entirely inside the exclusion, so the bytes outside it depend
  // on the HOST alone. Assert the stronger property - if it ever weakens to the
  // documented one, this is where it shows up.
  for (const fmt of TEXT_FORMATS) {
    const host = bytesOf(HOSTS[fmt]!);
    const a = attachC2paStore(host, fmt, fakeStore(300, 0x58));
    const b = attachC2paStore(host, fmt, fakeStore(300, 0x59));
    assert.equal(a.length, b.length, `${fmt}: same length in, same length out`);
    const long = attachC2paStore(host, fmt, fakeStore(900, 0x58));
    const outside = (out: Uint8Array): string => {
      const ex = extractC2paDetailed(out)!.exclusions![0]!;
      const bin = textOf(out);
      return bin.slice(0, ex.start) + bin.slice(ex.start + ex.length);
    };
    assert.equal(outside(a), outside(b), `${fmt}: content does not move other bytes`);
    assert.equal(outside(a), outside(long), `${fmt}: neither does length`);
    assert.notEqual(textOf(a), textOf(b), `${fmt}: the payload itself did change`);
  }
});

test('the placed store comes back byte-for-byte', () => {
  const store = fakeStore(512, 0x7f);
  for (const fmt of TEXT_FORMATS) {
    const out = attachC2paStore(bytesOf(HOSTS[fmt]!), fmt, store);
    const ex = extractC2paDetailed(out);
    assert.ok(ex?.store, `${fmt}: extracted`);
    assert.deepEqual([...ex!.store!], [...store], `${fmt}: identical`);
  }
});

// ─── re-place / replace-existing ──────────────────────────────────────────────

test('re-placing REPLACES: one carrier, newest credential wins, and it is idempotent', async () => {
  for (const fmt of TEXT_FORMATS) {
    const host = bytesOf(HOSTS[fmt]!);
    const once = await embedC2pa(host, fmt, OPTS);
    const twice = await embedC2pa(once, fmt, { ...OPTS, title: 'Second Pass' });
    const report = await verifyC2pa(twice);
    assert.equal(report.state, 'valid', `${fmt}: ${JSON.stringify(report.checks.filter((c) => !c.ok))}`);
    assert.equal(report.claim?.title, 'Second Pass', `${fmt}: newest credential wins`);
    assert.equal(report.textBinding?.exclusionsConform, undefined, `${fmt}: re-place keeps exclusion agreement`);
    const bin = textOf(twice);
    if (fmt === 'html') {
      assert.equal(bin.split('<script type="application/c2pa">').length - 1, 1, 'exactly one script carrier');
    } else {
      assert.equal(bin.split(ARMOR_BEGIN).length - 1, 1, `${fmt}: exactly one armour block`);
      assert.equal(bin.split(ARMOR_END).length - 1, 1, `${fmt}: …and one closing delimiter`);
    }
    // Placing the same store twice is a fixed point - no drift, no growth.
    const store = fakeStore(256, 0x33);
    const p1 = attachC2paStore(host, fmt, store);
    assert.deepEqual([...attachC2paStore(p1, fmt, store)], [...p1], `${fmt}: idempotent`);
  }
});

test('section A.7.1: an existing <link rel="c2pa-manifest"> is removed, never left beside the script', async () => {
  // "An HTML document … shall not contain both a script element and a link
  // element referencing a C2PA Manifest Store."
  const src = '<!DOCTYPE html>\n<html><head><link rel="c2pa-manifest" href="/x.c2pa" type="application/c2pa">\n<title>t</title></head><body>hi</body></html>\n';
  const out = await embedC2pa(bytesOf(src), 'html', OPTS);
  const bin = textOf(out);
  assert.ok(!bin.includes('c2pa-manifest'), 'the external association is gone');
  assert.ok(bin.includes('<title>t</title>'), 'the rest of the head survived');
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.textBinding?.status, undefined, 'no multipleManifests');
});

test('a carrier hidden in an HTML comment is stripped too - the validator counts it', async () => {
  // The reader's scan does not mask comments, so a leftover in one would be a
  // second association and manifest.html.multipleManifests. Strip what the
  // VALIDATOR counts, even where a browser would not.
  const src = '<!DOCTYPE html>\n<html><head>\n<!-- <script type="application/c2pa">QQ==</script> -->\n<title>t</title></head><body>x</body></html>\n';
  const out = await embedC2pa(bytesOf(src), 'html', OPTS);
  assert.equal(textOf(out).split('<script type="application/c2pa">').length - 1, 1);
  assert.equal((await verifyC2pa(out)).state, 'valid');
});

test('a document that only implies a head gets a real one, where section A.7.1.4 looks', async () => {
  for (const src of ['<!doctype html>\n<p>bare</p>\n', '<html>\n<body><p>no head</p></body>\n</html>\n']) {
    const out = await embedC2pa(bytesOf(src), 'html', OPTS);
    const bin = textOf(out);
    assert.match(bin, /<head><script type="application\/c2pa">[A-Za-z0-9+/=]+<\/script><\/head>/, src);
    if (bin.includes('<body')) assert.ok(bin.indexOf('<head>') < bin.indexOf('<body'), 'the head precedes the body');
    const report = await verifyC2pa(out);
    assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
    // section A.7.1.1 placement note: the reader only adds `detail` when the element is
    // outside the head. Absent means it landed where the spec says.
    assert.equal(report.textBinding?.detail, undefined, 'the element is in the head');
  }
});

test('a comment mentioning <html> does not attract the splice', async () => {
  const src = '<!-- see the <html> version -->\n<!DOCTYPE html>\n<html><head><title>t</title></head><body>x</body></html>\n';
  const out = await embedC2pa(bytesOf(src), 'html', OPTS);
  const bin = textOf(out);
  assert.ok(bin.startsWith('<!-- see the <html> version -->\n'), 'the comment is untouched');
  assert.ok(bin.indexOf('<script type="application/c2pa">') > bin.indexOf('<head>'), 'the element went into the real head');
  assert.equal((await verifyC2pa(out)).state, 'valid');
});

// ─── the Lolly fragment profile ───────────────────────────────────────────────

test('a fragment carrying inline SVG still reads as structured text, not as an SVG', async () => {
  // The masthead/figure artifacts are markup + inline SVG with no <head>. section A.7
  // has nowhere to put its element, and the sniffer must not hand the file to the
  // SVG reader (which would look for a <c2pa:manifest> that is not there).
  const out = await embedC2pa(bytesOf(FRAGMENT), 'html-fragment', { ...OPTS, environment: { ...OPTS.environment, format: 'html-fragment' } });
  assert.equal(sniffFormat(out), 'code');
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.equal(report.textBinding?.kind, 'structuredText');
  assert.ok(textOf(out).includes('<svg viewBox="0 0 10 10"'), 'the artwork is untouched');
  // WHERE THE PROFILE LABEL HAS TO COME FROM. The container declares
  // `text/html` to buildC2paManifest - but the v2 claim carries no `dc:format`
  // at all (c2pa.ts: "the v2 claim drops dc:format"), so `report.claim.format`
  // is undefined here and for every other format too. A reader therefore cannot
  // recover "this is the Lolly fragment profile" from the claim; the signal that
  // DOES survive is the export environment the signer records.
  assert.equal(report.claim?.format, undefined, 'v2 claims carry no dc:format - not a fragment-profile signal');
  assert.equal(report.environment?.format, 'html-fragment', 'the export environment is what names the profile');
});

// ─── refusals and hostile hosts ───────────────────────────────────────────────

test('section A.9.3: an existing block is replaced, but ambiguity is refused not guessed', () => {
  const store = fakeStore();
  // Two blocks: section A.9.3 already makes this file unreadable; picking one to keep
  // would be a guess about which.
  const two = `a();\n// ${ARMOR_BEGIN} data:application/c2pa;base64,QQ== ${ARMOR_END}\n// ${ARMOR_BEGIN} data:application/c2pa;base64,Qg== ${ARMOR_END}\n`;
  assert.throws(() => attachC2paStore(bytesOf(two), 'js', store), /more than one - or a malformed - C2PA manifest block/);
  // A dangling END, or END before BEGIN.
  assert.throws(() => attachC2paStore(bytesOf(`a();\n// ${ARMOR_END}\n`), 'js', store), /more than one - or a malformed/);
  assert.throws(() => attachC2paStore(bytesOf(`a();\n// ${ARMOR_END} x ${ARMOR_BEGIN}\n`), 'js', store), /more than one - or a malformed/);
  // Prose that QUOTES the delimiters is not a credential - deleting somebody's
  // paragraph to make room for one is not a trade a writer gets to make.
  const prose = `# Spec digest\n\nThe block is delimited by ${ARMOR_BEGIN} and ${ARMOR_END} markers.\n`;
  assert.throws(() => attachC2paStore(bytesOf(prose), 'md', store), /refusing to delete it/);
  // Bare delimiters on a line of their own, with nothing that parses as a
  // reference between them: the reference test is the last of the three.
  const bare = `# Spec digest\n\n${ARMOR_BEGIN} a reference goes here ${ARMOR_END}\n`;
  assert.throws(() => attachC2paStore(bytesOf(bare), 'md', store), /not a manifest reference/);
  // …but a real block, ours or anyone's, is replaced. (A `//` block is still
  // recognised and replaced even though this placer now WRITES `/*!` - the strip
  // reads section A.9.3.1's whole comment-introducer list, so a file signed by any
  // conformant producer re-signs cleanly.)
  const signed = `a();\n// ${ARMOR_BEGIN} https://example.test/m.c2pa ${ARMOR_END}\n`;
  const out = textOf(attachC2paStore(bytesOf(signed), 'js', store));
  assert.ok(!out.includes('https://example.test/m.c2pa'), 'the old reference is gone');
  assert.equal(out.split(ARMOR_BEGIN).length - 1, 1);
  assert.ok(out.startsWith('a();\n'), 'the host is intact');
});

test('a document that DOCUMENTS the armour form keeps every line it wrote', () => {
  // The defect this pins: a well-formed delimiter pair around reference-shaped
  // text used to be treated as a previous credential wherever it sat, and its
  // whole line was deleted before hashing. On a docs site whose subject is C2PA - 
  // a spec digest, a README, this wave's own brief - that is ordinary prose. The
  // signature over the mutilated text was VALID, and the deletion sat outside
  // every exclusion, so no reader downstream could ever notice.
  const store = fakeStore();
  const doc = [
    '# Structured text',
    '',
    'A signed CSS file ends with one line:',
    '',
    `    /*! ${ARMOR_BEGIN} data:application/c2pa;base64,AAAA ${ARMOR_END} */`,
    '',
    'Everything above that line is hashed.',
    '',
  ].join('\n');
  assert.throws(() => attachC2paStore(bytesOf(doc), 'md', store), /in the middle of the file/,
    'refused, not silently rewritten');
  // The same shape on the LAST line is still refused when it is prose rather
  // than a comment - the position test alone is not the whole rule.
  const trailing = `Text about ${ARMOR_BEGIN} data:application/c2pa;base64,AAAA ${ARMOR_END} in a sentence.\n`;
  assert.throws(() => attachC2paStore(bytesOf(trailing), 'md', store), /not a comment/);
});

test('section A.7.1.1: a `<head` written inside a script or style is text, not an anchor', () => {
  // The carrier must be "placed in the head of the HTML document", and section A.7.1.4
  // step 1 has the validator "parse the head element". Splicing at a `<head`
  // that lives inside a raw-text element would both corrupt the host (our
  // </script> closes THEIRS early) and put the element outside the head.
  const store = fakeStore(48);
  const hosts = [
    '<!doctype html>\n<html>\n<script>var t = "<head>";</script>\n<head>\n<title>x</title>\n</head>\n<body>hi</body>\n</html>\n',
    '<!doctype html>\n<html>\n<style>/* <head> */\nbody{color:red}</style>\n<head></head>\n<body>hi</body>\n</html>\n',
    '<!doctype html>\n<html>\n<textarea><head></textarea>\n<head></head>\n<body>hi</body>\n</html>\n',
  ];
  for (const host of hosts) {
    const out = textOf(attachC2paStore(bytesOf(host), 'html', store));
    const at = out.indexOf('<script type="application/c2pa">');
    assert.ok(at > 0, 'a carrier was placed');
    // The one place section A.7.1.1 allows: immediately after the real <head> open tag
    // (the LAST `<head>` in these fixtures - the earlier one is raw text).
    const head = out.lastIndexOf('<head>');
    assert.equal(at, head + '<head>'.length, 'the element sits at the top of the real head');
    assert.ok(at < out.indexOf('</head>'), '…and inside it');
    // The host's own raw text is untouched, character for character.
    const raw = /<(script|style|textarea)>([\s\S]*?)<\/\1>/.exec(host)!;
    assert.ok(out.includes(raw[0]!), 'the host raw-text element is preserved verbatim');
  }
});

test('an empty or whitespace-only host is refused - that binding would hash nothing', () => {
  // section A.9.4's third case ("the file contains only the manifest block") is an
  // exclusion of {0, whole file}: a hard binding over zero bytes, which matches
  // every other such file. Refuse rather than mint one.
  for (const fmt of ARMOR_FORMATS) {
    for (const src of ['', '   ', '\n\n', '\r\n']) {
      assert.throws(() => attachC2paStore(bytesOf(src), fmt, fakeStore()), /would bind nothing/, `${fmt} ${JSON.stringify(src)}`);
    }
  }
});

test('placeHtml refuses a host with nowhere to put the element', () => {
  const store = fakeStore();
  for (const src of ['', 'just some prose\n', '<p>a fragment, not a document</p>\n', '\x89PNG\r\n\x1a\n']) {
    assert.throws(() => attachC2paStore(bytesOf(src), 'html', store), /not an HTML document/, JSON.stringify(src));
  }
  assert.throws(() => attachC2paStore(bytesOf('<html><head/><body>x</body></html>'), 'html', store), /self-closing <head\/>/);
  assert.throws(() => attachC2paStore(bytesOf('<html/>'), 'html', store), /self-closing <html\/>/);
  assert.throws(() => attachC2paStore(bytesOf('<!doctype html>\n<html><head><script type="application/c2pa">QQ=='), 'html', store), /unterminated <script/);
});

test('hostile and truncated hosts throw cleanly and never hang', () => {
  // Bounds-before-read applies to writers too: every scan here is linear and
  // every dead end is a throw, not a loop. The shapes are the ones that have
  // historically hung a scanner - a `>`-free tail, an unterminated comment, a
  // megabyte of delimiters - sized so a quadratic path would blow the budget.
  const store = fakeStore(64);
  const cases: Array<[string, string, Uint8Array]> = [
    ['html', '250k <script with no >', bytesOf('<!doctype html>\n<html><head>' + '<script '.repeat(250_000))],
    ['html', '250k <link with no >', bytesOf('<!doctype html>\n<html><head>' + '<link '.repeat(250_000))],
    ['html', 'unterminated c2pa script after 250k tags', bytesOf('<!doctype html>\n<html><head>' + '<script>x</script>'.repeat(50_000) + '<script type="application/c2pa">QQ==')],
    ['html', 'unterminated comment', bytesOf('<!doctype html>\n<!--' + 'x'.repeat(500_000))],
    ['html', 'truncated root tag', bytesOf('<!doctype html' + 'x'.repeat(200_000))],
    ['html', 'a quote that never closes', bytesOf('<!doctype html>\n<html><head a="' + 'x'.repeat(500_000))],
    ['js', 'a megabyte of BEGIN delimiters', bytesOf(`${ARMOR_BEGIN}\n`.repeat(30_000))],
    ['md', 'a megabyte of END delimiters', bytesOf(`${ARMOR_END}\n`.repeat(30_000))],
    ['css', 'nothing but newlines', bytesOf('\n'.repeat(200_000))],
    ['html-fragment', 'NUL-riddled binary', bytesOf('\0'.repeat(200_000))],
  ];
  for (const [fmt, what, host] of cases) {
    const t0 = Date.now();
    let threw = false;
    try {
      const out = attachC2paStore(host, fmt, store);
      // A hostile host is allowed to SUCCEED (a NUL-riddled "text" file is still
      // text as far as byte splicing is concerned) - what it may never do is hang
      // or corrupt. If it placed, the carrier must still read back.
      assert.ok(extractC2paDetailed(out)?.store, `${fmt}: ${what} placed but does not read back`);
    } catch (err) {
      threw = true;
      assert.match((err as Error).message, /^C2PA embed: /, `${fmt}: ${what} - clean, prefixed error`);
    }
    const ms = Date.now() - t0;
    assert.ok(ms < 5_000, `${fmt}: ${what} took ${ms}ms - that is a quadratic scan, not a slow machine`);
    assert.ok(threw || true);
  }
});

test('embedC2pa rejects non-bytes and unknown text formats before touching anything', async () => {
  await assert.rejects(() => embedC2pa('nope' as unknown as Uint8Array, 'md', OPTS), /bytes must be a Uint8Array/);
  await assert.rejects(() => embedC2pa(bytesOf(MD_SRC), 'markdown', OPTS), /no embedding for format 'markdown'/);
  assert.throws(() => attachC2paStore(bytesOf(MD_SRC), 'html-frag', fakeStore()), /no container for format 'html-frag'/);
  // The dispatch key stays case-insensitive for the new ids, as for every other.
  assert.ok(attachC2paStore(bytesOf(MD_SRC), 'MD', fakeStore()).length > MD_SRC.length);
});

test('a signed file that loses its host content fails as CHANGED, not as unreadable', async () => {
  // The failure mode that matters for a docs artifact: someone edits the source
  // and keeps the credential. The carrier still reads; the binding says no.
  const out = await embedC2pa(bytesOf(CSS_SRC), 'css', OPTS);
  const edited = bytesOf(textOf(out).replace('#30ba78', '#ff0000'));
  const report = await verifyC2pa(edited);
  assert.equal(report.found, true, 'the credential is still found');
  assert.equal(report.state, 'invalid');
  assert.ok(report.checks.some((c) => c.code === 'assertion.dataHash.mismatch' && !c.ok));
  assert.equal(report.textBinding?.exclusionsConform, undefined, 'the carrier itself is still conformant');
});
