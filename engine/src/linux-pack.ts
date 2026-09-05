// SPDX-License-Identifier: MPL-2.0
/**
 * linux-pack.ts - the content-aware layer over `rpm.ts`. Given a pack TYPE and the
 * source assets, it lays files at the idiomatic install paths, wires the right
 * header scriptlets and dependencies, and hands a finished file list to `buildRpm`.
 * This is where the "make a GOOD font / app-icon package" knowledge lives, so
 * `rpm.ts` stays a pure container writer and the CLI / macros / tools all get the
 * same guideline-clean output.
 *
 * M2 targets (plan 197, D1): `font` and `app-icons` done well, plus a `generic`
 * escape hatch. Wallpapers, icon themes and AppStream come in later milestones.
 *
 * Hermetic + deterministic: no rasterisation, no network, no wall clock. A font
 * package is a pass-through of the caller's font bytes; an app-icon package ships
 * the caller's scalable SVG (see icon-set.ts). So a build root with no network -
 * an OBS build - can produce these, which is the whole packager thesis.
 */

import { buildRpm, type RpmMeta, type RpmFileEntry } from './rpm.ts';
import { planIconSet, type IconSource } from './icon-set.ts';
import { fontMetainfo, metainfoPath } from './appstream.ts';
import { packTar } from './tar.ts';
import { gzip } from './gzip.ts';

export type PackType = 'font' | 'app-icons' | 'generic';

/** One font file to install (its basename + bytes). */
export interface FontFile { name: string; data: Uint8Array }
/** One `.desktop` entry to install at /usr/share/applications/<id>.desktop. */
export interface DesktopEntry { id: string; data: Uint8Array }

export interface LinuxPackSpec {
  type: PackType;
  /** Package metadata. `linux-pack` adds the type's Requires + scriptlets; a
   *  caller-supplied `requires`/scriptlet is preserved and merged. */
  meta: RpmMeta;
  /** type 'font': the font files. */
  fonts?: FontFile[];
  /** type 'font': install subdir under /usr/share/fonts. Default = slug(name). */
  foundry?: string;
  /** type 'font': also ship AppStream MetaInfo so the pack appears in the software
   *  centre. name/summary/licence/url/version are taken from `meta`; supply the
   *  AppStream id and the font families here. */
  appstream?: { id: string; fontFamilies: string[]; metadataLicense?: string; description?: string[] };
  /** type 'app-icons': the icons (scalable SVG + optional symbolic/rasters). */
  icons?: IconSource[];
  /** type 'app-icons': optional desktop entries. */
  desktopEntries?: DesktopEntry[];
  /** type 'generic': files at absolute install paths, verbatim. */
  files?: RpmFileEntry[];
}

const FONTS_DIR = '/usr/share/fonts';
const APPS_DIR = '/usr/share/applications';

/**
 * Pack files into a reproducible `.tar.gz` - the no-root "extract into your home"
 * variant (plan 197 section 6). Any leading "/" is stripped so the archive
 * extracts relative to wherever the user unpacks it (e.g. into ~/.local/share).
 */
export function buildHomeTarball(members: { path: string; data: Uint8Array }[]): Uint8Array {
  return gzip(packTar(members.map((m) => ({ name: m.path.replace(/^\/+/, ''), data: m.data }))));
}

/**
 * Wrap one rendered artefact as a single-file noarch RPM at `dest/filename` - the
 * `format=rpm` release-manager path (plan 197 section 3.2). Shared by the web and
 * CLI export bridges so both emit identical bytes.
 */
export function packageRender(opts: { bytes: Uint8Array; filename: string; dest: string; meta: RpmMeta }): Promise<Uint8Array> {
  const dir = opts.dest.replace(/\/+$/, '');
  return buildRpm({ meta: opts.meta, files: [{ path: `${dir}/${opts.filename}`, data: opts.bytes }] });
}

/** Lowercase, keep [a-z0-9._-], collapse the rest to "-". */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'pack';
}

/** Guarded fc-cache refresh for `dir` - a no-op where fontconfig is absent. */
function fcCacheScriptlet(dir: string): string {
  return `if [ -x /usr/bin/fc-cache ]; then\n  /usr/bin/fc-cache -f ${dir} 2>/dev/null || :\nfi`;
}

/** Merge type-derived Requires + scriptlets into a copy of the caller's meta. */
function withPackaging(meta: RpmMeta, requires: string[], scriptlet?: string): RpmMeta {
  const merged: RpmMeta = {
    ...meta,
    requires: [...(meta.requires ?? []), ...requires.map((name) => ({ name }))],
  };
  if (scriptlet) {
    merged.postin = meta.postin ? `${meta.postin}\n${scriptlet}` : scriptlet;
    merged.postun = meta.postun ? `${meta.postun}\n${scriptlet}` : scriptlet;
  }
  return merged;
}

/**
 * Build a noarch RPM for a font / app-icon / generic pack. Deterministic + hermetic.
 */
export function buildLinuxPack(spec: LinuxPackSpec): Promise<Uint8Array> {
  switch (spec.type) {
    case 'font': {
      const fonts = spec.fonts ?? [];
      if (fonts.length === 0) throw new Error('buildLinuxPack: font pack has no fonts');
      const foundry = slug(spec.foundry ?? spec.meta.name);
      const dir = `${FONTS_DIR}/${foundry}`;
      const files: RpmFileEntry[] = [
        { path: dir, isDir: true }, // own the subdir we create
        ...fonts.map((f) => ({ path: `${dir}/${f.name}`, data: f.data })),
      ];
      if (spec.appstream) {
        const a = spec.appstream;
        const xml = fontMetainfo({
          id: a.id,
          name: spec.meta.summary || spec.meta.name,
          summary: spec.meta.summary || spec.meta.name,
          description: a.description,
          fontFamilies: a.fontFamilies,
          projectLicense: spec.meta.license,
          metadataLicense: a.metadataLicense,
          developerName: spec.meta.vendor,
          url: spec.meta.url,
          version: spec.meta.version,
          epoch: spec.meta.buildEpoch,
        });
        files.push({ path: metainfoPath(a.id), data: new TextEncoder().encode(xml) });
      }
      const meta = withPackaging(spec.meta, ['fontconfig'], fcCacheScriptlet(dir));
      return buildRpm({ meta, files });
    }
    case 'app-icons': {
      const icons = spec.icons ?? [];
      if (icons.length === 0) throw new Error('buildLinuxPack: app-icons pack has no icons');
      const plan = planIconSet(icons);
      const files: RpmFileEntry[] = plan.files.map((f) => ({ path: f.path, data: f.data }));
      for (const d of spec.desktopEntries ?? []) {
        files.push({ path: `${APPS_DIR}/${d.id}.desktop`, data: d.data });
      }
      const meta = withPackaging(spec.meta, plan.requires, plan.scriptlet);
      return buildRpm({ meta, files });
    }
    case 'generic': {
      const files = spec.files ?? [];
      if (files.length === 0) throw new Error('buildLinuxPack: generic pack has no files');
      return buildRpm({ meta: spec.meta, files });
    }
    default: {
      const bad: never = spec.type;
      throw new Error(`buildLinuxPack: unknown pack type ${String(bad)}`);
    }
  }
}
