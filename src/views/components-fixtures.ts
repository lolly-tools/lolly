// SPDX-License-Identifier: MPL-2.0
/** Safe, static design fixtures for components whose real mount needs a host,
 * camera, saved project or overlay lifecycle. The library labels these as
 * fixtures; these never claim to run the corresponding application workflow. */
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import type { Specimen } from './components-data.ts';

const button = (label: string, primary = false): string => `<button type="button" class="btn${primary ? ' btn--primary' : ''}">${escape(label)}</button>`;
const row = (...items: string[]): string => `<div class="cl-fixture-row">${items.join('')}</div>`;
const panel = (title: string, body: string): string => `<div class="cl-fixture-panel"><h4>${escape(title)}</h4>${body}</div>`;
const tiles = (): string => row(...['Launch kit', 'Social post', 'Presentation'].map((name, i) => `<div class="cl-fixture-tile${i === 0 ? ' is-selected' : ''}"><span class="cl-fixture-art">${['Aa', '↗', '◎'][i]}</span><span>${name}</span></div>`));
const menu = (): string => `<div class="cl-fixture-menu">${['Open', 'Duplicate', 'Move to folder', 'Delete'].map(x => button(x)).join('')}</div>`;

const FIXTURES: Array<[string, () => string]> = [
  ['Mobile snap-sheet', () => panel('Export', '<div class="cl-fixture-grip"></div><p>Drag to expand · tap to collapse</p>' + row(button('SVG', true), button('PNG'), button('PDF')))],
  ['Stagger reveal', tiles],
  ['Tile multi-select', tiles],
  ['Tile context menu', menu],
  ['Bulk-action bar (', () => row('<span class="chip chip--count">3 selected</span>', button('Download', true), button('Move'), button('Clear'))],
  ['First-run welcome', () => panel('Make it yours.', '<p>Bring your brand. Create something that belongs to you.</p>' + row(button('Set up your brand', true), button('Explore tools')))],
  ['Instance sheet', () => panel('Your workspace', '<label class="cl-fixture-label">Instance address<input class="field-input" value="https://lolly.tools" readonly></label>' + button('Connect', true))],
  ['Sound icon toggle', () => row(`<button type="button" class="btn" aria-label="Sound on">${icon('volumeOn')} Sound on</button>`, button('Muted'))],
  ['Theme cycle toggle', () => row(button('Light', true), button('Dark'), button('Brand'))],
  ['Scrub readout', () => '<output class="cl-fixture-readout">480 <span>px</span></output>'],
  ['Print-lock control', () => panel('Print colour', '<div class="cl-fixture-swatch"></div><p>CMYK · 74 / 0 / 60 / 0</p>' + button('Lock print values'))],
  ['Asset picker (', () => panel('Choose an asset', '<input class="field-input" placeholder="Search your assets" aria-label="Search demo assets">' + tiles())],
  ['Music player', () => panel('A little focus.', '<p>Neurospicy · Ambient</p><div class="cl-fixture-wave">▂ ▄ ▆ ▃ ▇ ▅ ▂ ▄ ▆ ▃ ▅ ▇ ▂</div>' + row(button('Previous'), button('Play', true), button('Next')))],
  ['Page filmstrip', () => row(...[1, 2, 3].map(n => `<div class="cl-fixture-page">${n}</div>`))],
  ['Featured row', tiles],
  ['Upload dropzone', () => '<div class="cl-fixture-drop"><strong>Drop something good here.</strong><p>Images, fonts or brand tokens</p>' + button('Choose files') + '</div>'],
  ['Confetti burst', () => '<div class="cl-fixture-confetti" aria-label="Celebration keyframe"><span>✦</span><span>●</span><strong>Made it.</strong><span>◆</span><span>✦</span></div>'],
  ['Fonts manager', () => panel('Your type collection', '<div class="cl-fixture-type">SUSE Aa</div><p>Regular · Medium · Bold</p>' + button('Add a font'))],
  ['Type-in-motion', () => '<div class="cl-fixture-type">Type with<br><em>character.</em></div>'],
  ['Editable palette wheel', () => row(...['#30ba78', '#0c322c', '#2453ff', '#fe7c3f'].map(hex => `<div class="cl-fixture-colour" style="background:${hex}"><span>${hex}</span></div>`))],
  ['Recording tips', () => panel('Sound your best', '<p>Keep a little distance.<br>Find a quiet spot.<br>Watch your levels.</p><div class="note">You’re ready to record.</div>')],
  ['Embed editor', () => panel('Edit embedded asset', tiles() + row(button('Cancel'), button('Use this version', true)))],
  ['Stage zoom HUD', () => row(button('−'), '<output>100%</output>', button('+'), button('Fit'))],
  ['Session / folder', tiles],
  ['Folder overlay', () => panel('Launch assets', tiles() + button('Create folder'))],
  ['Headshot cropper', () => panel('Frame your photo', '<div class="cl-fixture-avatar">AB</div><label class="cl-fixture-label">Zoom<input type="range" value="35"></label>' + button('Use photo', true))],
  ['Content-credentials', () => panel('Content credentials', '<span class="chip chip--status">Ready to sign</span><p>Show who made it and how it was created.</p>' + button('Manage identity'))],
  ['Profile mobile menu', () => panel('Your space', row(button('Light', true), button('Dark')) + menu())],
  ['Hero result + verdict', () => panel('Made with Lolly', '<span class="chip chip--status">Verified</span><p>Origin and edit history are intact.</p><div class="cl-fixture-checks">✓ Origin &nbsp; ✓ Signature &nbsp; ✓ History</div>')],
  ['Metadata reveal', () => panel('File details', '<dl class="cl-fixture-kv"><dt>Format</dt><dd>SVG</dd><dt>Dimensions</dt><dd>1080 × 1080</dd><dt>Created with</dt><dd>Lolly</dd></dl>' + button('View metadata'))],
];

export function componentFixture(s: Specimen): string | null {
  if (s.markup || s.live) return null;
  return FIXTURES.find(([prefix]) => s.name.startsWith(prefix))?.[1]() ?? null;
}
