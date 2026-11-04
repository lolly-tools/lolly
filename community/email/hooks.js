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
  return compute(_args(model));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return compute(_args(model));
}
