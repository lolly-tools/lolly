// SPDX-License-Identifier: MPL-2.0
/**
 * The audio metadata stripper (engine/src/strip-audio.ts): tags and Content
 * Credentials leave M4A, WAV, MP3, FLAC and Ogg Opus files, container sizes and
 * offsets are rewritten, and the audio bytes stay byte-identical. Hostile and
 * truncated input fails with an Error and never hangs.
 * Run with: node --test tests/strip-audio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  sniffAudioFormat, inspectAudioMetadata, stripAudioMetadata, audioMetadataResidual, AUDIO_STRIP_FORMATS,
  type AudioStripFormat,
} from '../engine/src/strip-audio.ts';
import { stripMetadata, hasResidualMetadata } from '../engine/src/strip-metadata.ts';
import { extractC2paStore } from '../engine/src/c2pa-extract.ts';
import { extractFileMetadata } from '../engine/src/file-metadata.ts';
import { buildOpusTags, locateOpusComment, parseOpusTags, walkOggPages, oggCrc32 } from '../engine/src/ogg.ts';
import {
  apeTag, box, buildFlac, buildFragmentedMp4, buildMp3, buildMp4, buildOpus, buildWav, cat, chunkOffsets, find,
  FLAC_FRAMES, flacBlock, flacSeekTable, flacStreamInfo, id3Text, id3v1, id3v24, indexOf, latin1,
  MP3_FRAMES, MP4_SAMPLES, mdatPayload, OPUS_AUDIO_PAGES, OPUS_HEAD_PAGE, pattern, riff, riffChunk, syncsafe, u32be, u32le,
  utf8, vorbisComment, walk, WAV_PCM, wavFmt, XING_FRAMES, zeros,
} from './helpers/audio-fixtures.ts';

const labels = (bytes: Uint8Array, format: AudioStripFormat): string[] => inspectAudioMetadata(bytes, format).items.map((i) => i.label);

/** The strip removed something, re-reads clean, and a second strip is a no-op returning the same array. */
function stripClean(bytes: Uint8Array, format: AudioStripFormat): Uint8Array {
  assert.ok(inspectAudioMetadata(bytes, format).removals.length > 0, 'the fixture carries something to remove');
  const out = stripAudioMetadata(bytes, format);
  assert.notEqual(out, bytes);
  assert.equal(audioMetadataResidual(out, format), null);
  assert.deepEqual(inspectAudioMetadata(out, format).items, []);
  assert.equal(stripAudioMetadata(out, format), out, 'a clean file comes back as the same array');
  return out;
}

// ─── sniffing ────────────────────────────────────────────────────────────────

test('sniffAudioFormat reads each container by its own magic and refuses pictures', () => {
  assert.equal(sniffAudioFormat(buildMp4()), 'mp4');
  assert.equal(sniffAudioFormat(buildWav()), 'wav');
  assert.equal(sniffAudioFormat(buildMp3()), 'mp3');
  assert.equal(sniffAudioFormat(MP3_FRAMES), 'mp3', 'a bare MP3 needs two frames in a row');
  assert.equal(sniffAudioFormat(buildFlac()), 'flac');
  assert.equal(sniffAudioFormat(cat(id3v24(id3Text('TIT2', 'x')), buildFlac())), 'flac', 'an ID3 tag in front of fLaC is still FLAC');
  assert.equal(sniffAudioFormat(buildOpus()), 'ogg');
  assert.equal(sniffAudioFormat(buildMp4({ brand: 'heic' })), null);
  assert.equal(sniffAudioFormat(buildMp4({ brand: 'avif' })), null);
  assert.equal(sniffAudioFormat(cat(latin1('OggS'), zeros(60), latin1('vorbis'))), null);
  assert.equal(sniffAudioFormat(cat([0xff, 0xfb, 0x90, 0x00], zeros(20))), null, 'one frame header alone is too weak to claim');
  assert.equal(sniffAudioFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), null);
  assert.equal(sniffAudioFormat(new Uint8Array(4)), null);
  assert.deepEqual([...AUDIO_STRIP_FORMATS], ['mp4', 'wav', 'mp3', 'flac', 'ogg']);
});

