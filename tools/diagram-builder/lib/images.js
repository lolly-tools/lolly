// SPDX-License-Identifier: MPL-2.0
// ── card images: embed as a data URL + measure aspect (browser only) ────────────
var _imgCache = {};
export function resolveImage(url) {
  if (_imgCache[url]) return _imgCache[url];
  var p = (async function () {
    var dataUrl = url, aspect = 0;
    try {
      if (typeof fetch !== 'undefined' && String(url).indexOf('data:') !== 0) {
        var blob = await (await fetch(url)).blob();
        dataUrl = await new Promise(function (res, rej) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { rej(new Error('read failed')); };
          fr.readAsDataURL(blob);
        });
      }
    } catch (e) { dataUrl = url; }
    try {
      if (typeof Image !== 'undefined') {
        aspect = await new Promise(function (res) {
          var im = new Image();
          im.onload = function () { res(im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0); };
          im.onerror = function () { res(0); };
          im.src = dataUrl;
        });
      }
    } catch (e) { aspect = 0; }
    return { dataUrl: dataUrl, aspect: aspect };
  })();
  _imgCache[url] = p;
  return p;
}
