// SPDX-License-Identifier: MPL-2.0
/**
 * The content-root resolver against the symlink farm it replaces (plan 244 step 4).
 *
 * The point of this suite while both exist: every answer the resolver gives is
 * diffed against the repo-root `tools/` and `catalog/` VIEWS that
 * scripts/use-profile.ts built, so the collapse cannot change which tools are
 * mounted, where their files come from, or what bytes a consumer reads. Once the
 * views are gone (step 6) the farm cases skip by name and the fixture cases below
 * carry the overlay and precedence contracts on their own.
 *
 * Overlay composition has no live example in the mounted profiles (lolly-start
 * carries no brand tools, and brands/suse is private), so the extends rules get a
 * purpose-built fixture tree: union, overlay-wins, one level of recursion, the
 * byte-preserving `extends` strip, and the fail-closed missing-base error.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import {
  catalogFile, contentRoots, listToolFiles, materializeInto, readToolManifest, toolDirs, toolFile,
} from '../src/content-roots.ts';

const REPO_ROOT = realpathSync(new URL('../../../', import.meta.url).pathname);
const FARM = join(REPO_ROOT, 'tools');
const CATALOG_VIEW = join(REPO_ROOT, 'catalog');
const MARKER = '.lolly-view.json';

/** The views only exist until step 6 removes the script that built them. */
const farmBuilt = existsSync(join(FARM, MARKER));

/** Tool ids in the farm, i.e. what the active profile mounted. */
function farmIds(): string[] {
  return readdirSync(FARM).filter((n) => n !== MARKER && !n.startsWith('.')).sort();
}

/** Every file under `dir`, '/' separated and relative to it, links followed
 *  (statSync, not a Dirent: a farm entry is a symlink to a pack directory). */
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = prefix + name;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel + '/'));
    else out.push(rel);
  }
  return out.sort();
}

test('the resolver mounts exactly the tool ids the farm does', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  assert.deepEqual([...toolDirs(roots).keys()].sort(), farmIds());
  // The farm's marker records the profile it was built for.
  const marker = JSON.parse(readFileSync(join(FARM, MARKER), 'utf8')) as { profile?: string };
  assert.equal(roots.profile, marker.profile);
});

test('each id resolves to the same real directory the farm links to', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  for (const [id, { dir, base }] of toolDirs(roots)) {
    const link = join(FARM, id);
    if (lstatSync(link).isSymbolicLink()) {
      assert.equal(realpathSync(dir), realpathSync(link), `${id}: resolved dir differs from the farm link`);
      assert.equal(base, undefined, `${id}: the farm linked it plainly, so it is not an overlay`);
    } else {
      // A composed (overlay) dir is a real directory in the farm, not a link.
      assert.ok(base, `${id}: the farm composed it, so the resolver must report a base`);
    }
  }
});

test('listToolFiles matches a readdir over the farm, per tool', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  for (const id of toolDirs(roots).keys()) {
    assert.deepEqual(listToolFiles(id, roots), walk(join(FARM, id)), `${id}: file list differs from the farm`);
  }
});

test('readToolManifest matches the farm manifest, byte for byte where a path can', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  for (const [id, { base }] of toolDirs(roots)) {
    const farmRaw = readFileSync(join(FARM, id, 'tool.json'), 'utf8');
    assert.deepEqual(
      readToolManifest(id, roots), JSON.parse(farmRaw),
      `${id}: manifest differs from the farm`,
    );
    if (!base) {
      // A plain tool's manifest is the pack file itself, so bytes must match.
      assert.equal(readFileSync(toolFile(id, 'tool.json', roots)!, 'utf8'), farmRaw, `${id}: manifest bytes`);
    }
  }
});

test('toolFile resolves the same bytes the farm serves, and null for a miss', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  for (const id of toolDirs(roots).keys()) {
    for (const rel of listToolFiles(id, roots)) {
      const from = toolFile(id, rel, roots);
      assert.ok(from, `${id}/${rel}: resolver returned null for a file the union contains`);
      assert.equal(
        readFileSync(from).equals(readFileSync(join(FARM, id, ...rel.split('/')))), true,
        `${id}/${rel}: bytes differ from the farm`,
      );
    }
    assert.equal(toolFile(id, 'no-such-file.txt', roots), null);
  }
});