// ─── M4A / MP4 ───────────────────────────────────────────────────────────────

test('m4a: udta tags, C2PA and XMP boxes, dirty padding, handler name and times go; stco moves with mdat', () => {
  const src = buildMp4({ udta: true, c2pa: 'tail', xmp: true, freeData: true, times: true, handlerName: 'MediabunnySoundHandler' });
  const found = labels(src, 'mp4');
  for (const l of ['Title', 'Comment', 'Artist', 'Encoder', 'Content Credentials', 'XMP metadata', 'Padding with leftover data', 'Handler description', 'Creation time']) {
    assert.ok(found.includes(l), `inspect lists ${l}`);
  }
  assert.ok(inspectAudioMetadata(src, 'mp4').items.find((i) => i.label === 'Artist')?.sensitive);
  assert.ok(extractC2paStore(src), 'the fixture carries a readable credential');

  const out = stripClean(src, 'mp4');
  assert.equal(extractC2paStore(out), null);
  assert.deepEqual(walk(out).map((b) => b.type), ['ftyp', 'moov', 'mdat']);
  assert.equal(find(out, ['moov', 'udta']), undefined);
  // The audio bytes and where the chunk table points.
  assert.deepEqual(mdatPayload(out), MP4_SAMPLES);
  const mdat = walk(out).find((b) => b.type === 'mdat')!;
  assert.deepEqual(chunkOffsets(out), [mdat.off + 8, mdat.off + 8 + 300]);
  assert.deepEqual(chunkOffsets(src).map((o) => src[o]), chunkOffsets(out).map((o) => out[o]));
  // The handler name is empty and the times are zero.
  const hdlr = find(out, ['moov', 'trak', 'mdia', 'hdlr'])!;
  assert.equal(hdlr.size, 33);
  const mvhd = find(out, ['moov', 'mvhd'])!;
  assert.deepEqual([...out.subarray(mvhd.off + 12, mvhd.off + 20)], [0, 0, 0, 0, 0, 0, 0, 0]);
  // Verify's own metadata reader finds only technical rows.
  const meta = extractFileMetadata(out);
  assert.equal(meta.format, 'MP4');
  assert.deepEqual(meta.fields.filter((f) => f.group !== 'technical'), []);
  assert.ok(extractFileMetadata(src).fields.some((f) => f.label === 'Title'));
});

test('m4a: co64 tables move too, and a C2PA box before moov shifts every offset', () => {
  const src = buildMp4({ udta: true, c2pa: 'head', co64: true });
  const out = stripClean(src, 'mp4');
  const mdat = walk(out).find((b) => b.type === 'mdat')!;
  assert.deepEqual(chunkOffsets(out), [mdat.off + 8, mdat.off + 308]);
  assert.deepEqual(mdatPayload(out), MP4_SAMPLES);
});

test('m4a: mdat before moov keeps its offsets; trailing removal changes nothing before it', () => {
  const src = buildMp4({ faststart: false, udta: true, c2pa: 'tail' });
  const out = stripClean(src, 'mp4');
  assert.deepEqual(chunkOffsets(out), chunkOffsets(src));
  assert.deepEqual(out.subarray(0, chunkOffsets(src)[0]! + 600), src.subarray(0, chunkOffsets(src)[0]! + 600));
});

test('m4a: a file with nothing to remove comes back byte-identical (zero padding is kept)', () => {
  for (const src of [buildMp4(), buildMp4({ freeZeros: true }), buildMp4({ faststart: false })]) {
    assert.deepEqual(inspectAudioMetadata(src, 'mp4').removals, []);
    assert.equal(stripAudioMetadata(src, 'mp4'), src);
    assert.equal(audioMetadataResidual(src, 'mp4'), null);
  }
});

