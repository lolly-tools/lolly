// SPDX-License-Identifier: MPL-2.0
/** Capture a session's files and appearance for a portable restricted tool. */
import type { HostV1, AssetRef } from '@lolly-tools/core/host-v1';
import type { DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import {
  compileSessionTool,
  type SessionToolSource,
} from '../../../../engine/src/design-tool/session-compiler.ts';
import { resolveToolBundle } from './tool-bundle.ts';
import { resolveVectorFont } from '../bridge/font-registry.ts';
import { readFontEmbedding } from './font-utils.ts';
import { designDigest } from './design-tool-compile.ts';
import { redistribution } from './redistribution.ts';
import { exportFontFamily } from '../bridge/fallback-font-source.ts';

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function prepareSessionTool(
  draft: DesignToolDraftV1,
  tool: LoadedTool,
  runtime: Runtime,
  canvas: HTMLElement,
  host: HostV1,
  options: { signal?: AbortSignal; include?: ReadonlySet<string> } = {}
) {
  options.signal?.throwIfAborted();
  const bundle = await resolveToolBundle(tool.manifest.id, tool.manifest);
  if (!bundle)
    throw new Error('The source tool files could not be read. Reopen the source and try again.');
  const bundleFiles: Record<string, Uint8Array> = Object.fromEntries(
    await Promise.all(
      Object.entries(bundle.files).map(async ([path, value]) => [
        path,
        value instanceof Blob ? new Uint8Array(await value.arrayBuffer()) : value,
      ] as const)
    )
  );
  const files: Record<string, Uint8Array> = {};
  const dependencies: SessionToolSource['dependencies'] = [];
  const refs: Record<string, AssetRef> = {};
  const add = async (bytes: Uint8Array, mime: string, credit?: string) => {
    const digest = await designDigest(bytes);
    const path = `assets/${digest}.${mime.includes('font') ? 'ttf' : mime.includes('svg') ? 'svg' : 'bin'}`;
    if (!files[path]) {
      files[path] = bytes;
      dependencies.push({ path, digest, ...(credit ? { credit } : {}) });
    }
    return dataUrl(bytes, mime);
  };
  const embed = async (ref: AssetRef): Promise<AssetRef> => {
    if (refs[ref.id]) return refs[ref.id]!;
    if (!ref.url) throw new Error(`Add the missing image: ${ref.id}`);
    const rights = redistribution(ref.meta || {});
    if (
      !ref.id.startsWith('user/') &&
      !ref.id.startsWith('embedded-') &&
      !rights.travels &&
      !options.include?.has(ref.id)
    )
      throw new Error('Review the source image’s inclusion rights before sharing.');
    const response = await fetch(ref.url, { signal: options.signal });
    if (!response.ok) throw new Error('A source image could not be read.');
    const blob = await response.blob();
    if (!/^image\/(png|jpeg|webp|avif|svg\+xml)$/.test(blob.type))
      throw new Error('Use still images in a reusable tool.');
    if (blob.type === 'image/svg+xml') {
      const svg = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
      if (svg.querySelector('parsererror,script,foreignObject,text,animate,animateTransform,set'))
        throw new Error('Outline SVG text and freeze animation before including this image.');
      for (const node of svg.querySelectorAll('*'))
        for (const attr of node.attributes)
          if (
            /^on/i.test(attr.name) ||
            (/href$/i.test(attr.name) && !/^(#|data:image\/)/.test(attr.value)) ||
            /url\(\s*["']?(?!#)/i.test(attr.value)
          )
            throw new Error('Embed the SVG’s linked images before sharing.');
    }
    const url = await add(
      new Uint8Array(await blob.arrayBuffer()),
      blob.type,
      [String(ref.meta?.credit || ref.meta?.name || ref.id), rights.licence, ...rights.notices]
        .filter(Boolean)
        .join('\n')
    );
    const next = { ...ref, url, original: undefined, pin: undefined, meta: { ...ref.meta, baked: true, bakedAt: 0 } };
    delete (next.meta as Record<string, unknown>).toolUrl;
    refs[ref.id] = next;
    return next;
  };
  const portable = async (value: unknown): Promise<unknown> => {
    if (!value || typeof value !== 'object') return value;
    if ('bytes' in value || value instanceof Blob || ArrayBuffer.isView(value))
      throw new Error('File inputs must be replaced with still artwork before sharing.');
    if ('id' in value && 'url' in value) return embed(value as AssetRef);
    if ('ref' in value && 'value' in value) return portable(value.value);
    if (Array.isArray(value)) return Promise.all(value.map(portable));
    return Object.fromEntries(
      await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await portable(v)]))
    );
  };
  const model = (await Promise.all(
    runtime.getModel().map(async (item) => ({ ...item, value: await portable(item.value) }))
  )) as SessionToolSource['model'];
  const copy = structuredClone(draft);
  for (const field of copy.inputs)
    field.input.default = (await portable(field.input.default)) as typeof field.input.default;
  const sourceStyle = getComputedStyle(canvas);
  let css = '';
  const fontFamilies = new Map<string, string>();
  const faces = new Set<string>();
  for (const node of [canvas, ...canvas.querySelectorAll<HTMLElement>('*')]) {
    if (
      node !== canvas &&
      ![...node.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
    )
      continue;
    const style = getComputedStyle(node);
    const key = `${style.fontFamily}/${style.fontWeight}/${style.fontStyle}`;
    if (faces.has(key)) continue;
    const face = await resolveVectorFont(
      style,
      `${node.textContent}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`
    );
    if (!face || face.fallbacks?.length)
      throw new Error('Add a complete font for this session before sharing.');
    const response = await fetch(face.url, { signal: options.signal });
    if (!response.ok) throw new Error('The source font could not be read.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const permission = readFontEmbedding(bytes.slice().buffer);
    if (!['installable', 'editable'].includes(permission.permission) || permission.bitmapOnly)
      throw new Error('Choose a font that permits embedding for editing.');
    const family =
      fontFamilies.get(style.fontFamily) ||
      `LollyFont${(await designDigest(new TextEncoder().encode(`${copy.id}/${style.fontFamily}`))).slice(0, 16)}`;
    fontFamilies.set(style.fontFamily, family);
    faces.add(key);
    const url = await add(
      bytes,
      'font/ttf',
      `${face.face?.family || style.fontFamily}: embedded font for editable artwork.`
    );
    css += `@font-face{font-family:'${family}';src:url('${url}');font-weight:${face.face?.weight || style.fontWeight};font-style:${style.fontStyle};}\n`;
  }
  const rootDeclarations = [
    `font-family:${fontFamilies.get(sourceStyle.fontFamily) || exportFontFamily(sourceStyle.fontFamily)}`,
    `color:${sourceStyle.color}`,
  ];
  const sourceText = `${tool.styles || ''}\n${tool.template}\n${tool.hooksSource || ''}`;
  const variables = new Set([...sourceText.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!));
  for (const name of ['--font-brand', '--font-mono', '--font-display']) variables.add(name);
  for (const name of variables) {
    // The live page's own fallback families exist only on this page (fallback-font-source.ts).
    let value = exportFontFamily(sourceStyle.getPropertyValue(name).trim());
    if (!value) continue;
    if (/[{}<>]|url\(/i.test(value)) throw new Error('Resolve linked style assets before sharing.');
    for (const nested of value.matchAll(/var\(\s*(--[\w-]+)/g)) variables.add(nested[1]!);
    for (const [original, family] of fontFamilies)
      if (
        value === original ||
        original.split(',')[0]!.replace(/['"]/g, '').trim() === value.replace(/['"]/g, '').trim()
      )
        value = `'${family}'`;
    rootDeclarations.push(`${name}:${value}`);
  }
  css += `.lolly-locked-design{${rootDeclarations.join(';')}}`;
  let template = tool.template,
    styles = tool.styles || '',
    hooks = tool.hooksSource || '';
  for (const [original, family] of fontFamilies) {
    const name = original.split(',')[0]!.trim().replace(/['"]/g, '');
    if (name.length < 2) continue;
    const replace = (s: string) =>
      s
        .replaceAll(`font-family:${name}`, `font-family:'${family}'`)
        .replaceAll(`font-family: ${name}`, `font-family: '${family}'`)
        .replaceAll(`font-family="${name}"`, `font-family="${family}"`);
    template = replace(template);
    styles = replace(styles);
    hooks = replace(hooks);
  }
  for (const [path, bytes] of Object.entries(bundleFiles))
    if (!['tool.json', 'hooks.js', 'template.html', 'styles.css'].includes(path)) {
      files[path] = bytes;
      dependencies.push({
        path,
        digest: await designDigest(bytes),
        ...(/licen[cs]e|notice|copying/i.test(path)
          ? { credit: new TextDecoder().decode(bytes) }
          : {}),
      });
    }
  // Resolve literal tool-local URLs into the package, including CSS image URLs.
  for (const [path, bytes] of Object.entries(bundleFiles)) {
    if (!/\.(png|jpe?g|webp|svg|woff2?|ttf|otf)$/i.test(path)) continue;
    const ext = path.split('.').pop()!.toLowerCase();
    const mime =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'jpg'
          ? 'image/jpeg'
          : ['woff', 'woff2', 'ttf', 'otf'].includes(ext)
            ? `font/${ext}`
            : `image/${ext}`;
    const uri = dataUrl(bytes, mime);
    for (const url of [`/tools/${tool.manifest.id}/${path}`, `./${path}`]) {
      template = template.replaceAll(url, uri);
      styles = styles.replaceAll(url, uri);
      hooks = hooks.replaceAll(url, uri);
    }
  }
  const tokenSet = await host.tokens?.get();
  const tokens = {
    entries: tokenSet?.query() || [],
    colors: (await host.tokens?.colors()) || [],
    themes: (await host.tokens?.themes()) || [],
    active: (await host.tokens?.active?.()) || null,
  };
  options.signal?.throwIfAborted();
  return compileSessionTool(
    copy,
    {
      manifest: tool.manifest,
      model,
      template,
      hooks,
      styles,
      css,
      assets: refs,
      tokens,
      dependencies,
    },
    files
  );
}

/** Inclusion review also covers assets held in the source's fixed inputs. */
export async function sessionToolRights(
  runtime: Runtime
): Promise<Array<{ id: string; name: string; reason: string }>> {
  const held = new Map<string, { id: string; name: string; reason: string }>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if ('id' in value && 'url' in value) {
      const ref = value as AssetRef;
      if (ref.id.startsWith('user/') || ref.id.startsWith('embedded-')) return;
      const rights = redistribution(ref.meta || {});
      if (!rights.travels)
        held.set(ref.id, {
          id: ref.id,
          name: String(ref.meta?.name || ref.id),
          reason: rights.reason,
        });
      return;
    }
    for (const item of Object.values(value)) visit(item);
  };
  runtime.getModel().forEach((item) => { visit(item.value); });
  return [...held.values()];
}
