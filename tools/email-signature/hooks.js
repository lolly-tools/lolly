var MAX_PHOTO_PX = 100;

function resizePhoto(assetRef) {
  if (!assetRef || !assetRef.url) return Promise.resolve('');
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var scale = Math.min(1, MAX_PHOTO_PX / Math.max(w, h));
      var cw = Math.round(w * scale);
      var ch = Math.round(h * scale);
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
  var headshot = model.find(function(i) { return i.id === 'headshot'; });
  var append = model.find(function(i) { return i.id === 'append'; });
  return {
    appendHtml: appendBlock(append ? append.value : 'none'),
    photoSrc:   await resizePhoto(headshot ? headshot.value : null),
  };
}

async function onInput({ id, value }) {
  if (id === 'append') return { appendHtml: appendBlock(value) };
  if (id === 'headshot')  return { photoSrc: await resizePhoto(value) };
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