test('m4a fragmented: tfhd base data offsets and tfra fragment offsets follow their moof', () => {
  const src = buildFragmentedMp4();
  const before = walk(src).filter((b) => b.type === 'moof').map((b) => b.off);
  const out = stripClean(src, 'mp4');
  const moofs = walk(out).filter((b) => b.type === 'moof');
  assert.equal(moofs.length, 2);
  assert.ok(moofs[0]!.off < before[0]!, 'the fragments moved');
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (const moof of moofs) {
    const at = indexOf(out, latin1('tfhd'), moof.off) - 4;
    assert.equal(dv.getUint32(at + 16) * 2 ** 32 + dv.getUint32(at + 20), moof.off, 'base data offset points at its moof');
  }
  const tfra = indexOf(out, latin1('tfra')) - 4;
  assert.equal(dv.getUint32(tfra + 32) * 2 ** 32 + dv.getUint32(tfra + 36), moofs[0]!.off);
  assert.equal(dv.getUint32(tfra + 51) * 2 ** 32 + dv.getUint32(tfra + 55), moofs[1]!.off);
  const mdats = (b: Uint8Array) => walk(b).filter((x) => x.type === 'mdat').map((x) => [...b.subarray(x.off + 8, x.end)]);
  assert.deepEqual(mdats(out), mdats(src));
});

test('m4a fragmented: metadata between fragments is refused rather than breaking relative indexes', () => {
  assert.throws(() => stripAudioMetadata(buildFragmentedMp4({ udtaBetween: true }), 'mp4'), /between its fragments/);
});

test('m4a: refuses pictures, files without a movie, forged tables and runaway nesting', () => {
  assert.throws(() => stripAudioMetadata(buildMp4({ brand: 'heic', udta: true }), 'mp4'), /HEIF or AVIF/);
  assert.throws(() => stripAudioMetadata(cat(box('ftyp', latin1('M4A '), u32be(0)), box('mdat', zeros(8))), 'mp4'), /no movie header/);
  assert.throws(() => stripAudioMetadata(cat(box('free', zeros(4)), box('moov')), 'mp4'), /not an MP4/);
  // A chunk table that claims four billion entries.
  const forged = buildMp4({ udta: true });
  const stco = indexOf(forged, latin1('stco')) - 4;
  forged.set(u32be(0xffffffff), stco + 12);
  assert.throws(() => stripAudioMetadata(forged, 'mp4'), /claims more entries/);
  // A box that runs past its container.
  const overrun = buildMp4({ udta: true });
  overrun.set(u32be(0x7fffffff), indexOf(overrun, latin1('udta')) - 4);
  assert.throws(() => stripAudioMetadata(overrun, 'mp4'), /runs past/);
  // trak inside trak inside trak, a hundred deep.
  let nest = box('trak', box('udta'));
  for (let i = 0; i < 100; i++) nest = box('trak', nest);
  assert.throws(() => stripAudioMetadata(cat(box('ftyp', latin1('M4A '), u32be(0)), box('moov', nest)), 'mp4'), /nests too deeply/);
  // A chunk offset that points into the metadata being removed.
  const wild = buildMp4({ udta: true, freeData: true });
  const free = walk(wild).find((b) => b.type === 'free')!;
  wild.set(u32be(free.off + 9), indexOf(wild, latin1('stco')) - 4 + 16);
  assert.throws(() => stripAudioMetadata(wild, 'mp4'), /points outside its media data/);
});

// ─── WAV ─────────────────────────────────────────────────────────────────────

test('wav: LIST/INFO, bext, XMP, C2PA, id3 and dirty JUNK go; the RIFF size and pad bytes are right', () => {
  const src = buildWav();
  const found = labels(src, 'wav');
  for (const l of ['Title', 'Artist', 'Software', 'Description', 'Originator', 'Origination date', 'XMP metadata', 'Content Credentials', 'Padding with leftover data']) {
    assert.ok(found.includes(l), `inspect lists ${l}`);
  }
  assert.ok(extractC2paStore(src));
  const out = stripClean(src, 'wav');
  assert.equal(extractC2paStore(out), null);
  // Expected bytes: the kept chunks verbatim, in order, with a new RIFF size.
  const expected = riff(wavFmt, riffChunk('JUNK', zeros(4)), riffChunk('cue ', Uint8Array.of(1, 2, 3)), riffChunk('data', WAV_PCM));
  assert.deepEqual(out, expected);
  assert.equal(new DataView(out.buffer, out.byteOffset).getUint32(4, true), out.length - 8);
  assert.deepEqual(extractFileMetadata(out).fields, []);
});

