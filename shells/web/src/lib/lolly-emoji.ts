// SPDX-License-Identifier: MPL-2.0
/** Document emoji closure: retain exact pack pins and only the artwork the source uses. */
import type { EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { assetDependency } from '../../../../engine/src/asset-version.ts';
import { sha256Hex } from '../../../../engine/src/bytes.ts';
import type { readEmojiBundle } from '../../../../engine/src/emoji-bundle.ts';
import type { BeamAssetRecord } from './beam-pack.ts';
import type { LollyBuildInput } from './lolly-pack.ts';
import { resolveSessionUserAsset } from './session-asset-versions.ts';

type Row = Record<string, unknown>;
type ReadBundle = Awaited<ReturnType<typeof readEmojiBundle>>;
const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const pinKey = (pin: EmojiPackPinV1): string => JSON.stringify([pin.id, pin.pin.version, pin.checksum]);
interface Group {
  read: ReadBundle;
  record: BeamAssetRecord;
  artwork: Map<string, string>;
  urls: Set<string>;
}

/** Scan authored values, including hidden/timed layers. Asset metadata and editor chrome are not content. */
async function contentUsage(source: Row): Promise<{ texts: Set<string>; rendered: Row[]; present: boolean }> {
  const texts = new Set<string>(), rendered = Array.isArray(source.__emojiUsage) ? source.__emojiUsage.filter(isRow) : [];
  let present = rendered.length > 0, visited = 0;
  const walk = async (value: unknown, depth: number): Promise<void> => {
    if (++visited > 200000 || depth > 64) throw new Error('The document exceeds the emoji dependency scan limit.');
    if (typeof value === 'string') {
      if (/^(?:data:|blob:|https?:\/\/)/i.test(value)) return;
      if (value.length > 16 * 1024 * 1024) throw new Error('The text exceeds the emoji dependency scan limit.');
      // Authored rich text is a JSON string on a Design row. Read its runs, so
      // escaped Unicode and paragraph boundaries have the same meaning as plain text.
      if (/^\s*[[{]/.test(value)) {
        let parsed: unknown;
        try { parsed = JSON.parse(value); } catch { /* Ordinary text may begin with a bracket. */ }
        if (parsed !== undefined) { await walk(parsed, depth + 1); return; }
      }
      if (!/[\u00a9-\uffff]/.test(value)) return;
      const { segmentEmojiText } = await import('../../../../engine/src/emoji-segment.ts');
      // ASCII whitespace cannot occur inside an emoji sequence. Splitting here
      // keeps long prose within the segmenter's existing per-run bound.
      for (const part of value.split(/[\t\r\n ]+/)) {
        if (!/[\u00a9-\uffff]/.test(part)) continue;
        for (const span of segmentEmojiText(part)) {
          if (span.kind !== 'text') present = true;
          if (span.kind === 'emoji') texts.add(span.text);
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) await walk(item, depth + 1);
    } else if (isRow(value)) {
      if (typeof value.id === 'string' && typeof value.source === 'string') return;
      for (const [key, item] of Object.entries(value)) {
        if (key.startsWith('__') || ['meta', 'thumb', 'thumbnail', 'customCss'].includes(key)) continue;
        await walk(item, depth + 1);
      }
    }
  };
  await walk(source, 0);
  return { texts, rendered, present };
}

/** This rewrites an export snapshot, never the stored session or installed full packs. */
export async function prepareLollyEmoji(input: LollyBuildInput): Promise<LollyBuildInput> {
  const records = new Map(input.userAssets.map(record => [record.id, record]));
  const loaded = new Map<string, Promise<{ read: ReadBundle; record: BeamAssetRecord } | null>>();
  const groups = new Map<string, Group>();
  const pending: Array<{ target: Row; keys: string[] }> = [];
  let visited = 0;
  const load = (key: string) => {
    let result = loaded.get(key);
    if (!result) {
      result = (async () => {
        const record = await resolveSessionUserAsset(key, records, input.resolveUser);
        if (!record?.blob || !record.meta?.emoji) return null;
        const { readEmojiBundle } = await import('../../../../engine/src/emoji-bundle.ts');
        const read = await readEmojiBundle(new Uint8Array(await record.blob.arrayBuffer()));
        return { read, record };
      })();
      loaded.set(key, result);
    }
    return result;
  };
  const addGroup = ({ read, record }: { read: ReadBundle; record: BeamAssetRecord }): string => {
    const key = pinKey(read.info.pin);
    let group = groups.get(key);
    if (!group) {
      group = { read, record, artwork: new Map(), urls: new Set() };
      groups.set(key, group);
    }
    for (const [url, svg] of Object.entries(read.bundle.artwork)) if (typeof svg === 'string') group.artwork.set(url, svg);
    return key;
  };
  const walk = async (value: unknown, depth = 0, owner = input.toolId): Promise<unknown> => {
    if (++visited > 200000 || depth > 64) throw new Error('The document exceeds the emoji dependency scan limit.');
    if (Array.isArray(value)) return Promise.all(value.map(item => walk(item, depth + 1, owner)));
    if (!isRow(value)) return value;
    const result: Row = { ...value };
    // Only the document's derived emoji dependencies are pruned. An emoji bundle
    // deliberately placed as an ordinary file asset still travels in full.
    if (Array.isArray(value.__emojiAssets) && value.__emojiAssets.length) {
      // Legacy template tools may emit fixed emoji absent from their input values.
      // New snapshots record the render census. Design's text is already in its rows.
      const toolId = typeof value.__toolId === 'string' ? value.__toolId : owner;
      const legacy = toolId !== 'design' && !Array.isArray(value.__emojiUsage);
      if (!legacy) {
        const usage = await contentUsage(value);
        if (!usage.present) result.__emojiAssets = [];
        else {
          const deps = [];
          for (const ref of value.__emojiAssets) {
            if (!isRow(ref) || typeof ref.id !== 'string') throw new Error('Invalid saved emoji dependency.');
            const dep = await load(assetDependency(ref as { id: string }).key);
            if (!dep) throw new Error('Restore the saved emoji pack before exporting this document.');
            deps.push(dep);
          }
          const { parseEmojiParams } = await import('../../../../engine/src/emoji-style.ts');
          const { resolveEmoji } = await import('../../../../engine/src/emoji-resolve.ts');
          const parsed = parseEmojiParams(isRow(value.__emoji) ? value.__emoji : {}, deps.map(dep => dep.read.info), []);
          if (!parsed.style) throw new Error('Restore the saved emoji style before exporting this document.');
          const keys = deps.map(addGroup);
          const reads = deps.map(dep => dep.read);
          for (const text of usage.texts) {
            const resolved = resolveEmoji({ kind: 'unicode', text }, parsed.style, reads.map(read => read.pack));
            if (resolved.status === 'resolved') groups.get(pinKey(resolved.value.pack))!.urls.add(resolved.value.glyph.asset.url);
            else if (resolved.status === 'unresolved' && resolved.issue.code === 'pack-unavailable') {
              throw new Error('Restore the saved emoji pack before exporting this document.');
            }
          }
          for (const source of usage.rendered) {
            if (typeof source.packId !== 'string' || typeof source.assetId !== 'string') continue;
            const group = groups.get(JSON.stringify([source.packId, source.version, source.checksum]));
            const glyph = group?.read.manifest.glyphs.find(glyph => glyph.asset.id === source.assetId);
            if (group && glyph) group.urls.add(glyph.asset.url);
          }
          pending.push({ target: result, keys });
        }
      }
    }
    for (const [key, item] of Object.entries(result)) {
      if (key === '__emojiAssets' || key === '__emojiUsage' || key === '__emoji') continue;
      if (item && typeof item === 'object') result[key] = await walk(item, depth + 1, owner);
    }
    return result;
  };
  const session = await walk(input.session);
  const project = input.project ? { ...input.project, sessions: await Promise.all(input.project.sessions.map(async entry => ({ ...entry, data: await walk(entry.data, 0, entry.toolId) as Row }))) } : undefined;
  const templates = input.templates ? await Promise.all(input.templates.map(async entry => isRow(entry) ? { ...entry, values: await walk(entry.values, 0, entry.toolId) as Row } : entry)) : undefined;
  const replacements = new Map<string, Row>(), extra: BeamAssetRecord[] = [];
  for (const [key, group] of groups) {
    // A second imported document can hold more glyphs for the same exact pin.
    // Use those verified source bytes if this saved dependency is a smaller subset.
    if ([...group.urls].some(url => !group.artwork.has(url))) {
      for (const record of input.userAssets) {
        const meta = record.meta?.emoji as Record<string, unknown> | undefined;
        if (!meta || JSON.stringify([meta.id, meta.version, meta.checksum]) !== key) continue;
        const other = await load(record.id);
        if (other) addGroup(other);
      }
    }
    const artwork: Record<string, string> = Object.create(null);
    const { verifyEmojiArtwork } = await import('../../../../engine/src/emoji-pack.ts');
    for (const url of [...group.urls].sort()) {
      const glyph = group.read.manifest.glyphs.find(glyph => glyph.asset.url === url)!;
      const svg = group.artwork.get(url);
      if (typeof svg !== 'string') throw new Error(`Restore the saved artwork for ${glyph.label} before exporting.`);
      const verified = await verifyEmojiArtwork(group.read.pack, glyph.meaning, new TextEncoder().encode(svg));
      if (!verified.ok) throw new Error(`The saved artwork for ${glyph.label} failed verification.`);
      artwork[url] = svg;
    }
    // Keep the exact manifest to preserve its checksum, fallback coverage and
    // Fluent's pin-specific ink rule. ZIP deflates this metadata; unused SVGs are absent.
    const bytes = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, kind: 'emoji-pack-bundle', manifest: group.read.bundle.manifest, artwork }));
    const digest = await sha256Hex(bytes), id = `user/emoji/${digest}`;
    const { pin, ...labels } = group.read.info;
    extra.push({ id, type: 'data', format: 'json', version: digest, blob: new Blob([bytes], { type: 'application/json' }),
      meta: { ...group.record.meta, name: `${group.read.info.label} (document glyphs)`, size: bytes.length,
        emoji: { ...labels, id: pin.id, version: pin.pin.version, checksum: pin.checksum }, emojiArtworkCount: group.urls.size } });
    replacements.set(key, { source: 'user', id, type: 'data', format: 'json', pin: { version: digest, format: 'json' } });
  }
  for (const { target, keys } of pending) target.__emojiAssets = [...new Set(keys)].map(key => replacements.get(key)!);
  return { ...input, session, ...(project ? { project } : {}), ...(templates ? { templates } : {}), userAssets: [...input.userAssets, ...extra] };
}
