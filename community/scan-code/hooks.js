/* scan-code - a safe, fully-offline code reader (plans/162 Part 2).
 *
 * A scanned code is untrusted input wearing a friendly costume. This tool is a
 * READER, not an opener: it decodes, classifies, explains, and lets the user act
 * deliberately. Nothing is automatic - no auto-open, auto-join, auto-dial,
 * auto-import. The primary action is always Copy; "Open"/"Join"/"Add" are
 * explicit taps that first show exactly what will happen.
 *
 * Everything here is pure string work over a decoded value (host.scan does the
 * decoding, DOM-free, in the shell). The classifier is unit-tested via the
 * `paste` mode, which runs the same safety analysis on a value typed in by hand.
 *
 * Sources of the value, in order the hooks set `_scanned`:
 *   - paste mode: the `paste` input, verbatim;
 *   - image mode: host.raster.decode(file) -> RGBA -> host.scan.detect (browser);
 *   - camera mode: onFrame -> host.scan.detect (browser).
 * The CLI has no canvas/camera, so it degrades to paste mode + `lolly scan`.
 */

// ─── Safety helpers ──────────────────────────────────────────────────────────

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Mask a secret completely - reveal NO characters (not even the ends: a
// six-char Wi-Fi PIN or a short 2FA seed is fully guessable from its ends).
// The real value is shown only behind an explicit Reveal tap.
function _mask(s) {
  s = String(s == null ? '' : s);
  if (!s.length) return '';
  return '•'.repeat(Math.max(4, Math.min(12, s.length)));
}

// An IDN look-alike vector: a hostname with non-ASCII characters (a Unicode
// homoglyph) OR one already in ACE/punycode form (an `xn--` label - the exact
// encoding an attacker embeds to dodge a Unicode-only check).
function _hasNonAscii(s) { return /[^\x00-\x7F]/.test(String(s || '')); }
function _isIdnHost(s) { return _hasNonAscii(s) || /(^|\.)xn--/i.test(String(s || '')); }

// Punycode-encode a unicode host label for the dual render (ASCII form), using
// the platform URL parser where present; falls back to the raw string.
function _asciiHost(host) {
  try {
    if (typeof URL === 'function') return new URL('http://' + host).hostname;
  } catch (e) { /* fall through */ }
  return host;
}

var _SHORTENERS = [
  'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  't.ly', 'rebrand.ly', 'cutt.ly', 'lnkd.in', 'rb.gy', 'shorturl.at', 'qr.link',
];

var _SAFE_SCHEMES = ['http', 'https'];
// Schemes that must NEVER get a tappable "open" - they run code or reach the
// device/filesystem. Rendered as inert text with a plain warning.
var _DANGER_SCHEMES = ['javascript', 'data', 'file', 'intent', 'vbscript', 'blob', 'about'];

// ─── URL scrutiny (safety item 2 - the full treatment) ───────────────────────

function _classifyUrl(raw) {
  var scheme = (String(raw).match(/^([a-z][a-z0-9+.\-]*):/i) || [])[1];
  scheme = scheme ? scheme.toLowerCase() : '';
  var warnings = [];
  var out = { kind: 'url', label: 'Link', value: raw, scheme: scheme, openable: false, fields: [] };

  if (_DANGER_SCHEMES.indexOf(scheme) >= 0) {
    warnings.push('This is a "' + scheme + ':" link, which can run code or reach your device - it is shown as text and is never openable from here.');
    out.warnings = warnings;
    out.label = 'Link (' + scheme + ':)';
    return out;
  }

  // The AUTHORITATIVE host is the platform URL parser's hostname - the site a
  // browser would ACTUALLY open. The hand-rolled regex is a fallback only for
  // schemes URL can't parse, and never overrides the parser: that was the
  // backslash-@ authority-confusion bug (browsers normalise "\" to "/", ending
  // the authority before an "@decoy", so a regex that treated "\" as an ordinary
  // char read the decoy as the host and vouched for the wrong site). Warnings
  // here are PLAIN text - _viewModel escapes them once (no double-escaping).
  var host = '', userinfo = '';
  try {
    if (typeof URL === 'function') {
      var u = new URL(raw);
      host = u.hostname;
      userinfo = u.username || '';
    }
  } catch (e) { /* not a parseable absolute URL */ }
  if (!host) {
    var m = String(raw).match(/^[a-z][a-z0-9+.\-]*:\/\/([^\/?#\\]*)/i); // stop at "\" too
    if (m) {
      var auth = m[1];
      var at = auth.lastIndexOf('@');
      if (at >= 0) { userinfo = auth.slice(0, at); host = auth.slice(at + 1); }
      else host = auth;
      host = host.replace(/:\d+$/, '');
    }
  }
  // A backslash anywhere in the authority is an authority-confusion trick.
  var backslash = /^[a-z][a-z0-9+.\-]*:\/\/[^/?#]*\\/i.test(raw);

  out.host = host;
  out.openable = _SAFE_SCHEMES.indexOf(scheme) >= 0 && !backslash;

  if (backslash) {
    warnings.push('This link uses a backslash in its address, which makes browsers open a DIFFERENT site than it appears to (it would open "' + (host || 'an unclear host') + '"). It is shown as text and is not openable from here.');
  }
  if (userinfo) {
    warnings.push('This link carries login info before the "@" (' + userinfo + '@…), a classic trick to make a strange site look familiar. A browser would open "' + (host || 'an unclear host') + '".');
  }
  if (scheme === 'http') {
    warnings.push('This is a plain http:// link (not encrypted). Anything you send is in the clear.');
  }
  if (host && _isIdnHost(host)) {
    out.hostAscii = host; // already ASCII/punycode - the honest form
    warnings.push('This is an internationalised domain (punycode "' + host + '"). It can be made to LOOK like a familiar name in a browser - a look-alike is a common trick, so verify it carefully before opening.');
  }
  var bare = host.replace(/^www\./, '').toLowerCase();
  if (_SHORTENERS.indexOf(bare) >= 0) {
    warnings.push('This is a link shortener (' + bare + '); the real destination is unknown until it is opened.');
  }
  out.warnings = warnings;
  return out;
}

// ─── Structured payloads (safety item 4) ─────────────────────────────────────

function _kv(fields, label, value) { if (value != null && String(value) !== '') fields.push({ label: label, value: String(value) }); }

// WIFI:S:ssid;T:WPA;P:pass;H:true;;  (password MASKED by default - item 3)
function _classifyWifi(raw) {
  var body = raw.slice(5);
  var map = {};
  // Fields are ;-separated key:value with \-escaped separators.
  body.replace(/([A-Z]):((?:[^\\;]|\\.)*)/g, function (_, k, v) { map[k] = v.replace(/\\(.)/g, '$1'); return ''; });
  var fields = [];
  _kv(fields, 'Network', map.S);
  _kv(fields, 'Security', map.T || 'nopass');
  if (map.H === 'true') _kv(fields, 'Hidden', 'yes');
  var out = { kind: 'wifi', label: 'Wi-Fi network', fields: fields, warnings: [] };
  if (map.P) { out.secret = { label: 'Password', value: map.P, masked: _mask(map.P) }; }
  return out;
}

// otpauth://totp/Label?secret=BASE32&issuer=...  (secret MASKED - item 3)
function _classifyOtp(raw) {
  var fields = [];
  var q = {};
  var qs = (raw.split('?')[1] || '');
  qs.split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) q[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); });
  var labelPart = (raw.split('?')[0] || '').replace(/^otpauth:\/\/(totp|hotp)\//i, '');
  _kv(fields, 'Type', /hotp/i.test(raw) ? 'HOTP' : 'TOTP');
  _kv(fields, 'Account', decodeURIComponent(labelPart || ''));
  _kv(fields, 'Issuer', q.issuer);
  var out = { kind: 'otpauth', label: 'Authenticator key', fields: fields, warnings: ['This is a two-factor secret. Add it only to a device you trust - anyone with it can generate your codes.'] };
  if (q.secret) out.secret = { label: 'Secret', value: q.secret, masked: _mask(q.secret) };
  return out;
}

// MECARD:N:Last,First;TEL:...;EMAIL:...;URL:...;;
function _classifyMecard(raw) {
  var map = {};
  raw.slice(7).replace(/([A-Z]+):((?:[^\\;]|\\.)*)/g, function (_, k, v) { map[k] = v.replace(/\\(.)/g, '$1'); return ''; });
  var fields = [];
  _kv(fields, 'Name', (map.N || '').split(',').reverse().join(' ').trim());
  _kv(fields, 'Phone', map.TEL);
  _kv(fields, 'Email', map.EMAIL);
  _kv(fields, 'URL', map.URL);
  return { kind: 'contact', label: 'Contact (MECARD)', fields: fields, warnings: [] };
}

// vCard 3.0/4.0
function _classifyVcard(raw) {
  var fields = [];
  var get = function (re) { var m = raw.match(re); return m ? m[1].trim() : ''; };
  _kv(fields, 'Name', get(/\nFN:(.+)/i) || get(/\nN:(.+)/i));
  _kv(fields, 'Org', get(/\nORG:(.+)/i));
  _kv(fields, 'Title', get(/\nTITLE:(.+)/i));
  _kv(fields, 'Phone', get(/\nTEL[^:]*:(.+)/i));
  _kv(fields, 'Email', get(/\nEMAIL[^:]*:(.+)/i));
  _kv(fields, 'URL', get(/\nURL[^:]*:(.+)/i));
  var out = { kind: 'contact', label: 'Contact card (vCard)', fields: fields, warnings: [] };
  if (!fields.length) out.warnings.push('This looks like a vCard but carries no readable fields - it may be malformed.');
  return out;
}

// VEVENT (inside a VCALENDAR)
function _classifyEvent(raw) {
  var fields = [];
  var get = function (re) { var m = raw.match(re); return m ? m[1].trim() : ''; };
  _kv(fields, 'Event', get(/\nSUMMARY:(.+)/i));
  _kv(fields, 'Starts', get(/\nDTSTART[^:]*:(.+)/i));
  _kv(fields, 'Ends', get(/\nDTEND[^:]*:(.+)/i));
  _kv(fields, 'Where', get(/\nLOCATION:(.+)/i));
  var out = { kind: 'event', label: 'Calendar event', fields: fields, warnings: [] };
  if (!/BEGIN:VEVENT/i.test(raw) || !/DTSTART/i.test(raw)) out.warnings.push('Carried by the symbol, but not a valid calendar event (no start time).');
  return out;
}

function _classifyGeo(raw) {
  var m = raw.match(/^geo:(-?[\d.]+),(-?[\d.]+)/i);
  var fields = [];
  if (m) { _kv(fields, 'Latitude', m[1]); _kv(fields, 'Longitude', m[2]); }
  var out = { kind: 'geo', label: 'Location', fields: fields, value: raw, warnings: [] };
  if (!m) out.warnings.push('Carried by the symbol, but not a valid geo: coordinate.');
  return out;
}

function _classifyTelLike(raw, scheme) {
  // Strip the ACTUAL scheme prefix by the colon, not the mapped scheme's length -
  // SMSTO: has a longer prefix than the 'sms' kind it maps to, and slicing by the
  // mapped length leaked "O:" into the number (safety-parse finding).
  var colon = raw.indexOf(':');
  var body = (colon >= 0 ? raw.slice(colon + 1) : raw).split('?')[0];
  var labels = { tel: 'Phone number', sms: 'Text message', mailto: 'Email address' };
  var fields = [];
  var val = body; try { val = decodeURIComponent(body); } catch (e) { /* keep raw on bad %-encoding */ }
  _kv(fields, labels[scheme] ? labels[scheme].split(' ')[0] : scheme, val);
  return { kind: scheme, label: labels[scheme] || scheme, value: raw, fields: fields,
    warnings: ['Nothing is dialled, texted or emailed until you choose to. Check the ' + (labels[scheme] || scheme).toLowerCase() + ' first.'] };
}

// Matter (MT:...) pairing code - vendor/product/discriminator surfaced, setup
// code masked (the home-automation case, safety item 4).
function _classifyMatter(raw) {
  return { kind: 'matter', label: 'Matter pairing code', fields: [{ label: 'Type', value: 'Smart-home device setup' }],
    secret: { label: 'Setup code', value: raw, masked: _mask(raw) },
    warnings: ['A device pairing code. Use it only in your own smart-home app; it lets a device onto your network.'] };
}

// GS1 element strings or a GS1 Digital Link URL -> a human table of AIs.
var _GS1_AI = { '00': 'SSCC', '01': 'GTIN', '10': 'Batch/Lot', '11': 'Prod date', '17': 'Expiry', '21': 'Serial', '30': 'Count', '3103': 'Weight (kg)' };
function _classifyGs1(raw) {
  var fields = [];
  var body = raw;
  // Digital Link: https://id.example/01/09521.../10/LOT -> read the /AI/value pairs.
  var dl = raw.match(/https?:\/\/[^/]+\/(01\/.*)$/i);
  if (dl) {
    dl[1].split('/').forEach(function (seg, i, a) { if (i % 2 === 0 && a[i + 1] != null && _GS1_AI[seg]) fields.push({ label: '(' + seg + ') ' + _GS1_AI[seg], value: a[i + 1] }); });
  } else {
    body.replace(/\((\d{2,4})\)([^(]*)/g, function (_, ai, val) { fields.push({ label: '(' + ai + ') ' + (_GS1_AI[ai] || 'AI ' + ai), value: val }); return ''; });
  }
  var out = { kind: 'gs1', label: 'GS1 product / logistics code', fields: fields, warnings: [] };
  if (!fields.length) out.warnings.push('Looks like GS1 data but no application identifiers could be read.');
  return out;
}

// ─── The classifier (safety item 1: nothing automatic; Copy is primary) ──────

function classify(rawValue, format) {
  var raw = String(rawValue == null ? '' : rawValue);
  if (!raw) return { kind: 'empty', label: 'Nothing decoded', fields: [], warnings: [], copy: '' };

  var lower = raw.toLowerCase();
  var scheme = (raw.match(/^([a-z][a-z0-9+.\-]*):/i) || [])[1];
  scheme = scheme ? scheme.toLowerCase() : '';

  var r;
  if (/^wifi:/i.test(raw)) r = _classifyWifi(raw);
  else if (scheme === 'otpauth') r = _classifyOtp(raw);
  else if (/^mecard:/i.test(raw)) r = _classifyMecard(raw);
  else if (/^begin:vcard/i.test(raw)) r = _classifyVcard(raw);
  else if (/begin:vevent/i.test(lower) || /begin:vcalendar/i.test(lower)) r = _classifyEvent(raw);
  else if (scheme === 'geo') r = _classifyGeo(raw);
  else if (scheme === 'tel' || scheme === 'sms' || scheme === 'smsto' || scheme === 'mailto') r = _classifyTelLike(raw, scheme === 'smsto' ? 'sms' : scheme);
  else if (/^mt:/i.test(raw)) r = _classifyMatter(raw);
  // GS1 ELEMENT STRINGS only (no scheme). A GS1 Digital Link is a URL and MUST
  // keep its URL safety scrutiny - it is handled in the scheme branch below, where
  // the AI table is appended WITHOUT losing the openable/host checks. (Routing
  // "/01/<digit>" URLs straight to GS1 was a scrutiny bypass - safety-parse finding.)
  else if (/^\(\d{2,4}\)/.test(raw)) r = _classifyGs1(raw);
  else if (scheme) {
    r = _classifyUrl(raw);
    if (r.openable && /\/01\/\d/.test(raw)) {
      var dl = _classifyGs1(raw);
      if (dl.fields && dl.fields.length) { r.gs1 = true; r.fields = (r.fields || []).concat(dl.fields); }
    }
  }
  else r = { kind: 'text', label: 'Plain text', value: raw, fields: [], warnings: [] };

  // Credential guard (item 3): flag a scanned secret. Runs on free text AND on
  // URLs (a key/token in a query string is the common case) - not just kind==='text'.
  if ((r.kind === 'text' || r.kind === 'url') && /(?:password|passwd|api[_-]?key|secret|token|bearer|access[_-]?token)\b\s*[:=]\s*\S/i.test(raw)) {
    r.warnings = (r.warnings || []).concat('This ' + (r.kind === 'url' ? 'link' : 'text') + ' looks like it contains a password or key. It is shown masked; reveal it only if you expect a secret here.');
    r.looksSecret = true;
  }

  r.format = format || '';
  r.raw = raw;
  // What Copy puts on the clipboard: the exact payload, never a mask.
  r.copy = raw;
  r.warnings = r.warnings || [];
  return r;
}

// ─── View model for the template ─────────────────────────────────────────────

function _viewModel(c) {
  if (!c || c.kind === 'empty') {
    return { scanKind: '', scanLabel: '', scanEmpty: true, scanFieldsHtml: '', scanWarnHtml: '', scanCopy: '', scanValueHtml: '', scanOpen: '', scanSummary: 'Nothing decoded yet' };
  }
  var fieldsHtml = (c.fields || []).map(function (f) {
    return '<div class="sc-field"><span class="sc-field__k">' + _esc(f.label) + '</span><span class="sc-field__v">' + _esc(f.value) + '</span></div>';
  }).join('');
  if (c.secret) {
    fieldsHtml += '<div class="sc-field sc-field--secret"><span class="sc-field__k">' + _esc(c.secret.label) + '</span>'
      + '<span class="sc-field__v" data-secret="' + _esc(c.secret.value) + '" data-mask="' + _esc(c.secret.masked) + '">' + _esc(c.secret.masked) + '</span>'
      + '<button type="button" class="sc-reveal" data-reveal data-open="0">Reveal</button></div>';
  }
  var warnHtml = (c.warnings || []).map(function (w) { return '<li>' + _esc(w) + '</li>'; }).join('');
  // The value block: shown for url/text/geo (masked if it looks secret).
  var valueHtml = '';
  if (c.kind === 'url' || c.kind === 'text' || c.kind === 'geo') {
    var shown = (c.looksSecret ? _mask(c.value || c.raw) : (c.value || c.raw));
    valueHtml = '<div class="sc-value' + (c.looksSecret ? ' sc-value--secret' : '') + '">' + _esc(shown) + '</div>';
    if (c.hostAscii) valueHtml += '<div class="sc-punycode">punycode: ' + _esc(c.hostAscii) + '</div>';
  }
  return {
    scanKind: c.kind,
    scanLabel: c.label,
    scanEmpty: false,
    scanFieldsHtml: fieldsHtml,
    scanWarnHtml: warnHtml,
    scanHasWarn: (c.warnings || []).length > 0,
    scanCopy: c.copy,
    scanValueHtml: valueHtml,
    scanOpenUrl: c.openable ? (c.value || c.raw) : '',
    scanFormat: c.format,
    scanSummary: c.label + (c.host ? ' · ' + c.host : ''),
  };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

// The most recent decoded value, so onInput (paste) and onFrame (camera) share
// one render path. Kept at module scope; the runtime re-runs hooks per change.
var _scanned = null;

function _result(c) {
  var vm = _viewModel(c);
  vm.a11yScan = vm.scanEmpty ? 'No code scanned yet.' : (c.label + '. ' + ((c.warnings || []).length ? (c.warnings.length + ' safety notes.') : 'No safety notes.'));
  return vm;
}

// Can this host actually open a camera? getUserMedia only exists in a secure
// context - https or localhost - so over plain http on a phone (a LAN-IP dev
// server) the browser blocks the camera outright and never even prompts. The
// viewfinder uses this to explain that dead-end and point at image/paste,
// instead of an unactionable "turn the camera on".
function _camReady(host) {
  try { return !!(host && host.media && typeof host.media.isAvailable === 'function' && host.media.isAvailable()); }
  catch (e) { return false; }
}

function onInit({ model, host }) {
  var args = _args(model);
  var vm = (args.mode === 'paste' && _str(args.paste)) ? _result(classify(args.paste, 'manual')) : _result(_scanned);
  vm.scanCameraReady = _camReady(host);
  return vm;
}

async function onInput({ model, host }) {
  var args = _args(model);
  var vm = null;
  if (args.mode === 'paste') {
    vm = _result(_str(args.paste) ? classify(args.paste, 'manual') : null);
  } else if (args.mode === 'image' && args.image && args.image.bytes && host && host.scan) {
    try {
      var frame = await _decodeToFrame(args.image.bytes, host);
      if (frame) {
        var formats = _formatsFilter(args.formats);
        var hits = await host.scan.detect(frame, formats ? { formats: formats } : undefined);
        vm = (hits && hits.length)
          ? _result((_scanned = classify(hits[0].rawValue, hits[0].format)))
          : _result({ kind: 'empty', label: 'No code found in this image', fields: [], warnings: [] });
      }
    } catch (e) { /* fall through to whatever was last scanned */ }
  }
  if (!vm) vm = _result(_scanned);
  vm.scanCameraReady = _camReady(host);
  return vm;
}

// Camera: the runtime hands one RGBA frame per tick (throttled; overlapping frames
// dropped). Every frame is SHOWN so the user can line the code up in the viewfinder;
// the decode is throttled separately (it's ~O(frame) and needn't run every frame),
// and the last result + found-quad persist between decodes.
var _lastTickT = 0;       // last frame we did real work + re-rendered on
var _lastDecodeT = 0;
var _lastCorners = '';    // "x,y x,y x,y x,y" polygon points in frame coords, or ''
async function onFrame({ frame, model, host }) {
  if (!host || !frame) return null;

  // THROTTLE the whole loop to ~12fps. Encoding every camera frame to a JPEG data-URL and
  // re-hydrating the viewfinder each tick saturated the phone's main thread: the preview
  // flickered and taps on Home/back stopped registering, trapping the user in the tool
  // (iOS, 2026-08). ~12fps is smooth to the eye and leaves the thread idle enough to stay
  // responsive; the runtime already drops overlapping frames, so a sub-budget frame is a
  // cheap early return. `frame.t` is a monotonic ms stamp - reset the gates if it restarts.
  if (frame.t < _lastTickT) { _lastTickT = 0; _lastDecodeT = 0; }
  if (_lastTickT && frame.t - _lastTickT < 80) return null;
  _lastTickT = frame.t;
  var args = _args(model);

  // Decode less often than we preview (~7/s): it is ~O(frame) and the last result +
  // found-quad persist between decodes, so the panel stays put while the view updates.
  if (host.scan && (!_lastDecodeT || frame.t - _lastDecodeT >= 140)) {
    _lastDecodeT = frame.t;
    var formats = _formatsFilter(args.formats);
    var hits = await host.scan.detect(frame, formats ? { formats: formats } : undefined);
    if (hits && hits.length) {
      _scanned = classify(hits[0].rawValue, hits[0].format);
      _lastCorners = hits[0].corners ? _cornerPoints(hits[0].corners) : '';
    }
  }
  var src = await _encodeFrame(frame, host);
  var vm = _result(_scanned);      // last decode's result panel (persists between decodes)
  // A failed encode must not replace the last visible frame with the start hint.
  if (src) vm.scanFrameSrc = src;
  vm.scanFrameW = frame.width;
  vm.scanFrameH = frame.height;
  vm.scanCorners = _lastCorners;   // found-code quad overlay, in frame coords
  vm.scanLive = true;
  return vm;
}

// A found quad -> SVG polygon points in FRAME coordinates (the viewfinder SVG uses
// the frame's viewBox, so no remapping is needed).
function _cornerPoints(corners) {
  if (!Array.isArray(corners)) return '';
  return corners.map(function (p) { return (p[0] | 0) + ',' + (p[1] | 0); }).join(' ');
}

// ─── small utils ─────────────────────────────────────────────────────────────

function _args(model) { return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; })); }
function _str(v) { return v == null ? '' : String(v).trim(); }
function _formatsFilter(v) {
  if (!v) return null;
  var arr = Array.isArray(v) ? v : String(v).split(',');
  arr = arr.map(function (s) { return String(s).trim(); }).filter(Boolean);
  return arr.length ? arr : null;
}

// Decode an uploaded image's bytes to an RGBA frame for host.scan. Uses
// host.raster (browser/Worker canvas) where present; returns null on the headless
// CLI (which has no canvas - the CLI's `lolly scan` path decodes via sharp).
// Encode a live RGBA frame to a data: URL so the template's viewfinder can show
// it. Prefers host.raster.encode (DOM-free - works in a hook Worker); falls back
// to a canvas where present. Returns '' if it can't (the template then shows the
// "point the camera" hint). JPEG keeps the per-frame payload small.
function _b64(bytes) {
  if (typeof btoa !== 'function') return '';
  var s = '', chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(s);
}
async function _encodeFrame(frame, host) {
  try {
    if (host && host.raster && typeof host.raster.encode === 'function') {
      var r = await host.raster.encode({ data: frame.data, width: frame.width, height: frame.height }, { format: 'jpeg', quality: 0.55 });
      if (r && r.bytes) return 'data:' + (r.mime || 'image/jpeg') + ';base64,' + _b64(r.bytes);
    }
    var cv = null;
    if (typeof OffscreenCanvas !== 'undefined') cv = new OffscreenCanvas(frame.width, frame.height);
    else if (typeof document !== 'undefined' && document.createElement) { cv = document.createElement('canvas'); cv.width = frame.width; cv.height = frame.height; }
    if (cv && cv.getContext) {
      var ctx = cv.getContext('2d');
      var img = ctx.createImageData(frame.width, frame.height);
      img.data.set(frame.data);
      ctx.putImageData(img, 0, 0);
      if (typeof cv.toDataURL === 'function') return cv.toDataURL('image/jpeg', 0.55);
    }
  } catch (e) { /* no preview this frame */ }
  return '';
}

async function _decodeToFrame(bytes, host) {
  if (!host.raster || typeof host.raster.decode !== 'function') return null;
  var bmp = await host.raster.decode(bytes);
  if (!bmp || !bmp.width) return null;
  var w = bmp.width, h = bmp.height;
  // Prefer OffscreenCanvas (works in a Worker too); fall back to a document
  // <canvas> on a main thread that lacks it (older Safari) so image mode still
  // works there instead of silently no-op'ing.
  var cv = null;
  if (typeof OffscreenCanvas !== 'undefined') cv = new OffscreenCanvas(w, h);
  else if (typeof document !== 'undefined' && document.createElement) {
    cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  }
  if (!cv) return null;
  var ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0);
  var img = ctx.getImageData(0, 0, w, h);
  return { data: img.data, width: w, height: h };
}
