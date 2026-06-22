// Brand wordmarks embedded as data URIs so the pasted signature stays
// self-contained — email clients don't fetch tool-relative assets. The pair is
// 300x56 and the footer renders it at 100px wide. Standard is the green
// wordmark; Grey is the greyscale variant for low-colour / mono contexts.
var LOGO_STANDARD = 'data:image/png;base64,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';
var LOGO_GREY     = 'data:image/png;base64,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';

function logoSrc(key) {
  return key === 'grey' ? LOGO_GREY : LOGO_STANDARD;
}

// Colour palette, keyed off the logo selection. Standard keeps the brand
// greens/teals; Grey collapses every text and border colour to 50% grey
// (#808080) to match the grey wordmark for low-colour / mono contexts. Only
// text and borders are affected — images (headshot, promo, logo) are never
// recoloured, and the append block keeps its own muted styling.
function palette(logoKey) {
  if (logoKey === 'grey') {
    return { cText: '#808080', cMuted: '#808080', cAccent: '#808080', cBorder: '#808080', cSep: '#808080' };
  }
  return {
    cText:   '#0c322c',
    cMuted:  '#4b7a70',
    cAccent: '#30ba78',
    cBorder: 'rgba(12,50,44,0.1)',
    cSep:    'rgba(12,50,44,0.2)',
  };
}

// Raster inputs (headshot, promo) are shrunk client-side so the data URI we
// inline stays small enough to paste. Aspect is preserved; the image is
// flattened onto white (the signature background) and emitted as JPEG.
var PHOTO_MAX   = 100;  // headshot: square-ish cap on both axes
var PROMO_MAX_W = 400;  // promo banner box
var PROMO_MAX_H = 200;

function resizeImage(assetRef, maxW, maxH) {
  if (!assetRef || !assetRef.url) return Promise.resolve('');
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var scale = Math.min(1, maxW / w, maxH / h);
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width  = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = function() { resolve(''); };
    img.src = assetRef.url;
  });
}

async function onInit({ model }) {
  var val = function(id) {
    var i = model.find(function(x) { return x.id === id; });
    return i ? i.value : null;
  };
  var logo = val('logo') || 'standard';
  return Object.assign({
    appendHtml: appendBlock(val('append') || 'none'),
    photoSrc:   await resizeImage(val('headshot'),   PHOTO_MAX, PHOTO_MAX),
    promoSrc:   await resizeImage(val('emailPromo'), PROMO_MAX_W, PROMO_MAX_H),
    logoSrc:    logoSrc(logo),
  }, palette(logo));
}

async function onInput({ id, value }) {
  if (id === 'append')     return { appendHtml: appendBlock(value) };
  if (id === 'headshot')   return { photoSrc: await resizeImage(value, PHOTO_MAX, PHOTO_MAX) };
  if (id === 'emailPromo') return { promoSrc: await resizeImage(value, PROMO_MAX_W, PROMO_MAX_H) };
  if (id === 'logo')       return Object.assign({ logoSrc: logoSrc(value) }, palette(value));
}

function appendBlock(key) {
  switch (key) {
    case 'germany':
      return '<p style="margin:0 0 3px 0;">SUSE Software Solutions Germany GmbH &bull; Maxfeldstr. 5 &bull; 90409 N&uuml;rnberg &bull; Germany</p>'
           + '<p style="margin:0;">Registergericht: Amtsgericht N&uuml;rnberg &bull; HRB 36994 &bull; Gesch&auml;ftsf&uuml;hrer: Andy Macdonald</p>';
    case 'business':
      return '<p style="margin:0;">This email and any attachments may be confidential and are intended solely for the use of the individual to whom it is addressed. '
           + 'If you are not the intended recipient, please notify the sender immediately and delete this message. '
           + 'Any unauthorised use, disclosure, or copying is strictly prohibited.</p>';
    case 'wellbeing':
      return '<p style="margin:0;">I am an advocate for wellbeing. I manage my working hours in a way that helps me support global teams, that works for my family and my own wellbeing. This means I sometimes choose to work at early/late hours.  If you are receiving this email at an unsociable hour, please only reply at a time that works for you.</p>';
    default:
      return '';
  }
}
