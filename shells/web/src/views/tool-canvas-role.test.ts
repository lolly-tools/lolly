// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { paintedCanvasRole, toolCanvasRole, watchCanvasRole } from './tool-canvas-role.ts';

const manifest = { id: 'preview', render: { width: 640, height: 480, formats: ['png'] } };

test('ordinary previews keep the image role', () => {
  assert.equal(toolCanvasRole(manifest, false, false), 'img');
  assert.equal(toolCanvasRole({ ...manifest, render: { ...manifest.render, webPreview: false, sidebar: true, export: true } }, false, false), 'img');
});

test('each canvas control condition keeps children accessible', () => {
  assert.equal(toolCanvasRole(manifest, true, false), 'group');
  assert.equal(toolCanvasRole({ ...manifest, id: '3d-studio' }, false, false), 'group');
  assert.equal(toolCanvasRole(manifest, false, true), 'group');
  for (const render of [{ webPreview: true }, { sidebar: false }, { export: false }]) {
    assert.equal(toolCanvasRole({ ...manifest, render: { ...manifest.render, ...render } }, false, false), 'group');
  }
});

const painted = (html: string): ParentNode => new JSDOM(`<div id="c">${html}</div>`).window.document.getElementById('c')!;

test('a painted canvas with no control stays an image', () => {
  assert.equal(paintedCanvasRole('img', painted('<svg><text>Poster</text></svg><p data-canvas-input="title">Title</p>')), 'img');
  assert.equal(paintedCanvasRole('img', painted('<span tabindex="-1">Programmatic focus only</span><input type="hidden" value="1">')), 'img');
  // A player with no controls of its own is a picture with sound.
  assert.equal(paintedCanvasRole('img', painted('<video muted></video><audio></audio>')), 'img');
});

test('a painted canvas that holds a control is a group', () => {
  for (const control of ['<button type="button">Capture</button>', '<a href="#/d">Open</a>', '<input type="range">', '<select><option>A</option></select>', '<textarea></textarea>', '<details><summary>More</summary></details>', '<div contenteditable>Text</div>', '<div tabindex="0" role="slider"></div>', '<audio controls></audio>', '<video controls></video>', '<iframe title="Page"></iframe>', '<div role="button">Pick</div>']) {
    assert.equal(paintedCanvasRole('img', painted(`<p>Preview</p>${control}`)), 'group', control);
  }
});

test('a control nobody can reach does not change the role', () => {
  assert.equal(paintedCanvasRole('img', painted('<button type="button" hidden>Compose</button>')), 'img');
  assert.equal(paintedCanvasRole('img', painted('<div hidden><button type="button">Compose</button></div>')), 'img');
  assert.equal(paintedCanvasRole('img', painted('<div inert><a href="#/d">Open</a></div>')), 'img');
  assert.equal(paintedCanvasRole('img', painted('<div aria-hidden="true"><button type="button">Decoration</button></div>')), 'img');
  // One reachable control among hidden ones is enough.
  assert.equal(paintedCanvasRole('img', painted('<button type="button" hidden>Compose</button><button type="button">Capture</button>')), 'group');
});

test('a page made inert by an open dialog does not hide the canvas\'s controls', () => {
  const doc = new JSDOM('<div id="app" inert><div id="c"><button type="button">Zoom in</button></div></div>').window.document;
  assert.equal(paintedCanvasRole('img', doc.getElementById('c')!), 'group');
  const hidden = new JSDOM('<div id="app" aria-hidden="true"><div id="c"><p>Poster</p></div></div>').window.document;
  assert.equal(paintedCanvasRole('img', hidden.getElementById('c')!), 'img');
});

test('a canvas that is a group by its manifest stays a group', () => {
  assert.equal(paintedCanvasRole('group', painted('<p>Preview</p>')), 'group');
});

/** A canvas with the image role in a document that has animation frames. */
function liveCanvas(html: string): { holder: Element; content: Element; frame: () => Promise<void> } {
  const dom = new JSDOM(`<div id="tool-canvas" role="img" aria-label="Preview"><div id="c">${html}</div></div>`, { pretendToBeVisual: true });
  const doc = dom.window.document;
  // One macrotask for the observer, one animation frame for the check.
  const frame = (): Promise<void> => new Promise((resolve) => setTimeout(() => dom.window.requestAnimationFrame(() => resolve()), 0));
  return { holder: doc.getElementById('tool-canvas')!, content: doc.getElementById('c')!, frame };
}

test('a control that is already painted makes the canvas a group at once', () => {
  const { holder, content } = liveCanvas('<button type="button">Zoom in</button>');
  watchCanvasRole(holder, content);
  assert.equal(holder.getAttribute('role'), 'group');
});

test('a control that arrives after the paint makes the canvas a group', async () => {
  const { holder, content, frame } = liveCanvas('<svg></svg>');
  const stop = watchCanvasRole(holder, content);
  assert.equal(holder.getAttribute('role'), 'img');
  // A map adds its zoom buttons when its script has run.
  content.insertAdjacentHTML('beforeend', '<div class="zoom"><button type="button">Zoom in</button></div>');
  await frame();
  await frame();
  assert.equal(holder.getAttribute('role'), 'group');
  stop();
});

test('a control that stops being hidden counts, and a group stays a group', async () => {
  const { holder, content, frame } = liveCanvas('<button type="button" hidden>Capture</button>');
  watchCanvasRole(holder, content);
  assert.equal(holder.getAttribute('role'), 'img');
  content.querySelector('button')!.hidden = false;
  await frame();
  await frame();
  assert.equal(holder.getAttribute('role'), 'group');
  content.innerHTML = '<svg></svg>';
  await frame();
  await frame();
  assert.equal(holder.getAttribute('role'), 'group', 'a role that changed back would be announced again');
});

test('an element that becomes a control by an attribute is seen', async () => {
  for (const [html, change] of [
    ['<input type="hidden" value="1">', (el: Element) => el.setAttribute('type', 'text')],
    ['<video></video>', (el: Element) => el.setAttribute('controls', '')],
    ['<div class="knob"></div>', (el: Element) => el.setAttribute('role', 'slider')],
  ] as const) {
    const { holder, content, frame } = liveCanvas(html);
    watchCanvasRole(holder, content);
    assert.equal(holder.getAttribute('role'), 'img', html);
    change(content.firstElementChild!);
    await frame();
    await frame();
    assert.equal(holder.getAttribute('role'), 'group', html);
  }
});

test('a watch that was ended changes nothing', async () => {
  const { holder, content, frame } = liveCanvas('<svg></svg>');
  watchCanvasRole(holder, content)();
  content.insertAdjacentHTML('beforeend', '<button type="button">Late</button>');
  await frame();
  await frame();
  assert.equal(holder.getAttribute('role'), 'img');
});

test('the tool view starts the watch with the first paint and ends the watch with the view', () => {
  const render = readFileSync(new URL('./tool/render.ts', import.meta.url), 'utf8');
  assert.match(render, /runTemplateScripts\(contentEl\);[\s\S]{0,600}tview\.canvasRoleStop = watchCanvasRole\(roleHolder, contentEl\)/);
  const layout = readFileSync(new URL('./tool/stage-layout.ts', import.meta.url), 'utf8');
  assert.match(layout, /tview\.canvasRoleStop\?\.\(\);/);
});
