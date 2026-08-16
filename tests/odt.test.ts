// SPDX-License-Identifier: MPL-2.0
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { writeOdt } from '../engine/src/odt.ts';
import { readZip } from '../engine/src/zip.ts';

const dec = new TextDecoder('utf-8');

// A tiny standalone zip reader that reports each entry's LOCAL-header compression
// method - readZip() only returns decompressed bytes, so we peek at the raw local
// records to prove `mimetype` is STORED (method 0), not deflated.
function localEntries(bytes: Uint8Array): { name: string; method: number; offset: number }[] {
  const u16 = (o: number) => bytes[o]! | (bytes[o + 1]! << 8);
  const u32 = (o: number) => (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24)) >>> 0;
  const out: { name: string; method: number; offset: number }[] = [];
  let p = 0;
  while (p + 30 <= bytes.length && u32(p) === 0x04034b50) {
    const method = u16(p + 8);
    const compSize = u32(p + 18);
    const nameLen = u16(p + 26);
    const extraLen = u16(p + 28);
    const name = dec.decode(bytes.subarray(p + 30, p + 30 + nameLen));
    out.push({ name, method, offset: p });
    p += 30 + nameLen + extraLen + compSize;
  }
  return out;
}

test('writeOdt produces an OCF zip with mimetype first, stored, and editable text', () => {
  const odt = writeOdt({
    title: 'Meeting Notes',
    blocks: [
      { type: 'heading', level: 1, text: 'Quarterly Review' },
      { type: 'paragraph', text: 'Revenue grew & margins held <steady>.' },
      { type: 'heading', level: 2, text: 'Action Items' },
      { type: 'paragraph', text: 'Follow up with the "core" team.' },
    ],
  });

  assert.ok(odt instanceof Uint8Array && odt.length > 0, 'returns non-empty bytes');

  // 1. mimetype is the FIRST local entry, STORED (method 0), value exact.
  const locals = localEntries(odt);
  assert.equal(locals[0]!.name, 'mimetype', 'mimetype is the first entry');
  assert.equal(locals[0]!.method, 0, 'mimetype is STORED, not deflated');
  assert.equal(locals[0]!.offset, 0, 'mimetype is at the very start of the archive');

  // 2. Round-trip through the shared reader: every part present, CRCs valid.
  const entries = readZip(odt);
  const byName = new Map(entries.map((e) => [e.name, e.bytes]));
  assert.ok(byName.has('mimetype'), 'has mimetype');
  assert.ok(byName.has('content.xml'), 'has content.xml');
  assert.ok(byName.has('styles.xml'), 'has styles.xml');
  assert.ok(byName.has('META-INF/manifest.xml'), 'has manifest');

  assert.equal(
    dec.decode(byName.get('mimetype')!),
    'application/vnd.oasis.opendocument.text',
    'mimetype value is exact',
  );

  // 3. content.xml carries the heading/paragraph text as EDITABLE ODF elements.
  const content = dec.decode(byName.get('content.xml')!);
  assert.match(content, /<office:text>/, 'has an office:text body');
  assert.match(
    content,
    /<text:h text:style-name="Heading_20_1" text:outline-level="1">Quarterly Review<\/text:h>/,
    'H1 becomes a text:h with outline level 1',
  );
  assert.match(
    content,
    /<text:h text:style-name="Heading_20_2" text:outline-level="2">Action Items<\/text:h>/,
    'H2 becomes a text:h with outline level 2',
  );
  assert.match(content, /<text:p [^>]*>Revenue grew/, 'paragraph becomes a text:p');

  // 4. XML metacharacters are escaped, not raw.
  assert.match(content, /Revenue grew &amp; margins held &lt;steady&gt;\./, 'ampersand/angle escaped');
  assert.match(content, /Follow up with the &quot;core&quot; team\./, 'quotes escaped');
  assert.doesNotMatch(content, /<steady>/, 'no raw angle-bracket text leaked');

  // 5. manifest declares the root document as the ODT media type.
  const manifest = dec.decode(byName.get('META-INF/manifest.xml')!);
  assert.match(
    manifest,
    /manifest:full-path="\/" manifest:media-type="application\/vnd\.oasis\.opendocument\.text"/,
    'manifest root entry names the ODT media type',
  );
  assert.match(manifest, /manifest:full-path="content\.xml"/, 'manifest lists content.xml');

  // 6. The title is real: meta.xml carries it as dc:title and the manifest lists it.
  assert.ok(byName.has('meta.xml'), 'a titled doc emits meta.xml');
  const meta = dec.decode(byName.get('meta.xml')!);
  assert.match(meta, /<dc:title>Meeting Notes<\/dc:title>/, 'meta.xml records the title as dc:title');
  assert.match(manifest, /manifest:full-path="meta\.xml"/, 'manifest lists meta.xml');
});

test('writeOdt omits meta.xml when no title is given', () => {
  const odt = writeOdt({ blocks: [{ type: 'paragraph', text: 'untitled body' }] });
  const names = new Set(readZip(odt).map((e) => e.name));
  assert.ok(!names.has('meta.xml'), 'no title → no meta.xml part');
  const manifest = dec.decode(readZip(odt).find((e) => e.name === 'META-INF/manifest.xml')!.bytes);
  assert.doesNotMatch(manifest, /meta\.xml/, 'manifest does not list a meta.xml that is not there');
});

test('writeOdt defaults heading level to 1 and clamps out-of-range levels', () => {
  const odt = writeOdt({
    blocks: [
      { type: 'heading', text: 'No level given' },
      { type: 'heading', level: 99, text: 'Too deep' },
      { type: 'heading', level: 0, text: 'Too shallow' },
    ],
  });
  const content = dec.decode(readZip(odt).find((e) => e.name === 'content.xml')!.bytes);
  assert.match(content, /outline-level="1">No level given/, 'missing level defaults to 1');
  assert.match(content, /outline-level="10">Too deep/, 'level 99 clamps to 10');
  assert.match(content, /outline-level="1">Too shallow/, 'level 0 clamps to 1');
});

test('writeOdt is deterministic for a given document', () => {
  const doc = { title: 'X', blocks: [{ type: 'paragraph' as const, text: 'same' }] };
  assert.deepEqual(writeOdt(doc), writeOdt(doc), 'identical input yields identical bytes');
});