test('catalogFile resolves to the catalog view', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  assert.equal(
    realpathSync(catalogFile('tools/index.json', roots)),
    realpathSync(join(CATALOG_VIEW, 'tools', 'index.json')),
  );
  assert.equal(realpathSync(roots.catalogRoot), realpathSync(CATALOG_VIEW));
});

test('materializeInto writes the farm, file for file', { skip: !farmBuilt }, () => {
  const roots = contentRoots({ root: REPO_ROOT });
  const dest = mkdtempSync(join(tmpdir(), 'lolly-materialize-'));
  try {
    materializeInto(dest, roots);
    // The marker was view bookkeeping and carried a timestamp; nothing else differs.
    const expected = walk(FARM).filter((p) => p !== MARKER);
    assert.deepEqual(walk(join(dest, 'tools')), expected);
    for (const rel of expected) {
      assert.equal(
        readFileSync(join(dest, 'tools', ...rel.split('/'))).equals(readFileSync(join(FARM, ...rel.split('/')))),
        true, `tools/${rel}: materialised bytes differ from the farm`,
      );
    }
    // The catalog is large; compare the tree and spot-check the index bytes.
    assert.deepEqual(walk(join(dest, 'catalog')), walk(CATALOG_VIEW).filter((p) => p !== MARKER));
    assert.equal(
      readFileSync(join(dest, 'catalog', 'tools', 'index.json'))
        .equals(readFileSync(join(CATALOG_VIEW, 'tools', 'index.json'))),
      true,
    );
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});

// --- fixture tree: the overlay rules and the precedence order -----------------

function write(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
}

/**
 * A two-pack fixture root: community/{alpha,beta} and brands/x/tools/{alpha,gamma},
 * where brands/x's alpha is an overlay of community's alpha.
 */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'lolly-roots-'));
  write(join(root, 'profiles.json'), JSON.stringify({
    default: 'brand-x',
    profiles: {
      'brand-x': { tools: ['community', 'brands/x/tools'], catalog: 'brands/x/catalog' },
      plain: { tools: ['community'], catalog: 'brands/x/catalog', exclude: ['beta'] },
      absent: { tools: ['community', 'brands/absent/tools'], catalog: 'brands/absent/catalog' },
    },
  }, null, 2) + '\n');

  write(join(root, 'community/alpha/tool.json'), '{\n  "id": "alpha",\n  "title": "Base alpha"\n}\n');
  write(join(root, 'community/alpha/template.html'), '<p>base</p>\n');
  write(join(root, 'community/alpha/styles.css'), 'p{color:red}\n');
  write(join(root, 'community/alpha/i18n/de.json'), '{"t":"base de"}\n');
  write(join(root, 'community/alpha/i18n/fr.json'), '{"t":"base fr"}\n');
  write(join(root, 'community/alpha/assets/deep/logo.svg'), '<svg>base</svg>\n');
  write(join(root, 'community/beta/tool.json'), '{\n  "id": "beta"\n}\n');
  write(join(root, 'community/_shared/esc.js'), '// pack infrastructure, not a tool\n');
  write(join(root, 'community/NOTICE.md'), 'not a tool\n');

  // The overlay: same id, only the files that differ. The manifest keeps every
  // other byte, so the strip has to be surgical.
  write(join(root, 'brands/x/tools/alpha/tool.json'),
    '{\n  "id": "alpha",\n  "extends": "community",\n  "title": "Brand alpha"\n}\n');
  write(join(root, 'brands/x/tools/alpha/template.html'), '<p>overlay</p>\n');
  write(join(root, 'brands/x/tools/alpha/i18n/de.json'), '{"t":"overlay de"}\n');
  write(join(root, 'brands/x/tools/gamma/tool.json'), '{\n  "id": "gamma"\n}\n');
  write(join(root, 'brands/x/catalog/tools/index.json'), '{"tools":[]}\n');
  return root;
}

