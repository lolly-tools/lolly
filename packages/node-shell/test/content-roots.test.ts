// SPDX-License-Identifier: MPL-2.0
/**
 * The content-root resolver: overlay composition, profile precedence, and what a
 * materialized content root resolves to (plan 244).
 *
 * This suite was written while the repo-root `tools/` and `catalog/` symlink views
 * still existed, and half of it diffed every resolver answer against the farm
 * scripts/use-profile.ts had built, so the collapse could not change which tools were
 * mounted, where their files came from, or what bytes a consumer read. Step 6 removed
 * the views and the script, so those cases are gone with them: a skipped-forever case
 * is not coverage, and the contracts they pinned are the ones the fixture cases below
 * state directly.
 *
 * Overlay composition has no live example in the mounted profiles (lolly-start
 * carries no brand tools, and brands/suse is private), so the extends rules get a
 * purpose-built fixture tree: union, overlay-wins, one level of recursion, the
 * byte-preserving `extends` strip, and the fail-closed missing-base error.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  catalogFile, contentRoots, listToolFiles, materializeInto, readToolManifest,
  readToolManifestText, readToolText, toolDirs, toolFile,
} from '../src/content-roots.ts';

/** Every file under `dir`, '/' separated and relative to it, links followed. */
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

/**
 * Every consumer that wants manifest BYTES must get the composed form, not the
 * overlay file on disk. The signer hashes these bytes, the dev server serves them
 * and materializeInto writes them into dist, so a disagreement signs one manifest
 * and ships another - a release that fails its own verifier.
 */
test('manifest BYTES are the composed form everywhere they are read', async () => {
  const root = fixtureRoot();
  try {
    const roots = contentRoots({ root, profile: 'brand-x' });
    const composed = '{\n  "id": "alpha",\n  "title": "Brand alpha"\n}\n';
    assert.equal(readToolManifestText('alpha', roots), composed);
    assert.equal(await readToolText('alpha/tool.json', roots), composed);
    // The path on disk still declares the overlay marker - which is exactly why a
    // caller must not read it directly.
    assert.match(readFileSync(toolFile('alpha', 'tool.json', roots)!, 'utf8'), /"extends"/);
    const dest = mkdtempSync(join(tmpdir(), 'lolly-manifest-bytes-'));
    try {
      materializeInto(dest, roots);
      assert.equal(readFileSync(join(dest, 'tools/alpha/tool.json'), 'utf8'), composed);
    } finally {
      rmSync(dest, { recursive: true, force: true });
    }
    // A plain (non-overlay) tool is unchanged, byte for byte.
    const plain = readFileSync(toolFile('beta', 'tool.json', roots)!, 'utf8');
    assert.equal(await readToolText('beta/tool.json', roots), plain);
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
const ENV_KEYS = ['LOLLY_PROFILE', 'LOLLY_STRICT_PROFILE', 'VERCEL'] as const;

function withPrecedenceRoot(
  env: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  body: (root: string) => void,
): void {
  const root = fixtureRoot();
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    body(root);
  } finally {
    for (const key of ENV_KEYS) {
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
  // With LOLLY_STRICT_PROFILE that fallback would once have shipped the wrong brand
  // from a hosted BUILD, so it throws instead. vercel.json's buildCommand sets it.
  withPrecedenceRoot({ LOLLY_STRICT_PROFILE: '1' }, (root) => {
    breakDefault(root);
    assert.throws(() => contentRoots({ root }), /LOLLY_STRICT_PROFILE/);
  });
  // $VERCEL alone does NOT refuse: that is the deployed FUNCTION, which only ever
  // received the packs one build chose for it, so the first complete profile is the
  // right answer rather than a 500 on every content request.
  withPrecedenceRoot({ VERCEL: '1' }, (root) => {
    breakDefault(root);
    assert.equal(contentRoots({ root }).profile, 'brand-x');
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

