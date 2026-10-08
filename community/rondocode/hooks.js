/* global onInit, onInput, exportFile, exportStill */
/**
 * Rondocode hooks.
 *
 * The song lives in four inputs - code, language, name, length - so a link, a
 * saved session, undo and the CLI all carry it whole. The editor itself runs in
 * an opaque-origin frame the template hosts; these hooks do the parts that need
 * the host:
 *
 *   - exportFile / exportStill: the song as audio (rendered by
 *     host.audio.decode, which runs the song's code in the vm execution class,
 *     never in this realm) or as its source, the canonical .rondo.json bytes;
 *   - onInit / onInput: a static card of the song for a render with no live
 *     editor (the CLI), and, in a browser, a narrow bridge the template uses to
 *     keep the editor's project library in host.state, save files, ask for the
 *     singing models, and finish the editor's exports.
 *
 * Every audio file this utility writes carries Content Credentials recording
 * the song as its source and how it was rendered (host.c2pa.sign with
 * `rondo`, worded by engine/src/rondo-provenance.ts); a file holding
 * synthesised singing declares that singing AI-generated. The person is told
 * before the export, and after it each file is read back and the message says
 * only what the read found. A MIDI file has no place for a credential, so the
 * same statement goes in a text event, and the message says so by name.
 *
 * Nothing here evaluates the song.
 */

var RONDO_MAX_SOURCE_BYTES = 256 * 1024;
var LIBRARY_SLOT = '__xprefs__:rondocode:library';

function vals(model) {
  var o = {};
  (model || []).forEach(function (i) { o[i.id] = i.value; });
  return o;
}

/** Control characters become spaces, as engine/src/rondo-source.ts cleans a name. */
function cleanName(v) {
  var s = '';
  if (typeof v === 'string') {
    for (var i = 0; i < v.length; i++) {
      var c = v.charCodeAt(i);
      s += c < 32 || c === 127 ? ' ' : v[i];
    }
  }
  s = s.trim();
  return (s || 'Untitled song').slice(0, 200);
}

function langOf(v) {
  return v === 'rondo' ? 'rondo' : v === 'js' ? 'js' : 'auto';
}

function songOf(v) {
  return { name: cleanName(v.name), lang: langOf(v.language), code: typeof v.code === 'string' ? v.code : '' };
}

/** The canonical .rondo.json bytes, exactly as engine/src/rondo-source.ts writes them. */
function sourceBytes(song) {
  if (song.code.trim() === '') throw new Error('The song has no code.');
  var bytes = new TextEncoder().encode(JSON.stringify({
    schemaVersion: 1, format: 'rondocode', name: song.name, lang: song.lang, code: song.code,
  }, null, 2) + '\n');
  if (bytes.length > RONDO_MAX_SOURCE_BYTES * 2) throw new Error('A song must be under 256 KB of code.');
  return bytes;
}

/** rondoFileName's slug, without the suffix. */
function fileStem(name) {
  var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || 'song';
}

/** 16-bit PCM WAV from float channels. Rounded and clamped, no dither, so the
 *  same PCM always gives the same bytes. */
