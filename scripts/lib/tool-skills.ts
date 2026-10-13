// SPDX-License-Identifier: MPL-2.0
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadTool } from '../../engine/src/loader.ts';

/** Public generation always uses public packs, regardless of the active profile. */
export async function generatePublicToolSkills(root: string, check: boolean): Promise<string[]> {
  const catalog = JSON.parse(readFileSync(join(root, 'brands/lolly-start/catalog/tools/index.json'), 'utf8'));
  const output = join(root, 'skills/tools');
  const expected = new Map<string, string>();
  const index = [];
  for (const entry of [...catalog.tools].sort((a, b) => a.id.localeCompare(b.id))) {
    const dir = [join(root, 'community', entry.id), join(root, 'brands/lolly-start/tools', entry.id)]
      .find(path => existsSync(join(path, 'tool.json')));
    if (!dir) throw new Error(`No public manifest for ${entry.id}`);
    const tool = await loadTool(entry.id, async path => readFileSync(join(dir, path.slice(entry.id.length + 1)), 'utf8'));
    const skill = await tool.readSkill!();
    if (skill.warning) throw new Error(`${entry.id}: ${skill.warning}`);
    const files = { 'SKILL.md': skill.markdown, ...skill.files };
    const hashes = Object.fromEntries(Object.entries(files).map(([path, content]) => [path, {
      sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content),
    }]));
    const metadata = { version: 1, toolId: skill.toolId, toolVersion: skill.toolVersion,
      toolVersionRange: skill.toolVersionRange, skillRevision: skill.skillRevision, origin: skill.origin,
      references: skill.references, files: hashes };
    for (const [path, content] of Object.entries(files)) expected.set(`${entry.id}/${path}`, content);
    expected.set(`${entry.id}/metadata.json`, JSON.stringify(metadata, null, 2) + '\n');
    index.push({ ...metadata, path: `${entry.id}/SKILL.md` });
  }
  expected.set('index.json', JSON.stringify({ version: 1, tools: index }, null, 2) + '\n');
  const drift: string[] = [];
  for (const [rel, content] of expected) {
    const path = join(output, rel);
    if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
    drift.push(`tool skill differs: skills/tools/${rel}`);
    if (!check) { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, content); }
  }
  function removeStale(dir: string, prefix = ''): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory()) removeStale(join(dir, entry.name), rel + '/');
      else if (!expected.has(rel)) {
        drift.push(`stale tool skill: skills/tools/${rel}`);
        if (!check) rmSync(join(dir, entry.name));
      }
    }
  }
  removeStale(output);
  return drift;
}