test('an overlay tool is the per-file union, overlay winning', () => {
  const root = fixtureRoot();
  try {
    const roots = contentRoots({ root, profile: 'brand-x' });
    const dirs = toolDirs(roots);
    assert.deepEqual([...dirs.keys()].sort(), ['alpha', 'beta', 'gamma']);
    assert.equal(dirs.get('alpha')!.dir, join(root, 'brands/x/tools/alpha'));
    assert.equal(dirs.get('alpha')!.base, join(root, 'community/alpha'));
    assert.equal(dirs.get('beta')!.base, undefined);

    assert.deepEqual(listToolFiles('alpha', roots), [
      'assets/deep/logo.svg', 'i18n/de.json', 'i18n/fr.json', 'styles.css', 'template.html', 'tool.json',
    ]);
    // Overlay wins per filename, base fills the gaps, one level down included.
    assert.equal(readFileSync(toolFile('alpha', 'template.html', roots)!, 'utf8'), '<p>overlay</p>\n');
    assert.equal(readFileSync(toolFile('alpha', 'styles.css', roots)!, 'utf8'), 'p{color:red}\n');
    assert.equal(readFileSync(toolFile('alpha', 'i18n/de.json', roots)!, 'utf8'), '{"t":"overlay de"}\n');
    assert.equal(readFileSync(toolFile('alpha', 'i18n/fr.json', roots)!, 'utf8'), '{"t":"base fr"}\n');
    assert.equal(readFileSync(toolFile('alpha', 'assets/deep/logo.svg', roots)!, 'utf8'), '<svg>base</svg>\n');
    assert.equal(toolFile('alpha', 'i18n/es.json', roots), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the composed manifest drops only the extends line', () => {
  const root = fixtureRoot();
  try {
    const roots = contentRoots({ root, profile: 'brand-x' });
    assert.deepEqual(readToolManifest('alpha', roots), { id: 'alpha', title: 'Brand alpha' });
    const dest = mkdtempSync(join(tmpdir(), 'lolly-overlay-'));
    try {
      materializeInto(dest, roots);
      assert.equal(
        readFileSync(join(dest, 'tools/alpha/tool.json'), 'utf8'),
        '{\n  "id": "alpha",\n  "title": "Brand alpha"\n}\n',
      );
      assert.deepEqual(walk(join(dest, 'tools')), [
        'alpha/assets/deep/logo.svg', 'alpha/i18n/de.json', 'alpha/i18n/fr.json', 'alpha/styles.css',
        'alpha/template.html', 'alpha/tool.json', 'beta/tool.json', 'gamma/tool.json',
      ]);
      assert.equal(readFileSync(join(dest, 'tools/alpha/i18n/de.json'), 'utf8'), '{"t":"overlay de"}\n');
      assert.deepEqual(walk(join(dest, 'catalog')), ['tools/index.json']);
    } finally {
      rmSync(dest, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('pack infrastructure and loose files are not tools; exclude drops an id', () => {
  const root = fixtureRoot();
  try {
    const ids = [...toolDirs(contentRoots({ root, profile: 'plain' })).keys()].sort();
    assert.deepEqual(ids, ['alpha'], '_shared, NOTICE.md and the excluded beta are all out');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a declared overlay with no base fails closed', () => {
  const root = fixtureRoot();
  try {
    rmSync(join(root, 'community/alpha'), { recursive: true, force: true });
    assert.throws(
      () => toolDirs(contentRoots({ root, profile: 'brand-x' })),
      /extends "community" but community\/alpha\/tool\.json does not exist/,
    );
    // And a base pack may not declare an overlay of its own.
    write(join(root, 'community/delta/tool.json'), '{"id":"delta","extends":"community"}\n');
    assert.throws(
      () => toolDirs(contentRoots({ root, profile: 'plain' })),
      /community tools are overlay BASES/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Each precedence case gets its OWN fixture root, because a resolution is
 * memoised per root plus the env that produced it - the same reason a process
 * resolves once and keeps the answer. Mutating one root's sticky file and asking
 * again would read the memo, not the disk, so the cases must not share a root.
 */
function withPrecedenceRoot(
  env: { LOLLY_PROFILE?: string; VERCEL?: string },
  body: (root: string) => void,
): void {
  const root = fixtureRoot();
  const saved = { LOLLY_PROFILE: process.env.LOLLY_PROFILE, VERCEL: process.env.VERCEL };
  try {
    for (const key of ['LOLLY_PROFILE', 'VERCEL'] as const) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    body(root);
  } finally {
    for (const key of ['LOLLY_PROFILE', 'VERCEL'] as const) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(root, { recursive: true, force: true });
  }
}

test('precedence 4: profiles.json default, with nothing else set', () => {
  withPrecedenceRoot({}, (root) => {
    assert.equal(contentRoots({ root }).profile, 'brand-x');
  });
});

test('precedence 3: the sticky .lolly-profile, when its packs are complete', () => {
  withPrecedenceRoot({}, (root) => {
    writeFileSync(join(root, '.lolly-profile'), 'plain\n');
    assert.equal(contentRoots({ root }).profile, 'plain');
  });
  // An incomplete sticky choice is ignored rather than failing the process.
  withPrecedenceRoot({}, (root) => {
    writeFileSync(join(root, '.lolly-profile'), 'absent\n');
    assert.equal(contentRoots({ root }).profile, 'brand-x');
  });
});

test('precedence 2: LOLLY_PROFILE beats the sticky file, and is trimmed', () => {
  withPrecedenceRoot({ LOLLY_PROFILE: ' plain \n' }, (root) => {
    writeFileSync(join(root, '.lolly-profile'), 'brand-x\n');
    assert.equal(contentRoots({ root }).profile, 'plain');
  });
});

test('precedence 1: opts.profile beats the env', () => {
  withPrecedenceRoot({ LOLLY_PROFILE: 'brand-x' }, (root) => {
    assert.equal(contentRoots({ root, profile: 'plain' }).profile, 'plain');
  });
});

test('an explicit choice with absent packs is an error, not a fallback', () => {
  withPrecedenceRoot({}, (root) => {
    assert.throws(() => contentRoots({ root, profile: 'absent' }), /is missing: brands\/absent/);
    assert.throws(() => contentRoots({ root, profile: 'nope' }), /unknown profile "nope"/);
  });
  withPrecedenceRoot({ LOLLY_PROFILE: 'absent' }, (root) => {
    assert.throws(() => contentRoots({ root }), /is missing: brands\/absent/);
  });
});

test('precedence 5: the first complete profile when the default is incomplete', () => {
  const breakDefault = (root: string): void => {
    const cfgPath = join(root, 'profiles.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { default: string };
    cfg.default = 'absent';
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  };
  withPrecedenceRoot({}, (root) => {
    breakDefault(root);
    assert.equal(contentRoots({ root }).profile, 'brand-x');
  });
  // Under $VERCEL that fallback would once have shipped the wrong brand, so it throws.
  withPrecedenceRoot({ VERCEL: '1' }, (root) => {
    breakDefault(root);
    assert.throws(() => contentRoots({ root }), /incomplete on Vercel/);
  });
});

test('profiles.json is required, and the error says where it looked', () => {
  const empty = mkdtempSync(join(tmpdir(), 'lolly-empty-'));
  try {
    assert.throws(() => contentRoots({ root: empty }), new RegExp(`no profiles\\.json at ${empty}`));
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

/**
 * A materializeInto output is itself a content root, and must resolve without a
 * profiles.json: that tree is what the desktop app exports beside itself and points
 * LOLLY_ROOT at, what the RPM payload and the Docker image carry, and what the CLI
 * contract suites build as a fixture. One code path serves a packaged install and a
 * checkout, which is why the resolver reads such a root as the single composed profile
 * it is - overlays already applied, `extends` already stripped.
 */
test('a materialized tools/ + catalog/ tree resolves with no profiles.json', () => {
  const root = fixtureRoot();
  const dest = mkdtempSync(join(tmpdir(), 'lolly-packaged-'));
  try {
    materializeInto(dest, contentRoots({ root, profile: 'brand-x' }));
    assert.equal(existsSync(join(dest, 'profiles.json')), false, 'a packaged root carries no profiles.json');

    const packaged = contentRoots({ root: dest });
    assert.equal(packaged.profile, 'materialized');
    assert.deepEqual([...toolDirs(packaged).keys()].sort(), ['alpha', 'beta', 'gamma']);
    assert.equal(catalogFile('tools/index.json', packaged), join(dest, 'catalog', 'tools', 'index.json'));
    // The overlay arrives composed: the brand's title, and no marker left to follow.
    const manifest = readToolManifest('alpha', packaged) as Record<string, unknown>;
    assert.equal(manifest.title, 'Brand alpha');
    assert.equal('extends' in manifest, false);
    assert.equal(readFileSync(toolFile('alpha', 'i18n/fr.json', packaged)!, 'utf8'), '{"t":"base fr"}\n');
  } finally {
    rmSync(dest, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the farm case list is not silently empty', { skip: !farmBuilt }, () => {
  assert.ok(farmIds().length > 10, `expected a mounted profile, saw ${farmIds().length} tools`);
  assert.ok(relative(REPO_ROOT, FARM) === 'tools');
});
