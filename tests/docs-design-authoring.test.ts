// SPDX-License-Identifier: MPL-2.0
/**
 * The plan 291 W5/W8 docs promise only what the code does (the "docs promise an absent
 * CLI verb" defect, checked at the source):
 *
 *   - every `$` key the agent skill's Design reference documents is an authoring key of
 *     design-authoring-v1, and every key of the contract is documented there;
 *   - every flag the docs show on `lolly measure --text`, `lolly measure --text-layers`,
 *     `lolly package` and `lolly run <session.lolly>` is a flag that branch accepts, and
 *     every export format shown for a saved session is one it exports;
 *   - the MCP arguments the docs describe for `lolly_measure_text` and `lolly_package`
 *     are properties of those tools' input schemas;
 *   - the tool count words in docs/mcp.md and the skill's surfaces heading match the
 *     always-on tools the server registers;
 *   - every value a W5 engine module exports is named in the 1.244.0 CHANGELOG;
 *   - the docs say what `--s` takes on a Design run, that a placeholder picture is
 *     drawn only after `lolly package`, and carry no development-branch wording;
 *   - the docs describe what plan 291 M4 shipped (one document in every theme:
 *     token references, the role tokens, `?theme=auto`, photo looks, `--themes`,
 *     `_themes`) and drop the limits it fixed.
 *
 * Run directly: node --test tests/docs-design-authoring.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DESIGN_AUTHORING_DOCUMENT_KEYS, DESIGN_AUTHORING_MACROS, DESIGN_AUTHORING_ROW_KEYS,
} from '../packages/core/src/design-authoring-v1.ts';
import { DESIGN_COMPOSE_CASES, DESIGN_COMPOSE_EMPHASIS_MODES, DESIGN_COMPOSE_LOGO_MODES, DESIGN_COMPOSE_RESERVED_FIELDS } from '../packages/core/src/design-compose-v1.ts';
import { COMPOSE_BOOL_FLAGS, COMPOSE_VALUE_FLAGS, MEASURE_BOOL_FLAGS, MEASURE_VALUE_FLAGS, PACKAGE_BOOL_FLAGS, PACKAGE_VALUE_FLAGS } from '../shells/cli/src/args.ts';
import { DESIGN_SESSION_EXPORT_FORMATS, SESSION_RUN_FLAGS, designSessionRunPlan } from '../shells/cli/src/design-session.ts';
import { TOOL_DEFS } from '../services/mcp/src/tools.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

/** The pages that document the W5/W8 surfaces. */
const PAGES = [
  'docs/cli.md',
  'docs/cli-automation.md',
  'docs/mcp.md',
  'docs/ai-agents.md',
  'skills/lolly/SKILL.md',
  'skills/lolly/reference/design.md',
  'skills/lolly/reference/surfaces.md',
  'skills/lolly/reference/recreate.md',
];

/** Flags every verb accepts (args.ts GLOBAL_BOOL_FLAGS). */
const GLOBAL = ['json', 'quiet', 'verbose', 'strict'];

/** Each `lolly <verb> …` command shown in a page, inline or in a code block, cut at the end of the span. */
function commands(text: string, verb: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`lolly ${verb}\\b[^\`\\n]*(?:\\n[ \\t]*(?:--|\\[)[^\`\\n]*)*`, 'g');
  for (const m of text.matchAll(re)) out.push(m[0].replace(/\s+/g, ' '));
  return out;
}

const flagsOf = (cmd: string): string[] => [...cmd.matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1]!);

