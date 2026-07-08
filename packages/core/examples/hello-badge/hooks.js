// SPDX-License-Identifier: MPL-2.0
// hello-badge hooks — pure and DOM-free (the classic-hook house style: plain
// function declarations, no imports). The runtime injects `host` and collects any
// function named onInit / onInput / … by name.
//
// A hook returns a plain object. Keys matching a declared input id update that
// input's value; any OTHER key becomes a computed "extra" the template can
// reference directly. No input declares `initials`, so `{{initials}}` in the
// template resolves to what we return here.

function initialsFrom(name) {
  var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map(function (word) { return word.charAt(0).toUpperCase(); })
    .join('');
}

function compute(model) {
  var name = '';
  for (var i = 0; i < model.length; i++) {
    if (model[i].id === 'name') name = model[i].value;
  }
  return { initials: initialsFrom(name) };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