function encodeWav(channels, sampleRate) {
  var chs = channels.length || 1;
  var frames = channels.length ? channels[0].length : 0;
  var dataLen = frames * chs * 2;
  var buf = new ArrayBuffer(44 + dataLen);
  var dv = new DataView(buf);
  var tag = (at, s) => { for (var i = 0; i < 4; i++) dv.setUint8(at + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); tag(8, 'WAVE');
  tag(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, chs, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * chs * 2, true);
  dv.setUint16(32, chs * 2, true); dv.setUint16(34, 16, true);
  tag(36, 'data'); dv.setUint32(40, dataLen, true);
  var off = 44, f, c, x;
  for (f = 0; f < frames; f++) {
    for (c = 0; c < chs; c++) {
      x = channels[c][f];
      x = Number.isNaN(x) ? 0 : x > 1 ? 1 : x < -1 ? -1 : x;
      dv.setInt16(off, Math.round(x < 0 ? x * 32768 : x * 32767), true);
      off += 2;
    }
  }
  return new Uint8Array(buf);
}

/** The findings from the last vm render, for the template's export note. */
var _lastFindings = [];

/** The parts a render could not play, each once (rondo-provenance.ts rondoSilentParts). */
function silentOf(findings) {
  var out = [];
  (findings || []).forEach(function (f) {
    if (!f || typeof f.code !== 'string' || f.code.indexOf('rondo.part.') !== 0) return;
    (f.parts || []).forEach(function (p) { if (p && out.indexOf(p) < 0) out.push(p); });
  });
  return out;
}

var AUDIO_MIME = { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', opus: 'audio/ogg', flac: 'audio/flac' };
/** host.audio.clean's name for each format: Opus goes in an Ogg file (.opus). */
var CLEAN_OUTPUT = { mp3: 'mp3', m4a: 'm4a', opus: 'ogg', flac: 'flac' };
/** The credential placer's name for each format. */
var SIGN_FORMAT = { wav: 'wav', mp3: 'mp3', m4a: 'm4a', opus: 'ogg', flac: 'flac' };

/** The song rendered in the vm class, with how it ran. */
async function renderVm(host, v, opts) {
  var song = songOf(v);
  if (!host || !host.audio || typeof host.audio.decode !== 'function') {
    throw new Error('This app cannot render songs to audio yet.');
  }
  // The reserved `seconds` export parameter, when a shell passes it, wins over
  // the tool's own length input.
  var seconds = Number(opts && opts.seconds) > 0 ? Number(opts.seconds) : Number(v.length);
  var decoded = await host.audio.decode(sourceBytes(song), seconds > 0 ? { seconds: seconds } : {});
  _lastFindings = Array.isArray(decoded.findings) ? decoded.findings : [];
  var run = decoded.run || {};
  return {
    song: song,
    wav: encodeWav(decoded.channels, decoded.sampleRate),
    facts: {
      executionClass: typeof run.executionClass === 'string' ? run.executionClass : 'vm',
      version: typeof run.version === 'string' ? run.version : 'unknown',
      seed: typeof run.seed === 'number' ? run.seed : undefined,
      sungParts: [],
      voices: [],
      silentParts: silentOf(_lastFindings),
    },
  };
}

/** WAV bytes as `format`, through the shell's encoder with every clean-up step off. */
async function encodeAs(host, wav, format) {
  if (format === 'wav') return wav;
  if (!host.audio || typeof host.audio.clean !== 'function') {
    throw new Error('This app has no ' + format.toUpperCase() + ' encoder. WAV and the song file work here.');
  }
  var out;
  try {
    out = await host.audio.clean(wav, { denoise: 'off', normalize: 'off', trimSilence: false, output: CLEAN_OUTPUT[format], sourceName: 'song.wav', sourceMime: 'audio/wav' });
  } catch (e) {
    // The shell says why in its own terms (a codec it does not have); say it in ours.
    throw new Error('this app has no ' + format.toUpperCase() + ' encoder (WAV and the song file work everywhere): ' + (e && e.message || e));
  }
  return out.bytes;
}

/** Sign `bytes` as a render of `song`. Resolves the signed bytes, or rejects. */
function signSong(host, bytes, format, song, facts) {
  if (!host.c2pa || typeof host.c2pa.sign !== 'function') return Promise.reject(new Error('This app cannot sign files.'));
  var rondo = {
    song: sourceBytes(song), name: song.name,
    executionClass: facts.executionClass, version: facts.version,
  };
  if (typeof facts.seed === 'number') rondo.seed = facts.seed;
  if (facts.sungParts && facts.sungParts.length) rondo.sungParts = facts.sungParts.slice();
  if (facts.voices && facts.voices.length) rondo.voices = facts.voices.slice();
  if (facts.silentParts && facts.silentParts.length) rondo.silentParts = facts.silentParts.slice();
  return host.c2pa.sign(bytes, format, { rondo: rondo });
}

/** What reading the file back found: its own credential's title and whether it declares AI media. */
async function readBack(host, bytes) {
  if (!host.c2pa || typeof host.c2pa.readIngredients !== 'function') return { found: false };
  var list = await host.c2pa.readIngredients(bytes);
  var own = list && list[0];
  if (!own) return { found: false };
  return { found: true, title: own.title || '', ai: typeof own.digitalSourceType === 'string' && own.digitalSourceType !== '' };
}

/**
 * One audio file of the song, signed: the WAV in `wav` encoded as `format`,
 * then its declaration and credential written. A file with synthesised singing
 * is never saved without its declaration; a file without can be, and then says
 * so.
 */
async function signedAudio(host, wav, format, song, facts) {
  var bytes = await encodeAs(host, wav, format);
  var sung = facts.sungParts && facts.sungParts.length > 0;
  try {
    var signed = await signSong(host, bytes, SIGN_FORMAT[format], song, facts);
    return { bytes: signed, signed: true, check: await readBack(host, signed) };
  } catch (e) {
    if (sung) throw new Error('The singing in it could not be declared, so the file was not saved (' + (e && e.message || e) + ').');
    return { bytes: bytes, signed: false, why: String(e && e.message || e) };
  }
}

/**
 * The sentence said after a file was made, from what the read-back found.
 * `file` names it when it was saved here; null when the caller writes it (the
 * CLI writes the bytes it is handed, unchanged).
 */
function audioSentence(file, out, song, facts, sent) {
  var sung = facts.sungParts || [];
  var saved = file ? (sent ? 'Sent ' + file + ' to the share sheet' : 'Saved ' + file) : 'The file was made';
  if (!out.signed) return saved + ' without Content Credentials: ' + out.why;
  var c = out.check;
  if (!c || !c.found) return saved + ', but its Content Credentials did not read back, so treat it as unsigned.';
  var what = 'Read back from the file: its Content Credentials record the song "' + (c.title || song.name) + '" as its source';
  var head = file ? saved + '. ' : '';
  if (sung.length && c.ai) return head + what + ' and declare the singing AI-generated.';
  if (sung.length) return head + what + ', but the AI-generated singing did not read back as declared.';
  return head + what + '; nothing in it is marked AI-generated.';
}

/** The tool's own file for a shell's export: the song as audio, signed. */
async function renderAudio(host, v, opts, format) {
  var r = await renderVm(host, v, opts);
  var out = await signedAudio(host, r.wav, format, r.song, r.facts);
  return { bytes: out.bytes, mime: AUDIO_MIME[format], filename: fileStem(r.song.name) + '.' + format, sentence: audioSentence(null, out, r.song, r.facts) };
}

// ── MIDI: a text event carries the statement ──────────────────────────────────

function vlq(n) {
  var out = [n & 0x7f];
  while ((n >>= 7) > 0) out.unshift((n & 0x7f) | 0x80);
  return out;
}

/** The statement a MIDI file of the song carries, as rondoDeclaration words it for notes. */
function midiStatement(song, facts) {
  return 'Notes computed on the device from the code of the rondocode song "' + song.name + '" (' + facts.executionClass
    + ' execution class, rondocode ' + facts.version + '). No audio and no trained model.';
}

/** `smf` with a text event (FF 01) at the start of its first track. */
function midiWithText(smf, text) {
  if (smf.length < 22 || String.fromCharCode(smf[0], smf[1], smf[2], smf[3]) !== 'MThd') throw new Error('The MIDI file the editor made is not one.');
  var at = 8 + new DataView(smf.buffer, smf.byteOffset).getUint32(4);
  if (String.fromCharCode(smf[at], smf[at + 1], smf[at + 2], smf[at + 3]) !== 'MTrk') throw new Error('The MIDI file the editor made has no track.');
  var body = new TextEncoder().encode(text);
  var ev = [0x00, 0xff, 0x01].concat(vlq(body.length));
  var add = ev.length + body.length;
  var out = new Uint8Array(smf.length + add);
  out.set(smf.subarray(0, at + 8), 0);
  var dv = new DataView(out.buffer);
  dv.setUint32(at + 4, new DataView(smf.buffer, smf.byteOffset).getUint32(at + 4) + add);
  out.set(ev, at + 8);
  out.set(body, at + 8 + ev.length);
  out.set(smf.subarray(at + 8), at + 8 + add);
  return out;
}

/** The text of the first track's first event, when it is a text event. */
function midiFirstText(smf) {
  try {
    var at = 8 + new DataView(smf.buffer, smf.byteOffset).getUint32(4) + 8;
    if (smf[at] !== 0x00 || smf[at + 1] !== 0xff || smf[at + 2] !== 0x01) return null;
    var i = at + 3, len = 0, b;
    do { b = smf[i++]; len = (len << 7) | (b & 0x7f); } while (b & 0x80);
    return new TextDecoder().decode(smf.subarray(i, i + len));
  } catch (e) { return null; }
}

// ── ZIP: stored entries, for the stems ────────────────────────────────────────

var CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP of `files` ({ name, bytes }), stored uncompressed, dated 1980-01-01 so the bytes repeat. */
function zipStored(files) {
  var parts = [], central = [], offset = 0;
  files.forEach(function (f) {
    var name = new TextEncoder().encode(f.name);
    var crc = crc32(f.bytes);
    var head = new Uint8Array(30 + name.length);
    var h = new DataView(head.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
    h.setUint32(18, f.bytes.length, true); h.setUint32(22, f.bytes.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    head.set(name, 30);
    var dir = new Uint8Array(46 + name.length);
    var d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true); d.setUint16(10, 0, true);
    d.setUint16(12, 0, true); d.setUint16(14, 0x21, true); d.setUint32(16, crc, true); d.setUint32(20, f.bytes.length, true); d.setUint32(24, f.bytes.length, true);
    d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
    dir.set(name, 46);
    parts.push(head, f.bytes);
    central.push(dir);
    offset += head.length + f.bytes.length;
  });
  var dirLen = central.reduce(function (n, c) { return n + c.length; }, 0);
  var end = new Uint8Array(22);
  var e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, dirLen, true); e.setUint32(16, offset, true);
  var all = parts.concat(central, [end]);
  var out = new Uint8Array(all.reduce(function (n, c) { return n + c.length; }, 0));
  var at = 0;
  all.forEach(function (c) { out.set(c, at); at += c.length; });
  return out;
}

/** A part name made safe for a file name. */
function partSlug(part) {
  return String(part).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'part';
}

/**
 * Finish an export the editor rendered: encode, sign, read back and save.
 * `job` is the frame's message, already checked by the template; `version` is
 * the editor's own (its file's lolly-rondo-version). Resolves the sentence to
 * show, said from what was read back.
 */
async function exportSong(host, job, version) {
  var song = { name: cleanName(job.song.name), lang: langOf(job.song.lang), code: job.song.code };
  var stem = fileStem(song.name);
  var facts = {
    // The editor's own render ran in its opaque-origin frame (plans/301; the
    // document model names this class `frame` as an open point).
    executionClass: 'frame', version: version,
    sungParts: job.sung.slice(), voices: job.voices.slice(), silentParts: job.silent.slice(),
  };
  // Into the person's Assets (host.assets.add, which says what it saved, with
  // Undo), or a download. A refusal is said by name.
  var toAssets = job.dest === 'assets' && host.assets && typeof host.assets.add === 'function';
  var save = function (bytes, filename, mime) {
    if (!toAssets) return host.export.file(new Blob([bytes], { type: mime }), { filename: filename });
    return host.assets.add({ name: filename, bytes: bytes, mime: mime }).catch(function (e) {
      throw new Error('Not saved to Assets: ' + (e && e.message || e) + (e && e.code ? ' (' + e.code + ')' : ''));
    });
  };
  // A save to Assets has its own message, so the sentence keeps only what was read back.
  var savedAs = function (file) { return toAssets ? '' : 'Saved ' + file + '. '; };

  if (job.format === 'json') {
    var file = stem + '.rondo.json';
    await save(sourceBytes(song), file, 'application/json');
    return toAssets ? '' : 'Saved ' + file + '. A song file is your code as it is, so it carries no Content Credentials.';
  }

  if (job.format === 'mid') {
    var text = midiStatement(song, { executionClass: 'frame', version: version });
    var midi = midiWithText(new Uint8Array(job.midi), text);
    var mfile = stem + '.mid';
    await save(midi, mfile, 'audio/midi');
    return midiFirstText(midi) === text
      ? savedAs(mfile) + 'MIDI has no place for Content Credentials, so none were written; read back from the file, a text event in it says it was computed from the song "' + song.name + '".'
      : savedAs(mfile) + 'MIDI has no place for Content Credentials, so none were written, and its text event did not read back.';
  }

  if (job.format === 'zip' && toAssets) throw new Error('Stems are a ZIP of WAV files, which Assets does not keep. Choose Download for them.');

  if (job.format === 'zip') {
    var files = [], confirmed = 0, unsigned = [], aiStems = [];
    for (var i = 0; i < job.stems.length; i++) {
      var st = job.stems[i];
      var isBus = /-bus-/.test(st.name);
      // A bus stem mixes parts through one effects chain and cannot be split, so
      // it declares every sung part rather than risk leaving one out.
      var stemSung = facts.sungParts.indexOf(st.part) >= 0 ? [st.part] : isBus ? facts.sungParts.slice() : [];
      var stemFacts = { executionClass: 'frame', version: version, sungParts: stemSung, voices: stemSung.length ? facts.voices : [], silentParts: facts.silentParts };
      var out = await signedAudio(host, new Uint8Array(st.bytes), 'wav', song, stemFacts);
      var name = stem + '-' + (isBus ? 'bus-' : '') + partSlug(st.part) + '.wav';
      if (!out.signed) unsigned.push(name);
      else if (out.check && out.check.found && (!stemSung.length || out.check.ai)) {
        confirmed++;
        if (stemSung.length) aiStems.push(name);
      }
      files.push({ name: stem + '-stems/' + name, bytes: out.bytes });
    }
    var zfile = stem + '-stems.zip';
    await save(zipStored(files), zfile, 'application/zip');
    var count = files.length === 1 ? 'one WAV stem' : files.length + ' WAV stems';
    var msg = 'Saved ' + zfile + ' with ' + count + '. Read back from ' + (files.length === 1 ? 'it' : 'each') + ': ' + confirmed + ' of ' + files.length + ' carr' + (confirmed === 1 ? 'ies' : 'y') + ' Content Credentials recording the song "' + song.name + '"';
    msg += aiStems.length ? ', and ' + aiStems.join(', ') + ' declare' + (aiStems.length === 1 ? 's' : '') + ' AI-generated singing.' : '.';
    if (unsigned.length) msg += ' Saved without credentials: ' + unsigned.join(', ') + '.';
    return msg + ' The ZIP itself carries none.';
  }

  if (!AUDIO_MIME[job.format]) throw new Error('Rondocode does not export ' + job.format + '.');
  var res = await signedAudio(host, new Uint8Array(job.audio), job.format, song, facts);
  var afile = stem + '.' + job.format;
  // Send: the system share sheet, when this app has one and it takes the file.
  if (job.send && host.export && typeof host.export.share === 'function') {
    var shared = await host.export.share(new Blob([res.bytes], { type: AUDIO_MIME[job.format] }), { filename: afile, mime: AUDIO_MIME[job.format], title: song.name });
    if (shared) return audioSentence(afile, res, song, facts, true);
  }
  await save(res.bytes, afile, AUDIO_MIME[job.format]);
  return audioSentence(toAssets ? null : afile, res, song, facts);
}

/**
 * A file upstream's own controls made (a live recording, a project export).
 * A WAV is signed as a render from the frame before it is saved; anything
 * else is saved as it came.
 */
async function saveDownload(host, d, version) {
  var name = d.name;
  if (d.mime === 'audio/wav' && d.song) {
    var song = { name: cleanName(d.song.name), lang: langOf(d.song.lang), code: d.song.code };
    var facts = { executionClass: 'frame', version: version, sungParts: d.sung.slice(), voices: (d.voices || []).slice(), silentParts: [] };
    var out = await signedAudio(host, new Uint8Array(d.bytes), 'wav', song, facts);
    await host.export.file(new Blob([out.bytes], { type: 'audio/wav' }), { filename: name });
    return audioSentence(name, out, song, facts);
  }
  await host.export.file(new Blob([d.bytes], { type: d.mime }), { filename: name });
  return 'Saved ' + name + '.';
}

function sourceFile(v) {
  var song = songOf(v);
  return { bytes: sourceBytes(song), mime: 'application/json', filename: fileStem(song.name) + '.rondo.json' };
}

/** A line's kind for the card: a comment, a line that starts a part, or code. */
function rowKind(line) {
  var t = line.trim();
  if (/^(#|\/\/)/.test(t)) return 'comment';
  if (/^(synth|play|bus|section|cps|bpm|level|master|sidechain|const|let|p\(|defineSynth|setCps|setBpm)\b/.test(t)) return 'part';
  return 'code';
}

/** A song card for a render with no live editor (the CLI has no DOM to run one). */
function card(v) {
  var song = songOf(v);
  var lines = song.code.split('\n');
  // the song's own lines, after its opening comment block
  var first = 0;
  while (first < lines.length - 1 && /^\s*(#|\/\/|$)/.test(lines[first])) first++;
  var shown = lines.slice(first, first + 8).concat(lines.length > first + 8 ? ['…'] : []);
  var seconds = Number(v.length);
  return {
    name: song.name,
    lang: song.lang === 'rondo' ? 'rondo' : song.lang === 'js' ? 'JavaScript' : 'rondo or JavaScript',
    lines: lines.length + (lines.length === 1 ? ' line' : ' lines'),
    length: seconds > 0 ? seconds + ' s' : 'Own length',
    rows: shown.map((l) => ({ text: l.length > 48 ? l.slice(0, 47) + '…' : l, kind: rowKind(l) })),
  };
}

/** The bridge the template reads: the few host calls the template needs. */
function exposeBridge(host) {
  if (typeof window === 'undefined' || !host) return;
  var models = host.models && typeof host.models.files === 'function' ? host.models : null;
  window.__lollyRondocode = {
    loadLibrary: function () {
      return host.state && typeof host.state.load === 'function' ? host.state.load(LIBRARY_SLOT) : Promise.resolve(null);
    },
    saveLibrary: function (data) {
      return host.state && typeof host.state.save === 'function' ? host.state.save(LIBRARY_SLOT, data) : Promise.resolve();
    },
    saveFile: function (bytes, filename, mime) {
      return host.export.file(new Blob([bytes], { type: mime || 'application/octet-stream' }), { filename: filename });
    },
    songFile: function (model) { return sourceFile(vals(model)); },
    exportSong: function (job, version) { return exportSong(host, job, version); },
    saveDownload: function (d, version) { return saveDownload(host, d, version); },
    /** What the editor's Export panel may offer, and whether files get signed. */
    capabilities: function () {
      var clean = !!(host.audio && typeof host.audio.clean === 'function');
      var canSend = false;
      try { canSend = !!(host.export && typeof host.export.share === 'function' && typeof host.export.canShare === 'function' && host.export.canShare({ mime: 'audio/mpeg', filename: 'song.mp3' })); } catch (e) { canSend = false; }
      return {
        encoders: clean ? ['mp3', 'm4a', 'opus', 'flac'] : [],
        credentials: !!(host.c2pa && typeof host.c2pa.sign === 'function'),
        canSend: canSend,
        assets: !!(host.assets && typeof host.assets.add === 'function'),
      };
    },
    brandColors: function () {
      if (!host.tokens || typeof host.tokens.colors !== 'function') return Promise.resolve([]);
      return host.tokens.colors().then(function (list) {
        return (list || []).map(function (c) { return c && c.value; }).filter(function (v) { return typeof v === 'string'; });
      });
    },
    lastFindings: function () { return _lastFindings.slice(); },
    /** The visualiser presets: Lolly's own, then the artist pack, with authors. */
    vizPresets: function () {
      return host.viz && typeof host.viz.presets === 'function' ? host.viz.presets().catch(function () { return []; }) : Promise.resolve([]);
    },
    singModels: models ? function (paths, onProgress) {
      return models.files('sing', paths, { reason: 'Rondocode: singing voices for this song', onProgress: onProgress });
    } : null,
  };
}

function compute(ctx) {
  exposeBridge(ctx.host);
  // The card is for a shell with no live editor (the CLI, the TUI, the MCP
  // server). In a browser the template keeps its markup unchanged, so the live
  // editor is never rebuilt.
  if (!ctx.host || ctx.host.shell !== 'cli') return {};
  return { card: card(vals(ctx.model)) };
}

function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }

/** The tool's file: signed WAV by default, another audio format when asked, or the source. */
async function exportFile(ctx) {
  var v = vals(ctx.model);
  var fmt = ctx.opts && ctx.opts.format;
  if (fmt === 'json' || fmt === 'rondo') return sourceFile(v);
  var file = await renderAudio(ctx.host, v, ctx.opts, AUDIO_MIME[fmt] ? fmt : 'wav');
  return { bytes: file.bytes, mime: file.mime, filename: file.filename };
}

/**
 * `--export=<format>` on the CLI: the song as signed audio, or its source.
 * A format the shell cannot encode is refused by name; the image formats are
 * the card.
 */
async function exportStill(ctx) {
  var v = vals(ctx.model);
  if (ctx.format === 'json') {
    var src = sourceFile(v);
    return { bytes: src.bytes, mime: src.mime };
  }
  if (!AUDIO_MIME[ctx.format]) return null;
  var file;
  try {
    file = await renderAudio(ctx.host, v, ctx.opts, ctx.format);
  } catch (e) {
    throw new Error('Rondocode could not write ' + ctx.format.toUpperCase() + ': ' + (e && e.message || e));
  }
  // Said after the file was read back, and only what the read found.
  if (ctx.host && typeof ctx.host.log === 'function') ctx.host.log('info', file.sentence);
  return { bytes: file.bytes, mime: file.mime };
}
