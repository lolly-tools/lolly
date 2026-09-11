// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects Templates collection (plans/226 WP-4): the `#/p/__templates__` route, what
 * it lists, the tile menu's action set, the session tile's "Save as a template...", and the
 * add-picker's blank-or-a-template choice.
 *
 * Two halves, deliberately:
 *   - views/projects-templates.ts IS importable here (pure model + HTML + a collection over
 *     a profile), so its behaviour is exercised for real against a memory host.
 *   - views/projects.ts is NOT (it pulls view chunks and their stylesheets through Vite),
 *     so its wiring is pinned by source scan, exactly as views/projects-add-seed.test.ts
 *     and views/projects-duplicate.test.ts do. That wiring reads across two files: the view
 *     itself, and views/projects-templates-wiring.ts, which holds the glue that would
 *     otherwise sit inside the mount closure (the doors, the selection-bar rows, the
 *     add-picker step). The scan below reads both and treats them as one source.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/projects-templates.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ADD_SEED_BLANK, TEMPLATES, buildTemplatesModel, createTemplatesCollection, matchesTemplate,
  selectTemplates, templateMenuHtml, templateTileHtml, templateUseHref, templatesBodyHtml,
  type TemplateItem, type TemplatesCtx, type TemplatesToolInfo,
} from './projects-templates.ts';
import type { UserTemplate } from '../lib/user-templates.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source with comments removed, so a claim cannot be met by prose describing it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => { const at = line.search(/(^|[^:])\/\//); return at === -1 ? line : line.slice(0, at === 0 ? 0 : at + 1); })
    .join('\n');
}
/** The `{ … }` body that follows `head`, by brace matching (same helper as the sibling scans). */
function bodyAfter(src: string, head: string): string {
  const at = src.indexOf(head);
  assert.notEqual(at, -1, `expected to find \`${head}\``);
  const open = src.indexOf('{', at + head.length);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  assert.fail(`unbalanced braces while extracting \`${head}\``);
}

const VIEW = stripComments(readFileSync(join(HERE, 'projects.ts'), 'utf8'));
const WIRING = stripComments(readFileSync(join(HERE, 'projects-templates-wiring.ts'), 'utf8'));
const CODE = `${VIEW}\n${WIRING}`;

// ── fixtures ────────────────────────────────────────────────────────────────

const TOOLS: TemplatesToolInfo[] = [
  {
    id: 'chart', name: 'Chart', formats: ['svg', 'png'],
    templates: [
      { id: 'poster', name: 'Poster', description: 'A big number' },
      { id: 'flyer', name: 'Flyer' },
    ],
  },
  { id: 'qr-code', name: 'QR Code', formats: ['svg'] },
];

const OWN: UserTemplate[] = [{
  id: 'u1', toolId: 'chart', name: 'Quarterly', description: 'Our numbers',
  values: { title: 'Q3' }, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
}];

const toolName = (id: string): string => TOOLS.find(x => x.id === id)?.name ?? id;

function model(opts: { hidden?: string[]; start?: Record<string, string> } = {}) {
  return buildTemplatesModel({
    tools: TOOLS,
    own: OWN,
    hidden: new Set(opts.hidden ?? []),
    startOf: (toolId) => opts.start?.[toolId] ?? null,
    toolName,
  });
}

/** A profile-backed host: the only surface the store and the overlays touch. */
function memoryHost(profile: Record<string, unknown> = {}) {
  let current: Record<string, unknown> = { ...profile };
  return {
    host: {
      profile: {
        get: async () => current,
        set: async (next: Record<string, unknown>) => { current = next; },
      },
    },
    read: () => current,
  };
}

