/**
 * Shared hook helpers - the warning for a PDF that is already digitally signed.
 *
 * CANONICAL SOURCE for the `signedPdf` region below. Tool hooks.js ship as
 * self-contained data (no imports), so each consumer (pages, strip-data,
 * redact) carries a byte-for-byte copy between matching markers. Edit here,
 * then run `pnpm run sync:shared`.
 */

// === lolly:shared signedPdf - canonical source; edit here and run pnpm run sync:shared ===
// A tool that saves a PDF again breaks a digital signature made over the old
// bytes. The shell's analysis (host.pdf.analyze) reports a filled signature
// field as a "Digital signature" finding; an empty signature field is not one.
// Each tool shows one sentence above its download button and logs the same
// sentence on export, which is how the command line prints the warning.
function signedPdfFound(findings) {
  return (findings || []).some(function (x) { return x && x.label === 'Digital signature'; });
}
// `names` holds the signed files the tool saves again, `loaded` the number of
// files loaded. One file loaded reads "This PDF"; several give the file names.
function signedPdfSentence(names, loaded) {
  if (!names || !names.length) return '';
  if (names.length === 1) {
    return (loaded === 1 ? 'This PDF' : names[0]) + ' is digitally signed: its signature will not verify on the saved copy, and the original file is not changed.';
  }
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
    + ' are digitally signed: their signatures will not verify on the saved copy, and the original files are not changed.';
}
// What the template draws: the sentence in muted ink around the two words
// "digitally signed", which the template sets in the alert ink.
function signedPdfLine(note) {
  var mark = 'digitally signed', at = note ? note.indexOf(mark) : -1;
  if (at < 0) return { signedNote: '', signedLead: '', signedRest: '' };
  return { signedNote: note, signedLead: note.slice(0, at), signedRest: note.slice(at + mark.length) };
}
// The findings list still lists the signature. The consequence is left to the
// line above the button, so the point is made once.
function signedPdfFindings(findings) {
  return (findings || []).map(function (x) {
    if (!x || x.label !== 'Digital signature') return x;
    return Object.assign({}, x, { detail: String(x.detail || '').replace(/ - re-saving this file invalidates it$/, '') });
  });
}
// === /lolly:shared signedPdf ===
