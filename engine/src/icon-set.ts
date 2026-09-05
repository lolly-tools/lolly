// SPDX-License-Identifier: MPL-2.0
/**
 * icon-set.ts - plan a freedesktop hicolor icon theme layout from source icons.
 * The single most common media chore a packager repeats: turn an app's SVG into
 * the `/usr/share/icons/hicolor/...` tree, wire the icon-cache scriptlets, and
 * declare the `hicolor-icon-theme` dependency. `linux-pack.ts` feeds the result
 * to `rpm.ts`; the `lolly icons` CLI verb is the packager's entry point.
 *
 * PURE + hermetic: this module does NOT rasterise. A scalable SVG installed at
 * `scalable/apps/<id>.svg` is a complete, GTK-renderable icon on its own, so the
 * default output needs no renderer and is trivially reproducible + offline. A
 * caller that wants a raster ladder (16..256 PNG) renders those itself (the shell
 * owns the rasteriser) and passes them in as `rasters`; this module only places
 * bytes at the correct hicolor paths.
 *
 * The hicolor base directories (`/usr/share/icons/hicolor`, its size subdirs and
 * `index.theme`) are owned by the `hicolor-icon-theme` package, so we never own
 * those directories ourselves. We also do NOT emit `Requires: hicolor-icon-theme`:
 * on modern RPM distros a file trigger (shipped by hicolor-icon-theme / gtk)
 * rebuilds the icon cache automatically when icons appear under that tree, and
 * openSUSE's rpmlint actively flags an unversioned require on a `*-theme` package
 * (`branding-requires-unversioned`). We still ship a guarded `gtk-update-icon-cache`
 * scriptlet as a belt-and-braces refresh for any distro without the trigger; it is
 * a no-op where the tool is absent, so it never fails a transaction.
 */

const HICOLOR = '/usr/share/icons/hicolor';

/** One icon to place, by its freedesktop icon name (the `.desktop` Icon= value). */
export interface IconSource {
  /** Icon name / id, e.g. "org.acme.App". Becomes the filename stem. */
  id: string;
  /** Scalable source (installed at scalable/apps/<id>.svg). */
  svg?: Uint8Array;
  /** Optional symbolic variant (installed at symbolic/apps/<id>-symbolic.svg). */
  symbolicSvg?: Uint8Array;
  /** Optional pre-rendered rasters (the caller's renderer produced these). */
  rasters?: { size: number; png: Uint8Array }[];
}

/** A file to install: absolute path + bytes. */
export interface IconFile { path: string; data: Uint8Array }

/** The planned layout + the packaging metadata a hicolor icon theme needs. */
export interface IconSetPlan {
  files: IconFile[];
  /** Extra Requires. Empty by design: the icon cache is handled by a distro file
   *  trigger, and an explicit `hicolor-icon-theme` require is rpmlint-flagged. */
  requires: string[];
  /** %post / %postun body that refreshes the GTK icon cache (guarded). */
  scriptlet: string;
}

/** The guarded icon-cache refresh, correct on any distro (no-op where absent). */
const ICON_CACHE_SCRIPTLET =
  `if [ -x /usr/bin/gtk-update-icon-cache ]; then\n` +
  `  /usr/bin/gtk-update-icon-cache --quiet --force ${HICOLOR} 2>/dev/null || :\n` +
  `fi`;

/**
 * Plan the hicolor layout for `icons`. Each icon contributes its scalable SVG
 * (if given), a symbolic SVG (if given), and any pre-rendered rasters, placed at
 * their canonical hicolor paths under `apps/`. Throws if an icon supplies no
 * artwork at all.
 */
export function planIconSet(icons: IconSource[]): IconSetPlan {
  const files: IconFile[] = [];
  for (const icon of icons) {
    let any = false;
    if (icon.svg) {
      files.push({ path: `${HICOLOR}/scalable/apps/${icon.id}.svg`, data: icon.svg });
      any = true;
    }
    if (icon.symbolicSvg) {
      files.push({ path: `${HICOLOR}/symbolic/apps/${icon.id}-symbolic.svg`, data: icon.symbolicSvg });
      any = true;
    }
    for (const r of icon.rasters ?? []) {
      files.push({ path: `${HICOLOR}/${r.size}x${r.size}/apps/${icon.id}.png`, data: r.png });
      any = true;
    }
    if (!any) throw new Error(`planIconSet: icon "${icon.id}" has no svg, symbolicSvg or rasters`);
  }
  return { files, requires: [], scriptlet: ICON_CACHE_SCRIPTLET };
}