test('wav: an ID3 tag appended after the RIFF form goes; other trailing bytes stay', () => {
  const base = riff(wavFmt, riffChunk('data', WAV_PCM));
  assert.deepEqual(stripClean(cat(base, id3v1('Song', 'Ada')), 'wav'), base);
  assert.deepEqual(stripClean(cat(base, id3v24(id3Text('TIT2', 'Song'))), 'wav'), base);
  const tail = cat(riff(wavFmt, riffChunk('data', WAV_PCM), riffChunk('C2PA', utf8('x'))), latin1('trailer'));
  assert.deepEqual(stripClean(tail, 'wav'), cat(base, latin1('trailer')));
});

test('wav: nothing to remove comes back byte-identical, even with a final chunk missing its pad byte', () => {
  const plain = riff(wavFmt, riffChunk('data', WAV_PCM));
  assert.equal(stripAudioMetadata(plain, 'wav'), plain);
  const odd = riff(wavFmt, riffChunk('data', WAV_PCM), riffChunk('cue ', Uint8Array.of(9)).subarray(0, 9));
  const unpadded = cat(odd.subarray(0, 4), u32le(odd.length - 8), odd.subarray(8));
  assert.equal(stripAudioMetadata(unpadded, 'wav'), unpadded);
});

test('wav: RF64, overruns, unrecorded lengths and missing audio are refused', () => {
  const rf64 = buildWav();
  rf64.set(latin1('RF64'));
  assert.equal(sniffAudioFormat(rf64), 'wav');
  assert.throws(() => stripAudioMetadata(rf64, 'wav'), /RF64/);
  const overrun = buildWav();
  overrun.set(u32le(0xfffffff0), 40);
  assert.throws(() => stripAudioMetadata(overrun, 'wav'), /runs past|no audio/);
  const streaming = riff(wavFmt, cat(latin1('data'), u32le(0)), WAV_PCM, riffChunk('LIST', cat(latin1('INFO'), riffChunk('INAM', utf8('x')))));
  assert.throws(() => stripAudioMetadata(streaming, 'wav'), /length of its audio/);
  assert.throws(() => stripAudioMetadata(riff(wavFmt, riffChunk('C2PA', utf8('x'))), 'wav'), /no audio data/);
  assert.throws(() => stripAudioMetadata(latin1('RIFF\0\0\0\0WA'), 'wav'), /not a WAV/);
});

// ─── MP3 ─────────────────────────────────────────────────────────────────────

test('mp3: ID3v2 tags (with the C2PA GEOB), APE, Lyrics3 and ID3v1 go; the frames stay byte for byte', () => {
  const src = buildMp3();
  const ins = inspectAudioMetadata(src, 'mp3');
  const found = ins.items.map((i) => i.label);
  for (const l of ['Title', 'Artist', 'Comment', 'Content Credentials', 'Encoder settings', 'Lyrics']) assert.ok(found.includes(l), `inspect lists ${l}`);
  assert.ok(ins.items.some((i) => i.value === 'APE title'));
  assert.ok(ins.items.some((i) => i.value === 'V1 title'));
  assert.deepEqual(ins.removals.sort(), ['a Lyrics3 tag', 'an APE tag', 'an ID3v1 tag', 'an ID3v2 tag']);
  assert.ok(extractC2paStore(src));
  const out = stripClean(src, 'mp3');
  assert.deepEqual(out, MP3_FRAMES);
  assert.equal(extractC2paStore(out), null);
});

test('mp3: an appended ID3v2 tag with a footer goes, and a Xing/LAME header frame is kept and reported', () => {
  const body = cat(id3Text('TIT2', 'Appended'));
  const appended = cat(latin1('ID3'), [4, 0, 0x10], syncsafe(body.length), body, latin1('3DI'), [4, 0, 0x10], syncsafe(body.length));
  assert.deepEqual(stripClean(cat(XING_FRAMES, appended), 'mp3'), XING_FRAMES);
  const kept = inspectAudioMetadata(cat(id3v24(id3Text('TIT2', 'x')), XING_FRAMES), 'mp3').kept;
  assert.equal(kept.length, 1);
  assert.match(kept[0]!.value, /Xing header, LAME3\.100/);
});

