/**
 * Event Name Badge — hooks.
 *
 * Computes what the logic-less template can't:
 *   • badge proportions + orientation from the chosen standard size,
 *   • the status colour scheme (accent + contrast ink) and role label,
 *   • track chips with per-chip contrast, and
 *   • the default SUSE logo (auto light/dark) when no event logo is supplied.
 *
 * The optional QR is no longer drawn here: it's COMPOSED from the qr-code tool
 * (see tool.json `composes`), and the template embeds it via {{asset badgeQr}}.
 * That replaced a verbatim copy of the qrcode-svg library that used to live in
 * this file — the win that motivated tool composition.
 */

// ─── Badge logic ─────────────────────────────────────────────────────────────

// WCAG relative luminance of a #hex colour (0 = black, 1 = white).
function relLuminance(hex) {
  var s = String(hex || '#000000').replace('#', '');
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  function lin(i) {
    var v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
function isDark(hex) { return relLuminance(hex) < 0.5; }
// High-contrast ink for a given background — brand ink on light, white on dark.
function idealInk(hex) { return isDark(hex) ? '#ffffff' : '#0c322c'; }

// Status → role label + colour. Distinct, print-legible hues; a roleColor input
// can override the colour without losing the label.
var STATUS = {
  attendee:  { label: 'Attendee',  color: '#475569' },
  speaker:   { label: 'Speaker',   color: '#30ba78' },
  presenter: { label: 'Presenter', color: '#0a9bd6' },
  sponsor:   { label: 'Sponsor',   color: '#e0972b' },
  exhibitor: { label: 'Exhibitor', color: '#7b61ff' },
  organizer: { label: 'Organizer', color: '#fb7a3c' },
  staff:     { label: 'Staff',     color: '#0c8a52' },
  press:     { label: 'Press',     color: '#d8456a' },
  vip:       { label: 'VIP',       color: '#a16207' },
  volunteer: { label: 'Volunteer', color: '#1f9d57' }
};

// Standard badge trim sizes (mm). Drives the card's aspect-ratio + orientation;
// the exact print size is set per-export. Range spans the smallest (A7) to the
// largest (4×6 in / 6×4 in) common landscape & portrait conference badges.
var SIZES = {
  a7:      { w: 74,    h: 105,   label: 'A7 · 74 × 105 mm' },
  '3x4in': { w: 76.2,  h: 101.6, label: '3 × 4 in · 76 × 102 mm' },
  a6:      { w: 105,   h: 148,   label: 'A6 · 105 × 148 mm' },
  '4x6in': { w: 101.6, h: 152.4, label: '4 × 6 in · 102 × 152 mm' },
  '4x3in': { w: 101.6, h: 76.2,  label: '4 × 3 in · 102 × 76 mm' },
  a6land:  { w: 148,   h: 105,   label: 'A6 landscape · 148 × 105 mm' },
  '6x4in': { w: 152.4, h: 101.6, label: '6 × 4 in · 152 × 102 mm' }
};

function toInputs(model) {
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

async function compute(model) {
  var inputs = toInputs(model);
  var out = {};

  // Size → proportions + orientation + trim caption.
  var sz = SIZES[inputs.size] || SIZES['4x6in'];
  out.aspW = sz.w;
  out.aspH = sz.h;
  out.orient = sz.w > sz.h ? 'landscape' : 'portrait';
  out.trimLabel = sz.label;

  // Colour scheme.
  var bg = (typeof inputs.background === 'string' && inputs.background) ? inputs.background : '#ffffff';
  var st = STATUS[inputs.status] || STATUS.attendee;
  var accent = (typeof inputs.roleColor === 'string' && inputs.roleColor.trim())
    ? inputs.roleColor.trim() : st.color;
  out.statusLabel = st.label;
  out.statusColor = accent;
  out.statusInk = idealInk(accent);
  out.ink = idealInk(bg);
  out.muted = isDark(bg) ? 'rgba(255,255,255,0.66)' : 'rgba(12,50,44,0.60)';
  out.hairline = isDark(bg) ? 'rgba(255,255,255,0.16)' : 'rgba(12,50,44,0.12)';

  // Tracks → chips. A chip with its own colour is filled (contrast ink); one
  // without is outlined in the accent.
  var tracks = Array.isArray(inputs.tracks) ? inputs.tracks : [];
  out.tracksOut = tracks
    .filter(function (t) { return t && typeof t.label === 'string' && t.label.trim(); })
    .map(function (t) {
      var c = (typeof t.color === 'string' && t.color.trim()) ? t.color.trim() : '';
      return c
        ? { label: t.label.trim(), bg: c, fg: idealInk(c), outline: c }
        : { label: t.label.trim(), bg: 'transparent', fg: accent, outline: accent };
    });

  // The optional QR is composed from the qr-code tool (tool.json `composes`) and
  // embedded in the template via {{asset badgeQr}}, guarded by showQr + url.

  // Default logo: when no event logo is chosen, use the SUSE horizontal logo,
  // reversed for dark cards. A user-selected eventLogo is resolved in-template.
  if (!inputs.eventLogo) {
    var id = 'suse/logo/hor-' + (isDark(bg) ? 'neg-white' : 'pos-green');
    try { out.defaultLogo = await host.assets.get(id); }
    catch (e) { if (host.log) host.log('warn', 'event-name-badge: logo not found', { id: id }); }
  }

  return out;
}

function onInit(ctx)  { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