test('the Design reference documents exactly the authoring keys of design-authoring-v1', () => {
  const design = read('skills/lolly/reference/design.md');
  const contract = new Set<string>([...DESIGN_AUTHORING_ROW_KEYS, ...DESIGN_AUTHORING_MACROS, ...DESIGN_AUTHORING_DOCUMENT_KEYS]);
  // A `$` key in code: `$in`, "$stack", `{ "$style": … }`. Price-like text has no letter after `$`.
  const documented = new Set([...design.matchAll(/["`]\$([a-z][A-Za-z]*)\b/g)].map((m) => `$${m[1]}`));
  for (const key of documented) assert.ok(contract.has(key), `design.md documents ${key}, which design-authoring-v1 does not define`);
  for (const key of contract) assert.ok(documented.has(key), `design.md does not document the authoring key ${key}`);
});

test('every flag the docs show on lolly measure --text and --text-layers is one that branch accepts', () => {
  const allowed = new Set<string>([...MEASURE_VALUE_FLAGS, ...MEASURE_BOOL_FLAGS, ...GLOBAL]);
  let seen = 0;
  for (const page of PAGES) {
    for (const cmd of commands(read(page), 'measure')) {
      const flags = flagsOf(cmd);
      if (!flags.includes('text') && !flags.includes('text-layers')) continue; // the compiled-document measure
      seen++;
      for (const flag of flags) assert.ok(allowed.has(flag), `${page}: "${cmd}" shows --${flag}, which lolly measure --text does not accept`);
    }
  }
  assert.ok(seen >= 3, `expected the docs to show lolly measure --text at least three times, saw ${seen}`);
});

test('every flag the docs show on lolly package is one it accepts', () => {
  // `--help` is answered by the entry point before the verb runs (tests/verb-help-cli.test.ts).
  const allowed = new Set<string>([...PACKAGE_VALUE_FLAGS, ...PACKAGE_BOOL_FLAGS, ...GLOBAL, 'help']);
  let seen = 0;
  for (const page of PAGES) {
    for (const cmd of commands(read(page), 'package')) {
      seen++;
      for (const flag of flagsOf(cmd)) assert.ok(allowed.has(flag), `${page}: "${cmd}" shows --${flag}, which lolly package does not accept`);
    }
  }
  assert.ok(seen >= 3, `expected the docs to show lolly package at least three times, saw ${seen}`);
});

test('every flag the docs show on lolly compose is one it accepts (plan 291 W6)', () => {
  // `--help` is answered by the entry point before the verb runs (tests/compose-cli.test.ts).
  const allowed = new Set<string>([...COMPOSE_VALUE_FLAGS, ...COMPOSE_BOOL_FLAGS, ...GLOBAL, 'help']);
  let seen = 0;
  const pagesShowing = new Set<string>();
  for (const page of PAGES) {
    for (const cmd of commands(read(page), 'compose')) {
      seen++;
      pagesShowing.add(page);
      for (const flag of flagsOf(cmd)) assert.ok(allowed.has(flag), `${page}: "${cmd}" shows --${flag}, which lolly compose does not accept`);
    }
  }
  assert.ok(seen >= 6, `expected the docs to show lolly compose at least six times, saw ${seen}`);
  for (const page of ['docs/cli.md', 'skills/lolly/reference/design.md', 'skills/lolly/reference/recreate.md'])
    assert.ok(pagesShowing.has(page), `${page} shows no lolly compose command`);
});

test('the Design reference documents every key of a compose spec, a slide and its furniture (plan 291 W6)', () => {
  const schema = JSON.parse(read('schemas/design-compose-v1.schema.json')) as { $defs: Record<string, { properties: Record<string, unknown> }> };
  const design = read('skills/lolly/reference/design.md');
  const section = design.split(/^## Compose slides from the slide master$/m)[1]?.split(/^## (?!#)/m)[0] ?? '';
  assert.ok(section, 'design.md has no "## Compose slides from the slide master" section');
  for (const def of ['spec', 'slide', 'furniture']) {
    for (const key of Object.keys(schema.$defs[def]!.properties)) assert.ok(section.includes(`\`${key}\``), `design.md's compose section does not document the ${def} key ${key}`);
  }
  // Every key in the slide table is a key a slide has.
  const slideKeys = new Set(Object.keys(schema.$defs.slide!.properties));
  let rows = 0;
  for (const m of section.matchAll(/^\| `([a-z]+)`(?:, `([a-z]+)`)*(?:, `([a-z]+)`)? \|/gm)) {
    rows++;
    for (const key of m.slice(1).filter(Boolean)) assert.ok(slideKeys.has(key!), `design.md's slide table documents ${key}, which a compose slide does not have`);
  }
  assert.ok(rows >= 8, `expected the compose section's slide table, saw ${rows} rows`);
  for (const mode of DESIGN_COMPOSE_LOGO_MODES) assert.ok(section.includes(`\`${mode}\``), `design.md's compose section does not name the logo mode ${mode}`);
  // The binding fields a slot override may not set, exactly as the contract lists them.
  const listed = section.match(/The binding fields \(([^)]*)\) are refused/)?.[1];
  assert.ok(listed, 'design.md should list the binding fields a slot override may not set');
  assert.deepEqual([...listed.matchAll(/`([a-z]+)`/g)].map((m) => m[1]), [...DESIGN_COMPOSE_RESERVED_FIELDS]);
});

test('the recreate playbook composes, says how to reach the web shell, and accepts both edits shapes (plan 291 W6)', () => {
  const recreate = read('skills/lolly/reference/recreate.md').replace(/\s+/g, ' ');
  assert.ok(recreate.includes('lolly compose --suggest'), 'recreate.md should start the slides from lolly compose --suggest');
  assert.ok(recreate.includes('--edits-out'), 'recreate.md should say where compose writes its edits');
  assert.ok(recreate.includes('LOLLY_WEB_BASE'), 'recreate.md should say how to point the CLI at a running web shell');
  assert.ok(recreate.includes('{ "edits": [...] }'), 'recreate.md should say check reads the object shape compose writes');
  assert.ok(!/A list of exactly three/.test(recreate), 'verify.list-triads fires on dense "X, Y and Z" prose, never on a three-item list');
});

test('the docs describe what plan 291 M3b shipped and drop the limits it fixed', () => {
  const schema = JSON.parse(read('schemas/design-compose-v1.schema.json')) as { $defs: Record<string, { properties: Record<string, unknown> }> };
  const sectionOf = (text: string, heading: RegExp): string => text.split(heading)[1]?.split(/^##? (?!#)/m)[0] ?? '';
  const design = sectionOf(read('skills/lolly/reference/design.md'), /^## Compose slides from the slide master$/m);
  // The slot object's keys (join, case and emphasis among them) and every emphasis and case mode.
  for (const key of Object.keys(schema.$defs.slotObject!.properties)) assert.ok(design.includes(`\`${key}\``), `design.md's compose section does not document the slot key ${key}`);
  for (const mode of [...DESIGN_COMPOSE_EMPHASIS_MODES, ...DESIGN_COMPOSE_CASES]) assert.ok(design.includes(`\`${mode}\``), `design.md's compose section does not name the mode ${mode}`);
  // The notes the new spec keys raise, so an agent reading a report can look each one up.
  for (const code of ['compose.dark.themed', 'compose.dark.none', 'compose.ground.ignored', 'compose.emphasis.accent',
    'compose.emphasis.no-accent', 'compose.case.sentence', 'compose.furniture.unknown']) {
    assert.ok(design.includes(`\`${code}\``), `design.md's compose section does not say when compose writes ${code}`);
  }
  // The CLI and MCP pages name the deck-level keys and join.
  const cli = sectionOf(read('docs/cli.md'), /^## Compose slides from the slide master$/m);
  const mcp = sectionOf(read('docs/mcp.md'), /^### Compose, measure and package a Design document$/m);
  for (const [page, text] of [['docs/cli.md', cli], ['docs/mcp.md', mcp]] as const) {
    assert.ok(text, `${page} lost its compose section`);
    for (const key of ['furniture', 'emphasis', 'case', 'join']) assert.ok(text.includes(`\`${key}\``), `${page}'s compose section does not name \`${key}\``);
  }
  // The recreate playbook mentions the new check and the scorer's new measures.
  const recreate = read('skills/lolly/reference/recreate.md');
  for (const word of ['design.image.low-resolution', 'pptx.tier', 'notesLinesSplit', '"join"', '`emphasis`']) {
    assert.ok(recreate.includes(word), `recreate.md does not mention ${word}`);
  }
  // Limits M3b fixed: a one-slide picture export keeps its ground, a stretched picture is flagged,
  // and a palette colour with alpha is that palette colour.
  const FIXED = [
    /does not paint the artboard's own background/,
    /leaves the artboard's own background transparent/,
    /Nothing flags a picture scaled/,
    /with alpha \(`#13294bcc`\) is not a brand colour/,
  ];
  for (const page of PAGES) {
    const text = read(page).replace(/\s+/g, ' ');
    for (const re of FIXED) assert.ok(!re.test(text), `${page} still says ${re.source}, which plan 291 M3b fixed`);
  }
});

test('a saved session run shows only flags it accepts, and formats it exports', () => {
  const formats = new Set<string>(DESIGN_SESSION_EXPORT_FORMATS);
  let seen = 0;
  for (const page of PAGES) {
    for (const cmd of commands(read(page), 'run')) {
      // Only a run of a .lolly that is not a reusable tool file (--trust-tool) is a session run.
      if (!/^lolly run \S+\.lolly\b/.test(cmd) || cmd.includes('--trust-tool')) continue;
      seen++;
      // `--help` prints the session run's own help before anything runs (tests/verb-help-cli.test.ts).
      for (const flag of flagsOf(cmd)) assert.ok(SESSION_RUN_FLAGS.has(flag) || flag === 'help', `${page}: "${cmd}" shows --${flag}, which a saved session run refuses`);
      const exp = cmd.match(/--export=([a-z|]+)/)?.[1];
      for (const fmt of exp?.split('|') ?? []) assert.ok(formats.has(fmt), `${page}: "${cmd}" shows --export=${fmt}, which a saved session does not export`);
    }
  }
  assert.ok(seen >= 2, `expected the docs to show lolly run <session.lolly> at least twice, saw ${seen}`);
});

test('the MCP arguments the docs describe are in the tools\' input schemas', () => {
  const props = (name: string): Set<string> => {
    const def = TOOL_DEFS.find((d) => d.name === name);
    assert.ok(def, `${name} is not registered`);
    return new Set(Object.keys((def.inputSchema as { properties: Record<string, unknown> }).properties));
  };
  const measure = props('lolly_measure_text');
  for (const arg of ['text', 'width', 'height', 'style', 'theme', 'document', 'layerIds']) assert.ok(measure.has(arg), `lolly_measure_text has no ${arg} argument`);
  const pack = props('lolly_package');
  for (const arg of ['document', 'toolId', 'inputs', 'assets', 'source', 'label', 'theme', 'allowMissingMedia']) assert.ok(pack.has(arg), `lolly_package has no ${arg} argument`);
  const compose = props('lolly_compose');
  for (const arg of ['mode', 'spec', 'inventory', 'source', 'size', 'theme', 'fit']) assert.ok(compose.has(arg), `lolly_compose has no ${arg} argument`);
});

test('the tool count words match the always-on tools the server registers', () => {
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two'];
  const n = TOOL_DEFS.length;
  const mcp = read('docs/mcp.md');
  assert.ok(mcp.includes(`## The ${WORDS[n]} tools`), `docs/mcp.md should head its tool list "The ${WORDS[n]} tools"`);
  const curls = [...mcp.matchAll(/a JSON list of the ([a-z-]+) tools/g)].map((m) => m[1]);
  assert.ok(curls.length >= 2, 'docs/mcp.md lost its curl checks');
  for (const word of curls) assert.equal(word, WORDS[n], 'docs/mcp.md curl check counts the wrong number of tools');
  assert.ok(read('skills/lolly/reference/surfaces.md').includes(`### The ${n} tools`), `surfaces.md should head its tool table "The ${n} tools"`);
});

test('every value the barrel exports from a plans/291 W5 engine module is named under ## 1.244.0 or a later minor', () => {
  const changelog = read('engine/CHANGELOG.md');
  const [newer = '', rest = ''] = changelog.split(/^## 1\.244\.0$/m);
  const section = rest.split(/^## /m)[0] ?? '';
  assert.ok(section, 'engine/CHANGELOG.md has no ## 1.244.0 section');
  // Newer minors sit above 1.244.0; a later export from the same module is named there.
  const firstMinor = newer.search(/^## /m);
  const named = section + (firstMinor < 0 ? '' : newer.slice(firstMinor));
  const modules = [...section.matchAll(/^- Add `([\w/-]+\.ts)` \(plans\/291 W5\)/gm)].map((m) => m[1]!);
  assert.ok(modules.length >= 4, `expected the W5 engine modules under 1.244.0, saw ${modules.join(', ') || 'none'}`);
  const barrel = read('engine/src/index.ts');
  for (const mod of modules) {
    const lines = [...barrel.matchAll(new RegExp(`^export \\{([^}]*)\\} from '\\./${mod.replace(/[.]/g, '\\.')}';`, 'gm'))];
    assert.ok(lines.length, `engine/src/index.ts exports no value from ./${mod}`);
    const names = lines.flatMap((m) => m[1]!.split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('type ')));
    for (const name of names) assert.ok(named.includes(`\`${name}\``) || named.includes(`\`${name}(`), `${mod} exports ${name}, which neither ## 1.244.0 nor a later minor names`);
  }
});

test('the docs say what --s takes on a Design run, as the runtime error does', () => {
  // The runtime's own words for the address (shells/cli/src/frame-page.ts).
  assert.ok(read('shells/cli/src/frame-page.ts').includes('a number is the 1-based position, anything else is a frame id'),
    'frame-page.ts changed what --s takes; update the docs and this test');
  for (const page of ['docs/cli.md', 'skills/lolly/reference/surfaces.md']) {
    const text = read(page).replace(/\s+/g, ' ');
    assert.ok(/1-based slide number/.test(text) && /frame id/.test(text), `${page} should say --s is a 1-based slide number or a frame id`);
    assert.ok(/a frame's name is not an address/i.test(text), `${page} should say a frame name is not an --s address`);
    assert.ok(/run design --document=<file\|->`? \[--s=<slide>\]|run design --document`?[^.]*`--s/.test(text), `${page} should list --s for run design --document`);
  }
  for (const page of PAGES) assert.ok(!read(page).includes('--s=<artboard>'), `${page} still shows --s=<artboard>; the address is a slide number or frame id`);
});

test('the docs say a placeholder picture is drawn only once lolly package gives it bytes', () => {
  for (const page of ['docs/cli.md', 'skills/lolly/reference/design.md']) {
    const text = read(page).replace(/\s+/g, ' ');
    assert.ok(text.includes('photo:title'), `${page} no longer shows the placeholder pattern; drop it from this test`);
    assert.ok(/gets its bytes only/.test(text), `${page} should say a placeholder gets its bytes only from lolly package`);
    assert.ok(text.includes('brand.asset.review'), `${page} should say check lists an unpackaged placeholder as brand.asset.review`);
  }
});

test('the published pages carry no development-branch wording', () => {
  for (const page of PAGES) assert.ok(!/\b(?:on|in) this branch\b/i.test(read(page)), `${page} says "this branch", which a reader of the published docs cannot place`);
});

test('the docs describe one document in every theme, as plan 291 M4 built it', () => {
  const design = read('skills/lolly/reference/design.md');
  for (const word of ['?theme=auto', '?treatment=', '`$tint`', '__runs', 'brand.token-link.unresolved', 'brand.reference.unknown', '--themes=light,dark', '_themes', 'authoring.colour.deferred']) {
    assert.ok(design.includes(word), `design.md does not mention ${word}`);
  }
  // Every role token the public starter pack declares is named, so an agent can write {color.role.<name>}.
  const starter = JSON.parse(read('brands/lolly-start/catalog/assets/lolly/tokens/brand.json')) as { light: { color: { role: Record<string, unknown> } } };
  const roles = Object.keys(starter.light.color.role);
  assert.ok(roles.length > 0, 'the starter pack lost its color.role tokens; drop this part of the test');
  for (const role of roles) assert.ok(design.includes(`\`${role}\``), `design.md does not name the role token ${role}`);
  // The playbook ends with one document exported in every theme.
  const recreate = read('skills/lolly/reference/recreate.md');
  for (const word of ['--themes=light,dark', 'delivery.json', '"themes": ["light", "dark"]', '?treatment=']) assert.ok(recreate.includes(word), `recreate.md does not mention ${word}`);
  for (const page of ['docs/cli.md', 'skills/lolly/reference/surfaces.md', 'skills/lolly/SKILL.md']) assert.ok(read(page).includes('--themes'), `${page} does not mention --themes`);
  const mcp = read('docs/mcp.md');
  assert.ok(mcp.includes('_themes') && /`themes` \(a list of theme names, or `"all"`\)/.test(mcp), 'docs/mcp.md should describe lolly_check themes and the render route\'s _themes');
  assert.ok(read('shells/cli/bin/lolly.ts').includes('--themes=<a,b|all>'), 'the CLI help should list --themes');
  // What the docs show is accepted: a saved session takes --themes, and lolly_check takes themes.
  assert.equal(designSessionRunPlan({ export: 'pptx', output: 'deck.pptx', themes: 'light,dark' }).themes, 'light,dark');
  const check = TOOL_DEFS.find((d) => d.name === 'lolly_check');
  assert.ok(check && 'themes' in (check.inputSchema as { properties: Record<string, unknown> }).properties, 'lolly_check has no themes argument');
  // Limits M4 fixed: one document per theme, photo treatments made outside Lolly, uploads
  // painted empty in the render checks, and every note line written as its own paragraph.
  const FIXED = [
    /Each theme is its own document/,
    /Prepare a treated picture outside Lolly/,
    /paints uploaded pictures empty/,
    /draws the page without the pictures you uploaded/,
    /writes every `\\n` in an artboard's `notes` as a paragraph/,
    /which today's export does to every `a:br`/,
  ];
  for (const page of PAGES) {
    const text = read(page).replace(/\s+/g, ' ');
    for (const re of FIXED) assert.ok(!re.test(text), `${page} still says ${re.source}, which plan 291 M4 fixed`);
  }
});

test('the `_themes` docs say an undeclared choice draws the default theme with no warning, as every surface does', async () => {
  // The engine records the miss, but no surface (the CLI bridge, the web route reader,
  // the public render route) shows it; the docs must not promise a report.
  const { resolveTokenSelection } = await import('../engine/src/token-selection.ts');
  const doc = { $themes: [{ id: 'light', selectedTokenSets: { light: 'enabled' } }, { id: 'dark', selectedTokenSets: { dark: 'enabled' } }], light: {}, dark: {} };
  const picked = resolveTokenSelection(doc, { selection: { '': 'nope' } });
  assert.equal(picked.choices[''], 'light', 'an undeclared choice falls back to the group default');
  for (const page of ['docs/url-parameters.md', 'docs/mcp.md', 'skills/lolly/reference/design.md', 'skills/lolly/reference/surfaces.md']) {
    const text = read(page).replace(/\s+/g, ' ');
    assert.ok(!/does not declare is reported/.test(text), `${page} says an undeclared theme choice is reported; nothing reports it`);
  }
  const row = read('docs/url-parameters.md').split('\n').find((l) => l.startsWith('| `_themes` |'));
  assert.ok(row && /default theme, with no warning/.test(row), 'the _themes row should say an undeclared choice draws the default theme with no warning');
});

test('the docs do not promise a themed Design render on the public render route, which refuses Design', () => {
  // services/mcp/test/render-get.test.ts pins the refusal itself.
  const design = read('skills/lolly/reference/design.md').replace(/\s+/g, ' ');
  assert.ok(!/the public render route honours it too/.test(design), 'design.md says the public render route renders a themed Design document');
  assert.match(design, /public render route reads `_themes` too, but it refuses Design in any theme/);
  for (const page of ['skills/lolly/reference/surfaces.md', 'docs/mcp.md', 'docs/url-parameters.md']) {
    const text = read(page).replace(/\s+/g, ' ');
    assert.ok(!/renders a document whose colours are token references in that theme/.test(text), `${page} says the render route draws a token-referenced document in a theme`);
    assert.match(text, /refuses a Design document in any theme/, `${page} should say the public route refuses Design in any theme`);
  }
});

test('the grad grammar a $tint scrim needs is documented, and the documented scrim is accepted', async () => {
  const design = read('skills/lolly/reference/design.md');
  const block = [...design.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!).find((b) => b.includes('"$tint"'));
  assert.ok(block, 'design.md should show a JSON example of a $tint scrim');
  const row = JSON.parse(block!) as Record<string, unknown>;
  assert.match(String(row.grad), /^lin_\d+_[0-9a-f]{8}-\d+_[0-9a-f]{8}-\d+$/, 'the example scrim is a linear spec with per-stop alpha');
  const { expandDesignAuthoring } = await import('../engine/src/design-authoring.ts');
  const artboard = { id: String(row.$in), $artboard: true, x: 0, y: 0, w: 1920, h: 1080 };
  const out = expandDesignAuthoring([artboard, row]);
  const scrim = out.rows.find((r) => r.id === row.id)!;
  assert.match(String(scrim.tokenLinks), /"mode":"tint"/, 'the documented scrim is linked as a tint');
  // The CSS form an agent reaches for without the grammar is refused, as the page says.
  assert.throws(() => expandDesignAuthoring([artboard, { ...row, grad: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 100%)' }]), /\/1\/grad: \$tint recolours a linear gradient only/);
  // lolly schema design carries the same grammar on the grad field.
  const { documentSchema } = await import('../engine/src/document-api.ts');
  const schema = documentSchema(JSON.parse(read('community/design/tool.json'))) as { properties: { boxes: { items: { properties: Record<string, { description?: string }> } } } };
  assert.match(schema.properties.boxes.items.properties.grad!.description ?? '', /lin_90_30ba78-0_efefef-100/, 'lolly schema design should print the grad spec grammar');
});

test('the docs say a saved session still export is one board, as sessionFrameChoice does', async () => {
  const { sessionFrameChoice } = await import('../shells/cli/src/design-session.ts');
  const choice = sessionFrameChoice(['s01', 's02'], undefined, 'png', 'deck.lolly');
  assert.equal(choice.frame, '1', 'a saved session png with no --s is its first frame');
  const design = read('skills/lolly/reference/design.md').replace(/\s+/g, ' ');
  assert.ok(!/addressed at export with `s` \(`url-mode.md`\): stills fan out to one file per board,/.test(design), 'design.md says stills fan out with no word on the CLI');
  assert.match(design, /writes one still, the first board unless `--s` names another/);
});

// Plan 291 section 6, round 1: the skill and CLI guidance the judge found drifted.

test('the docs say --themes paints the page in every theme, as lolly check does', () => {
  // tests/check-render-themes.test.ts pins the behaviour: the render family opens the
  // page once per theme and tags each finding with its theme.
  const pages = [...PAGES, 'services/mcp/src/check.ts'];
  for (const page of pages) {
    const text = read(page).replace(/\s+/g, ' ');
    assert.ok(!/(?:render|the painted page)[^.;]*run once, in the first theme/i.test(text), `${page} says the render family runs once under --themes; it runs in each theme`);
    assert.ok(!/brand and Verify (?:findings|finding|families)/.test(text) || /render, brand and Verify/.test(text), `${page} names only the brand and Verify families as per theme`);
  }
  for (const page of ['skills/lolly/reference/design.md', 'skills/lolly/reference/recreate.md', 'skills/lolly/reference/surfaces.md', 'docs/cli.md', 'docs/mcp.md']) {
    assert.match(read(page).replace(/\s+/g, ' '), /render, brand and Verify/, `${page} should say the render family runs in each theme`);
  }
});

test('the docs place a layout divider from the artboard, as the expansion does', async () => {
  const { expandDesignAuthoring } = await import('../engine/src/design-authoring.ts');
  const artboard = { id: 's1', $artboard: true, x: 0, y: 0, w: 1920, h: 1080 };
  const table = {
    id: 't', $in: 's1', $table: {
      x: 400, y: 200, pitch: 60, divider: { id: 't-rule{r}', x: 120, w: 300, stroke: '#cccccc', strokeW: 2 },
      columns: [{ slot: 'text', kind: 'text', id: 't-c{r}', w: 300, h: 40 }], rows: [['One'], ['Two']],
    },
  };
  const rule = expandDesignAuthoring([artboard, table]).rows.find((r) => r.id === 't-rule1')!;
  assert.equal(rule.x, 120, 'a table divider\'s x is measured from the artboard, not from the table');
  const design = read('skills/lolly/reference/design.md').replace(/\s+/g, ' ');
  assert.match(design, /A divider's own `x` \(down a `y` stack, or in a table\) or `y` \(across an `x` stack\) is measured from the artboard/);
  assert.match(design, /a divider's `x` is measured from the slide's left edge/);
  assert.match(read('shells/cli/src/compose.ts').replace(/\s+/g, ' '), /a divider's own x is measured from the slide/);
});

test('the docs say a hex fg on a composed slot keeps the master\'s link, as the resolver treats it', async () => {
  const { resolveBlockTokenBindings } = await import('../engine/src/token-block-bindings.ts');
  const { createTokenSet } = await import('../engine/src/tokens.ts');
  const tokens = JSON.parse(read('brands/lolly-start/catalog/assets/lolly/tokens/brand.json'));
  const light = createTokenSet(tokens, { theme: 'light' });
  const dark = createTokenSet(tokens, { theme: 'dark' });
  const ink = String(light.get('color.semantic.text')?.value).toLowerCase();
  const darkInk = String(dark.get('color.semantic.text')?.value).toLowerCase();
  assert.notEqual(ink, darkInk, 'the starter pack\'s text ink changes with the theme; pick another token');
  // A composed slot as compose writes the row: the slot's own fg, with the master's link kept.
  const link = JSON.stringify({ fg: { ref: '{color.semantic.text}', value: ink, status: 'linked' } });
  const fields = [{ id: 'fg', type: 'color' as const }];
  const inDark = (fg: string) => (resolveBlockTokenBindings([{ id: 'x', kind: 'text', fg, tokenLinks: link }] as never, 'tokenLinks', fields, dark)[0] as Record<string, unknown>).fg;
  assert.equal(inDark('#ff0000'), '#ff0000', 'a hex that differs from the master\'s stays in every theme');
  assert.equal(String(inDark(ink)).toLowerCase(), darkInk, 'a hex equal to the master\'s still follows the theme');
  const design = read('skills/lolly/reference/design.md').replace(/\s+/g, ' ');
  assert.match(design, /A slot's own `fg` keeps the master's link\./);
  assert.match(read('shells/cli/src/compose.ts').replace(/\s+/g, ' '), /A hex fg keeps the master's colour link/);
});

test('the docs say an omitted furniture piece leaves the .pptx slide layout too, as the lowering does', async () => {
  const { composeDesign } = await import('../packages/node-shell/src/design-compose.ts');
  const { designFramesToPptx, framesOfDesignDoc } = await import('../packages/node-shell/src/design-pptx.ts');
  const MASTERS = resolve(ROOT, 'brands/lolly-start/catalog/assets/lolly/slides/masters.json');
  const master = (JSON.parse(read('brands/lolly-start/catalog/assets/lolly/slides/masters.json')) as { masters: unknown[] }).masters[0];
  const spec = (omit: string[]) => ({ slides: [{ archetype: 'full-image', slots: { caption: 'Hello', visual: { image: 'lolly/logo/primary' } }, furniture: { omit } }] });
  const scrimY = Math.round(0.8 * 1080 * 9525);
  const layoutRects = async (omit: string[]) => {
    const doc = (await composeDesign(spec(omit), { master: MASTERS })).document as never;
    const out = await designFramesToPptx({ frames: framesOfDesignDoc(doc), master: master as never });
    return out.layouts.flatMap((l) => l.shapes).filter((s) => s?.kind === 'rect' && (s as { y?: number }).y === scrimY);
  };
  assert.equal((await layoutRects([])).length, 1, 'the full-image layout carries the master\'s caption scrim');
  assert.equal((await layoutRects(['caption-scrim'])).length, 0, 'the layout of a slide that omits the scrim has none');
  const design = read('skills/lolly/reference/design.md').replace(/\s+/g, ' ');
  assert.match(design, /Omitting it \(`"furniture": \{ "omit": \["caption-scrim"\] \}`\) reaches the `\.pptx` too/);
});

test('the hand-over shows how to write one theme\'s file under its exact name', () => {
  const recreate = read('skills/lolly/reference/recreate.md').replace(/\s+/g, ' ');
  const shown = /lolly run <name>\.lolly --theme=dark --export=pptx --output=<name>-dark\.pptx/.exec(recreate);
  assert.ok(shown, 'recreate.md should show --theme=<name> --output=<name>-<theme>.pptx');
  const plan = designSessionRunPlan({ theme: 'dark', export: 'pptx', output: 'deck-dark.pptx' });
  assert.equal(plan.themes, undefined, '--theme writes one file under the name given');
});