function collection(over: Partial<TemplatesCtx> & { host: TemplatesCtx['host'] }) {
  const ctx: TemplatesCtx = {
    toolIndex: () => TOOLS,
    toolName,
    params: '',
    isSelected: () => false,
    announce: () => {},
    toast: () => {},
    prompt: async () => null,
    confirm: async () => true,
    refresh: async () => {},
    isMounted: () => true,
    loadSession: async () => null,
    loadManifest: async () => ({ inputs: [] }),
    ...over,
  };
  return createTemplatesCollection(ctx);
}

// ── the model ───────────────────────────────────────────────────────────────

test('the collection lists own + shipped + hidden from the index and the profile', () => {
  const m = model({ hidden: ['chart:flyer'], start: { chart: 'user:u1' } });
  const refs = m.items.map(i => i.ref);
  assert.deepEqual(refs, ['chart:poster', 'chart:flyer', 'user:u1']);
  assert.equal(m.items.find(i => i.ref === 'chart:flyer')!.hidden, true, 'the hidden overlay marks the shipped tile');
  assert.equal(m.items.find(i => i.ref === 'chart:poster')!.hidden, false);
  assert.equal(m.items.find(i => i.ref === 'user:u1')!.own, true, 'a user record is the person\'s own');
  assert.equal(m.items.find(i => i.ref === 'user:u1')!.startsHere, true, '"Start with" marks exactly one tile per tool');
  assert.equal(m.items.find(i => i.ref === 'chart:poster')!.startsHere, false);
  assert.deepEqual(m.tools.map(x => x.id), ['chart'], 'only tools with a template get a chip');
  assert.deepEqual(m.items.find(i => i.ref === 'user:u1')!.formats, ['svg', 'png'], 'an own tile renders in its tool\'s format');
});

test('the three sections split by ownership, then by the hidden overlay', () => {
  const { own, shipped, hidden } = selectTemplates(model({ hidden: ['chart:flyer'] }), '', '');
  assert.deepEqual(own.map(i => i.ref), ['user:u1']);
  assert.deepEqual(shipped.map(i => i.ref), ['chart:poster'], 'a hidden shipped template leaves the shipped section');
  assert.deepEqual(hidden.map(i => i.ref), ['chart:flyer']);
});

test('the tool chip and the ?q= search reflex both filter the tiles', () => {
  const m = model();
  assert.deepEqual(selectTemplates(m, 'qr-code', '').own.map(i => i.ref), [], 'the chip scopes to one tool');
  assert.deepEqual(selectTemplates(m, '', 'quarterly').own.map(i => i.ref), ['user:u1'], 'name matches');
  assert.deepEqual(selectTemplates(m, '', 'numbers').own.map(i => i.ref), ['user:u1'], 'description matches');
  assert.deepEqual(selectTemplates(m, '', 'chart').shipped.map(i => i.ref), ['chart:poster', 'chart:flyer'], 'tool name matches');
  assert.equal(matchesTemplate(m.items[0]!, 'poster big'), true, 'every token must hit');
  assert.equal(matchesTemplate(m.items[0]!, 'poster nope'), false);
});

// ── links, tiles, menu ──────────────────────────────────────────────────────

test('Use carries the ref the launcher resolves, shipped and own', () => {
  const m = model();
  const shipped = m.items.find(i => i.ref === 'chart:poster')!;
  const own = m.items.find(i => i.ref === 'user:u1')!;
  assert.equal(templateUseHref(shipped), '#/tool/chart?template=chart%3Aposter');
  assert.equal(templateUseHref(own), '#/tool/chart?template=user%3Au1');
});

test('a template tile is a template, never a droppable file', () => {
  const html = templateTileHtml(model().items[0]!, false);
  assert.match(html, /data-kind="template"/, 'the tile declares its own kind');
  assert.match(html, /data-ref="chart:poster"/);
  assert.doesNotMatch(html, /data-drop-folder/, 'a template tile is not a drop target');
  assert.doesNotMatch(html, /draggable="true"/, 'and it is not dragged into folders either');
  assert.match(html, /data-tpl-preview="chart:poster"/, 'the cover carries the lazy-preview hook');
  assert.match(html, /data-menu-kind="template"/, 'the kebab opens the template menu');
});

