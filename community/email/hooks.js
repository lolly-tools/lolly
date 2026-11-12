/* global host */
/**
 * Email hooks.
 *
 * Reads the sender, the recipients, the subject, the message and the
 * attachments into what the logic-less template prints. The message stays
 * Markdown and is rendered (and escaped) by the template's `markdown` helper.
 * DOM-free and never throws.
 *
 * A draft an assistant writes often starts with header lines ("Subject: ...",
 * "To: ..."). When the matching field is empty, those lines fill it and leave
 * the message; when the field is set, the line stays where it is.
 */

var HEADER = /^\s*(?:\*\*|__)?(subject|to|cc|from)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*?)\s*(?:\*\*|__)?\s*$/i;

/** "Name <address>", "address" or "Name" as { name, address }. */
function person(raw) {
  var s = String(raw || '').trim().replace(/^["']|["']$/g, '');
  var m = /^(.*?)\s*<([^>]+)>\s*$/.exec(s);
  if (m) return { name: m[1].replace(/^["']|["']$/g, '').trim(), address: m[2].trim() };
  if (/^[^\s@]+@[^\s@]+$/.test(s)) return { name: '', address: s };
  return { name: s, address: '' };
}

/** A display name: the given name, else the address's local part in words. */
function displayName(p) {
  if (p.name) return p.name;
  var local = p.address.split('@')[0] || '';
  return local.split(/[._-]+/).filter(Boolean).map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ');
}

function initials(name) {
  var words = String(name).split(/\s+/).filter(function (w) { return /^[\p{L}\p{N}]/u.test(w); });
  var letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map(function (w) { return Array.from(w)[0].toUpperCase(); }).join('') || '?';
}

function splitPeople(raw) {
  return String(raw || '').split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean).map(person);
}

/** Header lines at the top of the message fill the empty fields they name. */
function takeHeaders(body, fields) {
  var lines = String(body == null ? '' : body).replace(/\r\n?/g, '\n').split('\n');
  var i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  for (; i < lines.length; i++) {
    var m = HEADER.exec(lines[i]);
    if (!m) break;
    var key = m[1].toLowerCase();
    if (fields[key] || !m[2]) break;
    fields[key] = m[2];
    lines[i] = null;
  }
  return lines.filter(function (l) { return l !== null; }).join('\n').replace(/^\s*\n/, '').trim();
}

function scaleFor(chars) {
  if (chars <= 300) return 1.15;
  if (chars <= 650) return 1;
  if (chars <= 1100) return 0.88;
  if (chars <= 1700) return 0.78;
  return 0.68;
}

function compute(v) {
  var fields = { subject: String(v.heading || '').trim(), to: String(v.to || '').trim(), cc: '', from: String(v.from || '').trim() };
  var message = takeHeaders(v.body, fields);
  var sender = person(fields.from);
  var senderName = displayName(sender) || 'Unknown sender';
  var recipients = splitPeople(fields.to).map(displayName).filter(Boolean);
  var copied = splitPeople(fields.cc).map(displayName).filter(Boolean);
  var files = String(v.attachments || '').split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 6).map(function (name) {
    var ext = /\.([a-z0-9]{1,5})$/i.exec(name);
    return { name: name, ext: ext ? ext[1].toUpperCase() : 'FILE' };
  });
  var status = v.status === 'draft' || v.status === 'sent' ? v.status : 'received';
  return {
    senderName: senderName,
    senderAddress: sender.address,
    initials: initials(senderName),
    toText: recipients.join(', '),
    ccText: copied.join(', '),
    subjectText: fields.subject || '(no subject)',
    message: message,
    files: files,
    hasFiles: files.length > 0,
    statusLabel: status === 'draft' ? 'Draft' : status === 'sent' ? 'Sent' : '',
    isSent: status === 'sent',
    statusClass: 'is-' + status,
    scale: String(scaleFor(message.length)),
  };
}

function _args(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInit({ model }) {
  return surfaceRender(model);
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return surfaceRender(model);
}

async function surfaceRender(model) {
  var values = _args(model);
  var palette = await toolSurface(values, {});
  return Object.assign(await compute(values), palette);
}

// === lolly:shared tool-surface - generated from community/_shared/tool-surface.js; edit there and run pnpm run sync:shared ===
function surfaceHex(value, fallback) {
  if (value && typeof value === 'object' && Array.isArray(value.components)) {
    var space = value.colorSpace || 'srgb';
    if (space === 'srgb' && value.components.length === 3 && value.components.every(Number.isFinite)) {
      value = '#' + value.components.map(function (n) { return Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0'); }).join('');
    } else value = 'color(' + space + ' ' + value.components.join(' ') + ')';
  }
  if (host.color && typeof host.color.mix === 'function') {
    try {
      var normalized = host.color.mix(String(value), String(value), 0);
      if (normalized && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(normalized)) return normalized.slice(0, 7);
    } catch (_) { /* Try the plain hex form below. */ }
  }
  var match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value || '').trim());
  if (!match) return fallback;
  var hex = match[1];
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  return '#' + hex.slice(0, 6).toLowerCase();
}

function surfaceMix(a, b, amount) {
  if (host.color && typeof host.color.mix === 'function') {
    try { return surfaceHex(host.color.mix(a, b, amount), a); } catch (_) { /* Use sRGB below. */ }
  }
  return '#' + [1, 3, 5].map(function (at) {
    var first = parseInt(a.slice(at, at + 2), 16);
    var last = parseInt(b.slice(at, at + 2), 16);
    return Math.round(first + (last - first) * amount).toString(16).padStart(2, '0');
  }).join('');
}

function surfaceContrast(a, b) {
  function luminance(hex) {
    var channels = [1, 3, 5].map(function (at) {
      var c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function surfaceReadable(preferred, ground, alternatives) {
  if (surfaceContrast(preferred, ground) >= 4.5) return preferred;
  var choices = alternatives.concat(['#111111', '#ffffff']);
  return choices.reduce(function (best, colour) {
    return surfaceContrast(colour, ground) > surfaceContrast(best, ground) ? colour : best;
  }, preferred);
}

async function toolSurface(values, aliases) {
  aliases = aliases || {};
  async function readToken(path) {
    try {
      if (host.tokens && typeof host.tokens.resolve === 'function') {
        return await host.tokens.resolve('{' + path + '}');
      }
      if (host.tokens && typeof host.tokens.get === 'function') {
        var set = await host.tokens.get();
        if (set && typeof set.resolve === 'function') return set.resolve('{' + path + '}');
      }
    } catch (_) { /* A tool without a design system still draws. */ }
    return null;
  }
  var colours = await Promise.all([
    readToken('color.semantic.primary'), readToken('color.semantic.on-primary'),
    readToken('color.semantic.surface'), readToken('color.semantic.text'),
  ]);
  colours = colours.map(function (c, i) { return surfaceHex(c, ['#2563eb', '#ffffff', '#f6f7f9', '#17232b'][i]); });
  var primary = surfaceHex(values[aliases.accent || 'accent'], colours[0]);
  var paper = surfaceHex(values[aliases.background || 'background'], colours[2]);
  var text = surfaceHex(values[aliases.ink || 'ink'], colours[3]);
  var ground = values.ground || 'tint';
  var fill = ground === 'lead' ? primary : ground === 'ink' ? text
    : ground === 'surface' ? paper : surfaceMix(paper, primary, 0.1);
  var ink = ground === 'lead' ? colours[1] : ground === 'ink' ? paper : text;
  ink = surfaceReadable(ink, fill, [text, paper, colours[1]]);
  var accent = primary;
  for (var amount = 0.1; surfaceContrast(accent, fill) < 4.5 && amount <= 1.01; amount += 0.1) {
    accent = surfaceMix(primary, ink, Math.min(1, amount));
  }
  var onAccent = surfaceReadable(colours[1], accent, [fill, text, paper]);
  var density = values.density || 'auto';
  var chars = JSON.stringify(['body', 'heading', 'subheading', 'quote', 'criteria', 'events', 'data',
    'directions', 'blocks', 'content', 'company', 'firstname', 'lastname', 'description', 'title']
    .map(function (key) { return values[key]; })).length;
  var spacing = density === 'compact' ? 0.78 : density === 'spacious' ? 1.16
    : density === 'comfortable' ? 1 : chars > 4500 ? 0.78 : chars > 2400 ? 0.9 : 1;
  var timing = await readToken('motion.duration.long');
  var ms = 700;
  if (typeof timing === 'number' && Number.isFinite(timing)) ms = timing;
  else if (timing && typeof timing === 'object' && typeof timing.value === 'number') {
    ms = timing.value * (timing.unit === 's' ? 1000 : 1);
  } else if (typeof timing === 'string') {
    var match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(timing.trim());
    if (match) ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
  }
  var curve = await readToken('motion.curve.emphasised');
  if (!Array.isArray(curve) || curve.length !== 4 || !curve.every(Number.isFinite)
      || curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1) curve = [0.2, 0, 0, 1];
  return {
    surfaceGround: values.transparentBg === true || values.transparentBg === 'true' ? 'transparent' : fill,
    surfacePaper: fill,
    surfaceInk: ink,
    surfaceAccent: accent,
    surfaceOnAccent: onAccent,
    surfaceMuted: surfaceMix(ink, fill, 0.22),
    surfaceEdge: surfaceMix(fill, ink, 0.2),
    surfacePanel: surfaceMix(fill, ink, 0.045),
    surfaceTint: surfaceMix(fill, accent, 0.12),
    surfaceSpacing: String(spacing),
    surfaceEnterSeconds: String(Math.max(0, Math.min(3000, ms)) / 1000),
    surfaceCurve: curve.join(','),
  };
}
// === /lolly:shared tool-surface ===
