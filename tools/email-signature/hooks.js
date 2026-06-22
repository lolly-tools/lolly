var MAX_PHOTO_PX = 100;

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