test('the "Starts here" mark is a tinted chip, not an accent border', () => {
  const m = model({ start: { chart: 'chart:poster' } });
  const html = templateTileHtml(m.items.find(i => i.ref === 'chart:poster')!, false);
  assert.match(html, /class="tpl-starts"/, 'the marked tile carries the chip');
  const css = readFileSync(join(HERE, '..', 'styles', 'parts', 'projects.css'), 'utf8');
  const rule = css.slice(css.indexOf('.tpl-starts {'), css.indexOf('.tpl-starts {') + 260);
  assert.match(rule, /background:/, 'the mark is a fill');
  assert.doesNotMatch(rule, /border(-color|-width|-style)?\s*:/, 'no accent border on a rounded card (house rule)');
  assert.doesNotMatch(templateTileHtml(m.items[1]!, false), /tpl-starts/, 'only the chosen tile is marked');
});

test('the tile menu offers exactly the plan\'s action set, per ownership', () => {
  const m = model({ hidden: ['chart:flyer'], start: { chart: 'chart:poster' } });
  const acts = (item: TemplateItem): string[] =>
    [...templateMenuHtml(item).matchAll(/data-act="([^"]+)"/g)].map(x => x[1]!);
  assert.deepEqual(acts(m.items.find(i => i.ref === 'chart:poster')!),
    ['tpl-use', 'tpl-start-off', 'tpl-copy', 'tpl-hide'],
    'a shipped tile that IS the start offers the toggle off, a copy and Hide');
  assert.deepEqual(acts(m.items.find(i => i.ref === 'chart:flyer')!),
    ['tpl-use', 'tpl-start', 'tpl-copy', 'tpl-restore'],
    'a hidden shipped tile offers Restore, never Hide');
  assert.deepEqual(acts(m.items.find(i => i.ref === 'user:u1')!),
    ['tpl-use', 'tpl-start', 'tpl-rename', 'tpl-describe', 'tpl-export', 'tpl-share', 'tpl-delete'],
    'your own template renames, exports, shares and deletes - it is never hidden');
});

