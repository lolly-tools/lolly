// SPDX-License-Identifier: MPL-2.0
// === lolly:shared content-presentation - generated from community/_shared/content-presentation.js; edit there and run pnpm run sync:shared ===
(function () {
  var script = document.currentScript;
  var root = script && script.previousElementSibling;
  if (root && !root.hasAttribute('data-content-surface')) root = root.querySelector('[data-content-surface]');
  if (!root) root = document.querySelector('[data-content-surface]');
  if (!root || !root.hasAttribute('data-content-surface')) return;
  var authoredMarkup = root.outerHTML;
  var clock = root.querySelector('[data-content-clock]');
  var motion = root.getAttribute('data-motion') || 'none';
  var items = Array.from(root.querySelectorAll('[data-reveal]')).filter(function (item) { return item.getClientRects().length > 0; });
  var meters = Array.from(root.querySelectorAll('[data-meter]'));
  var itemStyles = items.map(function (item) { return { opacity: item.style.opacity, transform: item.style.transform }; });
  var meterStyles = meters.map(function (meter) { return { transform: meter.style.transform, origin: meter.style.transformOrigin }; });
  var raf = 0, release = 0;
  var duration = Math.max(1, Math.min(20, Number(root.getAttribute('data-motion-seconds')) || 4));
  var step = Math.min(0.14, 1.4 / Math.max(1, items.length - 1));
  var enter = Number(root.getAttribute('data-enter-seconds'));
  if (!Number.isFinite(enter) || enter < 0) enter = 0.7;
  var curve = (root.getAttribute('data-curve') || '0.2,0,0,1').split(',').map(Number);
  var end = enter + step * Math.max(0, items.length - 1);

  function ease(progress) {
    if (progress <= 0 || progress >= 1) return progress;
    function point(t, a, b) { return 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t; }
    var low = 0, high = 1, t = progress;
    for (var i = 0; i < 18; i++) {
      t = (low + high) / 2;
      if (point(t, curve[0], curve[2]) < progress) low = t; else high = t;
    }
    return Math.max(0, Math.min(1, point(t, curve[1], curve[3])));
  }

  function settle() {
    items.forEach(function (item, i) {
      item.style.opacity = itemStyles[i].opacity;
      item.style.transform = itemStyles[i].transform;
    });
    meters.forEach(function (meter, i) {
      meter.style.transform = meterStyles[i].transform;
      meter.style.transformOrigin = meterStyles[i].origin;
    });
  }
  function paint(seconds) {
    items.forEach(function (item, i) {
      var progress = Math.max(0, Math.min(1, (seconds - i * step) / enter));
      var eased = ease(progress);
      item.style.opacity = String(eased);
      item.style.transform = motion === 'rise' ? itemStyles[i].transform + ' translateY(' + ((1 - eased) * 18) + 'px)' : itemStyles[i].transform;
    });
    meters.forEach(function (meter, i) {
      var progress = Math.max(0, Math.min(1, seconds / Math.max(enter, end)));
      meter.style.transformOrigin = 'left center';
      meter.style.transform = meterStyles[i].transform + ' scaleX(' + ease(progress) + ')';
    });
  }
  function reduced() {
    return (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
      || document.documentElement.getAttribute('data-a11y-motion') === 'reduce';
  }
  function fit() {
    if (!root.isConnected) { stop(); return; }
    var targets = Array.from(root.querySelectorAll('[data-content-fit]'));
    root.style.setProperty('--content-fit', '1');
    for (var scale = 1; scale > 0.45; scale -= 0.035) {
      var fits = targets.every(function (el) {
        return (el.clientHeight === 0 && el.scrollHeight === 0) || (el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2);
      });
      if (fits) break;
      root.style.setProperty('--content-fit', String(Math.max(0.45, scale - 0.035)));
    }
    var warning = root.querySelector('[data-content-fit-warning]');
    if (warning) warning.hidden = !targets.some(function (el) {
      return (el.clientHeight > 0 || el.scrollHeight > 0) && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2);
    });
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  if (observer) observer.observe(root);
  var lifecycle = new MutationObserver(function () { if (!root.isConnected) stop(); });
  if (root.parentElement) lifecycle.observe(root.parentElement, { childList: true });
  function stop() {
    cancelAnimationFrame(raf);
    clearTimeout(release);
    if (observer) observer.disconnect();
    lifecycle.disconnect();
  }
  root.setAttribute('data-lolly-player', '');
  root.__lollyPlayback = {
    animated: motion !== 'none' && enter > 0,
    duration: Math.max(duration, end + 0.5),
    poster: end + 0.05,
    seek: function (seconds) {
      cancelAnimationFrame(raf);
      if (motion === 'none' || enter === 0) settle(); else paint(Math.max(0, seconds));
    },
    portableMarkup: function () {
      var copy = document.createElement('template');
      copy.innerHTML = authoredMarkup;
      copy.content.querySelectorAll('[data-export-hide]').forEach(function (el) { el.remove(); });
      return copy.innerHTML;
    },
  };
  if (!clock || motion === 'none' || items.length === 0) return;
  function watchRelease() {
    clearTimeout(release);
    release = setTimeout(function check() {
      if (!root.isConnected) { stop(); return; }
      if (clock.__lollyFrameDriven) { release = setTimeout(check, 250); return; }
      settle();
    }, 250);
  }
  clock.__lollyFrameRender = function (t, clipSeconds) {
    cancelAnimationFrame(raf);
    if (!(clipSeconds > 0) || enter === 0) settle();
    else paint(Math.max(0, Math.min(1, t)) * Math.max(clipSeconds, end + 0.5));
    watchRelease();
  };
  clock.__lollyFrameRender.stillPose = true;
  var stage = root.parentElement;
  var key = root.className + ':' + motion + ':' + root.getAttribute('data-layout');
  var began = 0;
  function play() {
    cancelAnimationFrame(raf);
    if (reduced() || enter === 0) { settle(); return; }
    began = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!root.isConnected) { stop(); return; }
    if (reduced()) { settle(); return; }
    if (clock.__lollyFrameDriven) { raf = requestAnimationFrame(tick); return; }
    var seconds = (now - began) / 1000;
    if (seconds >= Math.min(duration, end + 0.1)) { settle(); return; }
    paint(seconds);
    raf = requestAnimationFrame(tick);
  }
  var button = root.querySelector('[data-content-play]');
  if (button) button.addEventListener('click', play);
  if (stage && stage.__contentPlayed === key) return;
  if (stage) stage.__contentPlayed = key;
  play();
})();
// === /lolly:shared content-presentation ===