test('mp3: a bare MP3 with nothing to remove comes back byte-identical', () => {
  assert.equal(stripAudioMetadata(MP3_FRAMES, 'mp3'), MP3_FRAMES);
  assert.equal(audioMetadataResidual(MP3_FRAMES, 'mp3'), null);
});

test('mp3: malformed tags fail cleanly', () => {
  const tooBig = cat(latin1('ID3'), [4, 0, 0], syncsafe(1 << 20), MP3_FRAMES);
  assert.throws(() => stripAudioMetadata(tooBig, 'mp3'), /runs past the end/);
  const badSize = cat(latin1('ID3'), [4, 0, 0], [0x80, 0, 0, 1], [0], MP3_FRAMES);
  assert.throws(() => stripAudioMetadata(badSize, 'mp3'), /malformed size/);
  assert.throws(() => stripAudioMetadata(cat(id3v24(id3Text('TIT2', 'x')), pattern(5000, 2).map((v) => v & 0x7f)), 'mp3'), /No MP3 audio follows/);
  const apeOverrun = cat(MP3_FRAMES, apeTag('Title', 'x'));
  apeOverrun.set(u32le(0x7fffffff), apeOverrun.length - 20);
  assert.throws(() => stripAudioMetadata(apeOverrun, 'mp3'), /APE tag runs past/);
  const footerOnly = cat(MP3_FRAMES, latin1('3DI'), [4, 0, 0x10], syncsafe(4));
  assert.throws(() => stripAudioMetadata(footerOnly, 'mp3'), /does not match its footer/);
  const lyricsBad = cat(MP3_FRAMES, latin1('12345xLYRICS200'));
  assert.throws(() => stripAudioMetadata(lyricsBad, 'mp3'), /Lyrics3 tag has a malformed size/);
  const stacked = cat(...Array.from({ length: 17 }, () => id3v24(id3Text('TIT2', 'x'))), MP3_FRAMES);
  assert.throws(() => stripAudioMetadata(stacked, 'mp3'), /too many stacked ID3 tags/);
});

// ─── FLAC ────────────────────────────────────────────────────────────────────

test('flac: VORBIS_COMMENT, PICTURE, APPLICATION (C2PA) and CUESHEET go; STREAMINFO, SEEKTABLE and zero padding stay', () => {
  const src = buildFlac();
  const found = labels(src, 'flac');
  for (const l of ['Encoder', 'Title', 'Artist', 'Picture', 'Content Credentials', 'Cue sheet']) assert.ok(found.includes(l), `inspect lists ${l}`);
  assert.ok(extractC2paStore(src));
  const out = stripClean(src, 'flac');
  assert.deepEqual(out, cat(latin1('fLaC'), flacStreamInfo, flacSeekTable, flacBlock(1, zeros(16), true), FLAC_FRAMES));
  assert.equal(extractC2paStore(out), null);
});

test('flac: dropping the last block moves the last-block flag; ID3 tags around the stream go', () => {
  const src = cat(id3v24(id3Text('TIT2', 'x')), latin1('fLaC'), flacStreamInfo, flacBlock(4, vorbisComment('v', []), true), FLAC_FRAMES, id3v1('a', 'b'));
  const out = stripClean(src, 'flac');
  assert.deepEqual(out, cat(latin1('fLaC'), flacBlock(0, flacStreamInfo.subarray(4), true), FLAC_FRAMES));
  const dirty = cat(latin1('fLaC'), flacStreamInfo, flacBlock(1, utf8('old tag'), true), FLAC_FRAMES);
  assert.deepEqual(stripClean(dirty, 'flac'), cat(latin1('fLaC'), flacBlock(0, flacStreamInfo.subarray(4), true), FLAC_FRAMES));
  const plain = cat(latin1('fLaC'), flacBlock(0, flacStreamInfo.subarray(4), true), FLAC_FRAMES);
  assert.equal(stripAudioMetadata(plain, 'flac'), plain);
});

