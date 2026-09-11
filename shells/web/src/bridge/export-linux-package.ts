// SPDX-License-Identifier: MPL-2.0

/** Options consumed by the Linux package wrapper. Kept narrower than ExportOpts
 * so this leaf module does not import the main exporter back and create a cycle. */
export interface LinuxPackageExportOptions {
  filename?: string;
  pkg?: {
    name?: string;
    version?: string;
    release?: string;
    license?: string;
    summary?: string;
    dest?: string;
    innerFormat?: string;
  };
}

type InnerRenderer = (node: Element, format: string) => Promise<Blob>;

/**
 * Seal files a tool holds into a Linux package and RETURN the bytes (.rpm or
 * .tar.gz) - plan 197 M5. The tool's exportFile hook returns these, and the shell
 * delivers them via export.file (the normal download path). Like file(), this
 * NEVER watermarks or embeds provenance; the RPM header carries only honest
 * packaging metadata. The engine owns the format. Mirrors the CLI bridge's pack().
 */
export async function buildExportPack(spec: import('@lolly-tools/core').ExportPackSpec): Promise<Uint8Array> {
  const { buildLinuxPack, buildHomeTarball } = await import('@lolly/engine');
  if (spec.target === 'tar.gz') return buildHomeTarball(spec.files ?? []);
  return buildLinuxPack({
    type: spec.type,
    meta: { ...spec.meta },
    ...(spec.fonts ? { fonts: spec.fonts } : {}),
    ...(spec.foundry ? { foundry: spec.foundry } : {}),
    ...(spec.appstream ? { appstream: spec.appstream } : {}),
    ...(spec.icons ? { icons: spec.icons } : {}),
    ...(spec.files ? { files: spec.files } : {}),
  });
}

/** Render one artefact, then wrap it as an RPM or no-root home tarball. */
export async function renderLinuxPackage(
  node: Element,
  format: 'rpm' | 'tar.gz',
  opts: LinuxPackageExportOptions,
  renderInner: InnerRenderer,
): Promise<Blob> {
  const pkg = opts.pkg ?? {};
  const base = (opts.filename || pkg.name || 'export').replace(/\.[a-z0-9.]+$/i, '') || 'export';
  const inner = pkg.innerFormat || 'svg';
  const innerBlob = await renderInner(node, inner);
  const bytes = new Uint8Array(await innerBlob.arrayBuffer());
  const filename = `${base}.${inner}`;

  if (format === 'tar.gz') {
    const { buildHomeTarball } = await import('@lolly/engine');
    const dir = (pkg.dest || `.local/share/${pkg.name || base}`).replace(/^\/+|\/+$/g, '');
    return new Blob([buildHomeTarball([{ path: `${dir}/${filename}`, data: bytes }]) as BlobPart], {
      type: 'application/gzip',
    });
  }

  const { packageRender } = await import('@lolly/engine');
  const name = pkg.name || base;
  const meta = {
    name,
    version: pkg.version || '1.0',
    release: pkg.release || '1',
    summary: pkg.summary || `${name} packaged by Lolly`,
    license: pkg.license || 'LicenseRef-unspecified',
    vendor: 'Lolly',
    url: 'https://lolly.tools',
  };
  const dest = pkg.dest || `/usr/share/${name}`;
  return new Blob([await packageRender({ bytes, filename, dest, meta }) as BlobPart], {
    type: 'application/x-rpm',
  });
}