test('the body renders the three sections, the chips and the empty state', () => {
  const m = model({ hidden: ['chart:flyer'] });
  const html = templatesBodyHtml(m, { tool: '', hiddenOpen: false }, { query: '', isSelected: () => false });
  assert.match(html, /Yours/, 'the own group keeps the gallery\'s name');
  assert.match(html, /Shipped with Chart/, 'shipped tiles group per tool');
  assert.match(html, /tpl-hidden-count">1</, 'the Hidden header counts them');
  assert.doesNotMatch(html, /data-ref="chart:flyer"/, 'and stays collapsed until asked');
  assert.match(templatesBodyHtml(m, { tool: '', hiddenOpen: true }, { query: '', isSelected: () => false }),
    /data-ref="chart:flyer"/, 'opening the reveal lists them');
  assert.match(html, /Starting points you saved/, 'the header explains what the collection is');
  assert.doesNotMatch(html, /data-rename-folder|data-render-folder/, 'no rename / render controls: it is not a folder');
  const none = templatesBodyHtml({ items: [], tools: [] }, { tool: '', hiddenOpen: false }, { query: '', isSelected: () => false });
  assert.match(none, /Save as a template/, 'the empty state points at both doors');
});

// ── the live collection over a memory host ──────────────────────────────────

test('"Save as a template..." drops the per-document keys and keeps the export markers', async () => {
  const { host, read } = memoryHost();
  const saved: string[] = [];
  const tpl = collection({
    host: host as unknown as TemplatesCtx['host'],
    prompt: async () => 'My start',
    toast: (message) => saved.push(message),
    loadSession: async () => ({
      __label: 'Poster', __toolId: 'chart', __toolVersion: '1.2.0',
      __export_format: 'png', __export_filename: 'poster.png',
      title: 'Q3', logo: 'bytes-in-memory',
    }),
    loadManifest: async () => ({ inputs: [{ id: 'title', type: 'text' }, { id: 'logo', type: 'file' }] }),
  });
  await tpl.saveSessions([{ slot: 'chart:1', toolId: 'chart', label: 'Poster' }], { ask: true });
  const list = read().userTemplates as UserTemplate[];
  assert.equal(list.length, 1);
  assert.equal(list[0]!.name, 'My start', 'the name dialog wins over the session label');
  assert.equal(list[0]!.toolId, 'chart');
  assert.deepEqual(list[0]!.values, { __export_format: 'png', title: 'Q3' },
    '__label/__toolId/__toolVersion/__export_filename and every file input are dropped; other __export_* stay');
  assert.deepEqual(saved, ['Saved as a template'], 'the toast confirms it');
});

test('the bulk save makes one template per selected session, named from its label', async () => {
  const { host, read } = memoryHost();
  const tpl = collection({
    host: host as unknown as TemplatesCtx['host'],
    prompt: async () => { throw new Error('the bulk save must not ask per session'); },
    loadSession: async (slot) => ({ __toolId: 'chart', title: slot }),
    loadManifest: async () => ({ inputs: [{ id: 'title', type: 'text' }] }),
  });
  await tpl.saveSessions([
    { slot: 'chart:1', toolId: 'chart', label: 'One' },
    { slot: 'chart:2', toolId: 'chart', label: 'Two' },
  ], { ask: false });
  const list = read().userTemplates as UserTemplate[];
  assert.deepEqual(list.map(x => x.name), ['One', 'Two']);
  assert.deepEqual(list.map(x => x.values.title), ['chart:1', 'chart:2']);
});

test('a tool with only file inputs cannot carry a template, so nothing is written', async () => {
  const { host, read } = memoryHost();
  const said: string[] = [];
  const tpl = collection({
    host: host as unknown as TemplatesCtx['host'],
    announce: (m) => said.push(m),
    loadSession: async () => ({ __toolId: 'strip-data' }),
    loadManifest: async () => ({ inputs: [{ id: 'file', type: 'file' }] }),
  });
  await tpl.saveSessions([{ slot: 'strip-data:1', toolId: 'strip-data', label: 'Scrub' }], { ask: false });
  assert.equal(read().userTemplates, undefined, 'nothing saved');
  assert.deepEqual(said, ['Nothing here could be saved as a template.']);
  assert.equal(tpl.canTemplate('strip-data'), false, 'and the menu gate now knows to hide the row');
});

test('the add-picker leads with Start with, lists shipped, and drops the hidden ones', async () => {
  const { host } = memoryHost({ userTemplates: OWN });
  const tpl = collection({ host: host as unknown as TemplatesCtx['host'] });
  const profile = {
    userTemplates: OWN,
    hiddenTemplates: ['chart:flyer'],
    templateStart: { chart: 'chart:poster' },
  } as unknown as Parameters<typeof tpl.addSeedChoices>[1];
  const choices = await tpl.addSeedChoices('chart', profile);
  assert.deepEqual(choices.map(c => c.id), [ADD_SEED_BLANK, 'chart:poster', 'user:u1'],
    'blank first, then shipped minus hidden, then yours');
  assert.equal(choices[1]!.label, 'Start with: Poster', 'the start is labelled as such');
  assert.equal(choices[1]!.primary, true, 'and it is the preselected choice');
  assert.equal(choices[0]!.label, 'Blank', 'the blank row is named for what it does');
  assert.ok(!choices[0]!.primary, 'a set start takes the lead away from blank');
});

test('a tool with no templates at all leaves nothing to choose', async () => {
  const { host } = memoryHost();
  const tpl = collection({ host: host as unknown as TemplatesCtx['host'] });
  const choices = await tpl.addSeedChoices('qr-code', {} as unknown as Parameters<typeof tpl.addSeedChoices>[1]);
  assert.deepEqual(choices.map(c => c.id), [ADD_SEED_BLANK], 'only the blank row - the caller skips the dialog');
  assert.equal(choices[0]!.primary, true, 'with no setting, blank leads');
});

test('hide, restore and delete all go through the shared template actions', async () => {
  const { host, read } = memoryHost({ userTemplates: OWN, templateStart: { chart: 'user:u1' } });
  const tpl = collection({ host: host as unknown as TemplatesCtx['host'] });
  await tpl.load(read() as unknown as Parameters<typeof tpl.load>[0]);
  assert.equal(tpl.has('chart:poster'), true, 'the collection knows its refs');
  await tpl.bulk('hide', ['chart:poster']);
  assert.deepEqual(read().hiddenTemplates, ['chart:poster'], 'hiding writes the shipped ref to the profile');
  await tpl.bulk('restore', ['chart:poster']);
  assert.deepEqual(read().hiddenTemplates, [], 'restoring takes it back off');
  await tpl.bulk('delete', ['user:u1']);
  assert.deepEqual(read().userTemplates, [], 'your own template is deleted, never hidden');
  assert.deepEqual(read().templateStart, undefined, 'and a "Start with" pointing at it is cleared');
});

test('bulkKinds answers what the current selection can actually do', async () => {
  const { host, read } = memoryHost({ userTemplates: OWN, hiddenTemplates: ['chart:flyer'] });
  const tpl = collection({ host: host as unknown as TemplatesCtx['host'] });
  await tpl.load(read() as unknown as Parameters<typeof tpl.load>[0]);
  assert.deepEqual(tpl.bulkKinds(['chart:poster']), { hide: true, restore: false, delete: false });
  assert.deepEqual(tpl.bulkKinds(['chart:flyer']), { hide: false, restore: true, delete: false });
  assert.deepEqual(tpl.bulkKinds(['user:u1']), { hide: false, restore: false, delete: true });
});

// ── the view's wiring (source scan) ─────────────────────────────────────────

test('the route mounts the collection like the other synthetic folder', () => {
  assert.match(VIEW, /import \{ TEMPLATES, templateBulkMenuHtml/, 'the sentinel comes from the module that owns the route');
  assert.match(WIRING, /createTemplatesCollection\(\{\n\s+host,/,
    'and the collection is built in one place, from the six answers only the view has');
  assert.match(CODE, /folderId === TEMPLATES \? shell\(t\('Templates'\), 'projects', tpl\.html\(query\), \{ inFolder: true \}\)/,
    'render() branches to the collection body before the folder branch');
  assert.match(CODE, /if \(folderId === TEMPLATES\) await tpl\.load\(profile\);/, 'reload() fills it from the same profile pass');
  assert.match(CODE, /if \(folderId === TEMPLATES\) tpl\.wire\(root, query\);/, 'wire() hands it the fresh root');
  assert.match(CODE, /folderId !== UNCAT && folderId !== TEMPLATES\) \? folderId : null/,
    'the synthetic route is never a folder target for drops, pastes or a new session');
  assert.match(CODE, /if \(folderId && folderId !== UNCAT && folderId !== TEMPLATES && !folders\.some/,
    'the stale-folder fallback does not bounce the collection to the root');
});

test('the Templates doors are containers, and neither accepts a drop', () => {
  assert.match(CODE, /class="projects-chip projects-chip--nav" data-open-folder-nav="\$\{escapeHtml\(TEMPLATES\)\}"/,
    'the rail chip navigates');
  const chip = bodyAfter(WIRING, 'export function templatesRailChip(): string');
  assert.doesNotMatch(chip, /data-drop-folder/, 'the rail chip is NOT a drop target');
  assert.match(VIEW, /\.join\(''\)\}\$\{templatesRailChip\(\)\}/, 'and it always ends the folder rail');
  const tile = bodyAfter(WIRING, 'export function templatesRootTile(): string');
  assert.match(VIEW, /\$\{teamTile\}\$\{templatesRootTile\(\)\}\$\{trashTile\}/, 'the root grid carries the tile beside Trash');
  assert.match(tile, /folder-tile--templates/, 'the root tile wears the container silhouette');
  assert.doesNotMatch(tile, /data-drop-folder|data-ref=/, 'it is neither a drop target nor a selectable item');
  const css = readFileSync(join(HERE, '..', 'styles', 'parts', 'projects.css'), 'utf8');
  assert.match(css, /\.folder-tile--templates \.tile-cover \{[^}]*aspect-ratio: auto/,
    'and it reads as a container, not a 4/3 document card');
});

test('the session tile and the selection bar both offer "Save as a template..."', () => {
  assert.match(CODE, /canShare && tpl\.canTemplate\(entryBySlot\(\)\.get\(ref\)\?\.toolId \?\? ''\) \? menuItem\('save-session-template', TEMPLATE_ICON, t\('Save as a template…'\)\) : ''/,
    'the row sits in the session menu, gated on the tool being able to carry one - and a '
    + 'batch grid is not one document, so it never offers it');
  assert.match(CODE, /else if \(act === 'save-session-template'\) await tpl\.saveSessions\(\[sessionSource\(ref\)\], \{ ask: true \}\)/,
    'one session asks for a name');
  assert.match(CODE, /if \(action === 'save-templates'\) \{ void tpl\.saveSessions\(templatableSelection\(\)\.map\(sessionSource\), \{ ask: false \}\); return; \}/,
    'N selected sessions save N, named from their labels');
});

test('the collection replaces the file actions in the selection bar', () => {
  assert.match(VIEW, /const inTemplates = \(\): boolean => folderId === TEMPLATES;/);
  assert.match(WIRING, /\{ id: 'hide', icon: HIDE_ICON, label: \(\) => t\('Hide'\), hidden: \(\) => !gates\.kinds\(\)\.hide \}/);
  assert.match(WIRING, /\{ id: 'restore', icon: SHOW_ICON, label: \(\) => t\('Restore'\), hidden: \(\) => !gates\.kinds\(\)\.restore \}/);
  assert.match(VIEW, /const templateRows = templateBulkRows\(\{ templatable: \(\) => templatableSelection\(\)\.length > 0, kinds: \(\) => tpl\.bulkKinds\(inTemplates\(\) \? \[\.\.\.selected\.keys\(\)\] : \[\]\) \}\);/,
    'the view answers what the rows are allowed to do; the rows themselves live beside the collection');
  assert.match(CODE, /if \(inTemplates\(\)\) \{ void tpl\.bulk\(action, \[\.\.\.selected\.keys\(\)\]\); return; \}/, 'and the bar routes to the collection');
  assert.match(CODE, /id: 'move', icon: MOVE_ICON, label: \(\) => t\('Move to…'\), hidden: \(\) => inTemplates\(\)/,
    'the file actions stand down where they have nothing to act on');
});

test('the OLD project-template feature is a BLUEPRINT in every string', () => {
  assert.match(CODE, /t\('Save project as a blueprint…'\)/, 'the folder menu names it');
  assert.match(CODE, /t\('New project from a blueprint'\)/, 'so do the create tile and header button');
  assert.match(CODE, /async function openBlueprintChooser\(\)/, 'and the colliding function name is gone');
  assert.doesNotMatch(CODE, /openTemplateChooser/, 'nothing calls the old name any more');
  assert.doesNotMatch(CODE, /project template/i, 'no user-facing string says "project template"');
  assert.match(CODE, /profile\.projectTemplates|store\.templateAdd|templateList/, 'the stored data keeps its name - this is copy, not a migration');
});

test('the collection sentinel is the plan\'s route', () => {
  assert.equal(TEMPLATES, '__templates__');
});