test('flac: malformed metadata fails cleanly', () => {
  assert.throws(() => stripAudioMetadata(cat(latin1('fLaC'), flacBlock(4, vorbisComment('v', []), true), FLAC_FRAMES), 'flac'), /STREAMINFO/);
  assert.throws(() => stripAudioMetadata(cat(latin1('fLaC'), flacStreamInfo, [0x84, 0xff, 0xff, 0xff]), 'flac'), /runs past/);
  assert.throws(() => stripAudioMetadata(cat(latin1('fLaC'), flacStreamInfo), 'flac'), /cut short/);
  assert.throws(() => stripAudioMetadata(cat(latin1('fLaC'), flacStreamInfo, flacBlock(127, zeros(2), true)), 'flac'), /invalid type/);
  assert.throws(() => stripAudioMetadata(cat(latin1('fLaC'), flacBlock(0, zeros(34), true), latin1('nope')), 'flac'), /No FLAC audio frame/);
});

// ─── Ogg Opus ────────────────────────────────────────────────────────────────

test('opus: the vendor string and every comment go; OpusHead and the audio pages stay byte for byte', () => {
  const src = buildOpus();
  const found = labels(src, 'ogg');
  for (const l of ['Encoder', 'Title', 'Artist', 'Content Credentials']) assert.ok(found.includes(l), `inspect lists ${l}`);
  assert.ok(extractC2paStore(src));
  const out = stripClean(src, 'ogg');
  assert.equal(extractC2paStore(out), null);
  assert.deepEqual(out.subarray(0, OPUS_HEAD_PAGE.length), OPUS_HEAD_PAGE);
  assert.deepEqual(out.subarray(out.length - OPUS_AUDIO_PAGES.length), OPUS_AUDIO_PAGES);
  const loc = locateOpusComment(out)!;
  assert.deepEqual(parseOpusTags(loc.packet), { vendor: new Uint8Array(0), comments: [] });
  const pages = walkOggPages(out);
  assert.deepEqual(pages.map((p) => p.seq), [0, 1, 2, 3]);
  for (const p of pages) {
    const page = out.slice(p.start, p.end);
    const crc = new DataView(page.buffer).getUint32(22, true);
    page.fill(0, 22, 26);
    assert.equal(oggCrc32(page), crc, `page ${p.seq} checksum`);
  }
  const plain = buildOpus('', []);
  assert.equal(stripAudioMetadata(plain, 'ogg'), plain);
});

test('opus: comments spread over several pages and non-Opus Ogg are refused', () => {
  // A 70 KB comment packet: 255 full lacing values on one page, the rest continued on the next.
  const packet = buildOpusTags(utf8('v'), [utf8(`COVERART=${'a'.repeat(70_000)}`)]);
  const head = (htype: number, seq: number) => cat(latin1('OggS'), [0, htype], zeros(8), u32le(0x1234), u32le(seq), zeros(4));
  const first = packet.subarray(0, 255 * 255);
  const rest = packet.subarray(255 * 255);
  const restSegs = [...Array.from({ length: Math.floor(rest.length / 255) }, () => 255), rest.length % 255];
  const twoPages = cat(OPUS_HEAD_PAGE, head(0, 1), [255], new Uint8Array(255).fill(255), first, head(1, 2), [restSegs.length], restSegs, rest, OPUS_AUDIO_PAGES);
  assert.equal(locateOpusComment(twoPages)?.pageCount, 2);
  assert.throws(() => stripAudioMetadata(twoPages, 'ogg'), /several pages/);
  assert.throws(() => stripAudioMetadata(cat(latin1('OggS'), zeros(40)), 'ogg'), /not Opus/);
});

// ─── shared contract ─────────────────────────────────────────────────────────

