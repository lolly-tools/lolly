// SPDX-License-Identifier: MPL-2.0
// The Sandbox copies a snapshot of its preview into the app's own page so the export
// walker can draw the preview. The user's code writes that snapshot (and can forge the message
// that carries it), so the copy must never run anything in the app's origin. These
// tests run the template's own cleanShot against the markup an attacker would send,
// and pin mountShot to adopting cleaned nodes rather than re-parsing a string.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const TEMPLATE = new URL('../community/sandbox/template.html', import.meta.url);

/** The source of one top-level function in the template, found by brace matching. */
function functionSource(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in the Sandbox template`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

async function loadCleanShot() {
  const src = await readFile(TEMPLATE, 'utf8');
  const dom = new JSDOM('<!doctype html><body></body>');
  const win = dom.window;
  class AppWidget extends win.HTMLElement {}
  win.customElements.define('jelly-button', AppWidget);
  const cleanShot = new Function('window', `${functionSource(src, 'cleanShot')}; return cleanShot;`)(win) as (d: Document) => Document;
  const clean = (html: string): Document => cleanShot(new win.DOMParser().parseFromString(html, 'text/html'));
  return { src, win, clean };
}

test('cleanShot removes every attribute and element that could run in the app origin', async () => {
  const { clean } = await loadCleanShot();
  const doc = clean(`<!doctype html><html><head><base href="https://attacker.example/"><meta http-equiv="refresh" content="0;url=https://attacker.example/"></head><body>
    <img id="a" src="x" onerror="parent.pwned=1" ONLOAD="x()">
    <svg id="b" onload="x()"><a id="c" href="  java&#x09;script:x()"><text>t</text></a>
      <a id="d" xlink:href="javascript:x()"></a>
      <set attributeName="href" to="javascript:x()"></set><animate attributeName="xlink:href" values="x;javascript:x()"></animate>
      <animate id="keep-anim" attributeName="opacity" values="0;1"></animate>
      <script>x()</script></svg>
    <iframe srcdoc="<script>x()</script>"></iframe><object data="javascript:x()"></object><embed src="x.swf">
    <form id="e" action="javascript:x()"><button id="f" formaction="vbscript:x">b</button></form>
    <a id="g" href="data:text/html,<script>x()</script>">g</a>
    <details id="h" open ontoggle="x()">d</details>
    <noscript><img src=x onerror=x()></noscript><template><img src=x onerror=x()></template>
    <link rel="stylesheet" href="https://attacker.example/a.css"><script>x()</script>
  </body></html>`);

  for (const sel of ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'noscript', 'template', 'set']) {
    assert.equal(doc.querySelectorAll(sel).length, 0, `${sel} must not survive`);
  }
  assert.equal(doc.querySelectorAll('animate').length, 1, 'only the href-animating <animate> is removed');
  assert.ok(doc.getElementById('keep-anim'), 'an ordinary animation stays');
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const a of Array.from(el.attributes)) {
      assert.ok(!/^on/i.test(a.name), `${el.localName} kept ${a.name}`);
      assert.ok(!/^\s*(javascript|vbscript):|^data:text\/html/i.test(a.value.replace(/\s+/g, '')), `${el.localName} kept ${a.name}=${a.value}`);
    }
  }
  assert.equal(doc.getElementById('a')?.getAttribute('src'), 'x', 'a harmless attribute stays');
});

test('cleanShot turns custom elements and customised built-ins into plain elements', async () => {
  const { clean } = await loadCleanShot();
  // jelly-button is defined in the test window; lolly-later is not, and stands for a
  // tag the app registers only after the mirror is in the page.
  const doc = clean('<body><jelly-button id="w" class="c" style="color:red"><b id="inner" onclick="x()">hi</b></jelly-button><lolly-later id="u">later</lolly-later><button is="jelly-button" id="i">x</button><svg><font-face id="svgdash"></font-face></svg></body>');
  const stand = doc.getElementById('w');
  assert.equal(stand?.localName, 'span', 'an app-defined tag becomes a span');
  assert.equal(stand?.getAttribute('class'), 'c');
  assert.equal(stand?.getAttribute('style'), 'color:red');
  assert.equal(doc.getElementById('inner')?.parentElement, stand, 'its children move across');
  assert.equal(doc.getElementById('inner')?.hasAttribute('onclick'), false, 'and are already clean');
  assert.equal(doc.getElementById('u')?.localName, 'span', 'an undefined custom tag becomes a span too, so a later definition cannot upgrade it');
  assert.equal(doc.getElementById('svgdash')?.localName, 'font-face', 'a hyphenated SVG element is not a custom element and stays');
  const btn = doc.getElementById('i');
  assert.equal(btn?.localName, 'button');
  assert.equal(btn?.hasAttribute('is'), false, 'the is= value does not survive');
});

test('mountShot cleans before anything joins the page and never re-parses the body', async () => {
  const { src } = await loadCleanShot();
  const mount = functionSource(src, 'mountShot');
  assert.match(mount, /cleanShot\(new DOMParser\(\)\.parseFromString\(/, 'the parsed snapshot goes through cleanShot first');
  assert.match(mount, /document\.adoptNode\(/, 'cleaned nodes are adopted');
  assert.doesNotMatch(mount, /\.innerHTML\s*=/, 'no innerHTML: a serialise and re-parse round trip can undo a clean');
});