test('stripMetadata and hasResidualMetadata hand audio to the audio stripper', () => {
  const wav = buildWav();
  assert.deepEqual(stripMetadata(wav, 'wav'), stripAudioMetadata(wav, 'wav'));
  assert.equal(hasResidualMetadata(wav, 'wav'), audioMetadataResidual(wav, 'wav'));
  assert.equal(hasResidualMetadata(stripMetadata(wav, 'wav'), 'wav'), null);
  const mp4 = buildMp4({ udta: true });
  assert.deepEqual(mdatPayload(stripMetadata(mp4, 'mp4')), MP4_SAMPLES);
});

test('report values are bounded and keys from the file never reach the prototype', () => {
  const long = 'x'.repeat(5000);
  const ins = inspectAudioMetadata(cat(id3v24(id3Text('TIT2', long), id3Frame2('TXXX', 'constructor')), MP3_FRAMES), 'mp3');
  assert.ok(ins.items.every((i) => typeof i.label === 'string' && i.value.length <= 200));
  const keys = cat(latin1('fLaC'), flacStreamInfo, flacBlock(4, vorbisComment('v', ['CONSTRUCTOR=a', '__PROTO__=b', 'toString=c']), true), FLAC_FRAMES);
  assert.ok(inspectAudioMetadata(keys, 'flac').items.every((i) => typeof i.label === 'string'));
  const many = cat(id3v24(...Array.from({ length: 300 }, (_, n) => id3Text('TIT2', `t${n}`))), MP3_FRAMES);
  assert.equal(inspectAudioMetadata(many, 'mp3').items.length, 64);
});

function id3Frame2(id: string, desc: string): Uint8Array {
  const data = cat([3], utf8(desc), [0], utf8('v'));
  return cat(latin1(id), syncsafe(data.length), [0, 0], data);
}

/** Small deterministic PRNG so the hostile corpus is the same on every run. */
function prng(seed: number): () => number {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}

test('truncated and mutated files fail with an Error or strip cleanly, and never hang', () => {
  const corpus: Array<[AudioStripFormat, Uint8Array]> = [
    ['mp4', buildMp4({ udta: true, c2pa: 'tail', xmp: true, freeData: true, times: true, handlerName: 'x' })],
    ['mp4', buildFragmentedMp4()], ['wav', buildWav()], ['mp3', buildMp3()], ['flac', buildFlac()], ['ogg', buildOpus()],
  ];
  const rand = prng(20261114);
  const started = Date.now();
  let calls = 0;
  const attempt = (format: AudioStripFormat, bytes: Uint8Array) => {
    for (const run of [() => inspectAudioMetadata(bytes, format), () => stripAudioMetadata(bytes, format)]) {
      calls++;
      try { run(); } catch (err) { assert.ok(err instanceof Error, `${format}: threw a non-Error`); assert.ok((err as Error).message.length > 0); }
    }
  };
  for (const [format, good] of corpus) {
    const step = Math.max(1, Math.floor(good.length / 120));
    for (let n = 0; n < good.length; n += step) attempt(format, good.subarray(0, n));
    for (let i = 0; i < 250; i++) {
      const bad = good.slice();
      const flips = 1 + Math.floor(rand() * 4);
      for (let f = 0; f < flips; f++) bad[Math.floor(rand() * bad.length)] = Math.floor(rand() * 256);
      attempt(format, bad);
    }
  }
  assert.ok(calls > 3000);
  assert.ok(Date.now() - started < 20_000, `the hostile corpus ran in ${Date.now() - started} ms`);
});

test('a successful strip of a mutated file still keeps the audio bytes (the post-check holds)', () => {
  // Mutate tag bytes only: the strip must succeed and leave the payload as it was.
  const src = buildMp3();
  const at = indexOf(src, utf8('Ska demo'));
  src.set(utf8('Changed!'), at);
  assert.deepEqual(stripAudioMetadata(src, 'mp3'), MP3_FRAMES);
  const wav = buildWav();
  wav.set(utf8('Changed!'), indexOf(wav, utf8('Ska demo')));
  assert.deepEqual(stripAudioMetadata(wav, 'wav').subarray(-WAV_PCM.length), WAV_PCM);
});

test('the Strip Hidden Data hook region matches its engine source', () => {
  execFileSync(process.execPath, ['scripts/build-strip-audio.ts', '--check'], { stdio: ['ignore', 'ignore', 'ignore'] });
});
