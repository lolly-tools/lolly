// SPDX-License-Identifier: MPL-2.0
/**
 * Font asset installation and management.
 * Integrates with host.assets (IndexedDB) for offline-first storage.
 */

import { parseFontMetadata, detectFontFormat } from './font-utils.ts';
import type { FontMetadata } from './font-utils.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { debug } from './debug.ts';

export interface InstalledFont {
  id: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic' | 'oblique';
  format: string;
  fileSize: number;
  installedAt: number;
}

const FONT_REGISTRY_KEY = 'font-registry:installed';

/**
 * Install a font file as a user asset.
 * Creates user/fonts/<family-slug>/<index> asset in IndexedDB.
 */
export async function installFontAsset(
  host: HostV1,
  file: File,
  onProgress?: (percent: number) => void
): Promise<InstalledFont | null> {
  try {
    debug(`[font-install] Starting install for ${file.name}`, { size: file.size, type: file.type });

    // Read file as ArrayBuffer
    let buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as ArrayBuffer;
        debug(`[font-install] File read complete: ${file.name} (${result.byteLength} bytes)`);
        resolve(result);
      };
      reader.onerror = () => {
        console.error(`[font-install] FileReader error: ${reader.error}`);
        reject(reader.error);
      };
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 50); // 0-50% for read
        }
      };
      reader.readAsArrayBuffer(file);
    });

    // WOFF1 ('wOFF') is not an sfnt: parseFontMetadata can't read its table directory
    // and the render-time font-registry only decompresses woff2, not woff1 - so a WOFF1
    // upload was broken end to end. Unwrap it to a plain TTF/OTF here, once, so every
    // downstream reader sees an sfnt. woff2 is left as-is (font-registry decompresses it
    // on demand); woffToSfnt throws on woff2, so the 'woff' gate never routes it here.
    if (detectFontFormat(buffer) === 'woff') {
      try {
        const { woffToSfnt } = await import('@lolly/engine');
        const sfnt = woffToSfnt(new Uint8Array(buffer));
        buffer = sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength) as ArrayBuffer;
      } catch (e) {
        console.warn('[font-install] WOFF1->sfnt conversion failed', e);
        return null;
      }
    }

    // Parse metadata
    const metadata = parseFontMetadata(buffer);
    if (!metadata) {
      console.warn(`[font-install] Could not extract metadata from ${file.name}`);
      return null;
    }
    debug(`[font-install] Metadata extracted: ${metadata.family} ${metadata.weight}${metadata.style}`);

    const format = detectFontFormat(buffer);
    debug(`[font-install] Detected format: ${format}`);

    const familySlug = metadata.family.toLowerCase().replace(/\s+/g, '-');
    debug(`[font-install] Family slug: ${familySlug}`);

    // Load font registry to find next index
    if (!host.state || !host.state.load || !host.state.save) {
      console.error('[font-install] host.state is not available');
      return null;
    }

    const registry = (await host.state.load(FONT_REGISTRY_KEY)) as Record<string, number> | null;
    const fontIndexMap = registry || {};
    const nextIndex = (fontIndexMap[familySlug] || 0) + 1;
    debug(`[font-install] Asset index: ${nextIndex}`);

    // Create asset ID
    const assetId = `user/fonts/${familySlug}/${nextIndex}`;
    debug(`[font-install] Asset ID: ${assetId}`);

    // Store blob
    const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
    onProgress?.(75);

    // Create asset record
    const asset = {
      id: assetId,
      type: 'font' as const,
      version: '1.0.0',
      tier: 'on-demand' as const,
      formats: [
        {
          format: format,
          url: URL.createObjectURL(blob),
          checksum: await sha256(buffer),
        },
      ],
      meta: {
        family: metadata.family,
        weight: metadata.weight,
        style: metadata.style,
        fileName: file.name,
        installedAt: Date.now(),
      },
    };

    // Save to IndexedDB via host.state
    debug(`[font-install] Saving font data to state...`);
    await host.state.save('font-asset:' + assetId, {
      blob,
      metadata: asset.meta,
      format,
      fileSize: buffer.byteLength,
    });
    debug(`[font-install] ✓ Font data saved`);

    // Update the font registry
    debug(`[font-install] Updating font registry...`);
    fontIndexMap[familySlug] = nextIndex;
    await host.state.save(FONT_REGISTRY_KEY, fontIndexMap);
    debug(`[font-install] ✓ Font registry updated`);

    onProgress?.(100);

    const result = {
      id: assetId,
      family: metadata.family,
      weight: metadata.weight,
      style: metadata.style,
      format: format,
      fileSize: buffer.byteLength,
      installedAt: asset.meta.installedAt,
    };
    debug(`[font-install] ✓ Font installation complete:`, result);
    return result;
  } catch (e) {
    console.error('[font-install] Font installation failed:', e instanceof Error ? e.message : e);
    if (e instanceof Error) {
      console.error('[font-install] Stack:', e.stack);
    }
    return null;
  }
}

/**
 * Get all installed fonts as user assets.
 */
export async function getInstalledFonts(host: HostV1): Promise<InstalledFont[]> {
  try {
    debug('[font-asset-handler] getInstalledFonts: reading font registry...');
    if (!host.state || !host.state.load) {
      console.warn('[font-asset-handler] host.state not available');
      return [];
    }

    // Read font registry
    const registry = (await host.state.load(FONT_REGISTRY_KEY)) as Record<string, number> | null;
    debug('[font-asset-handler] Font registry:', registry);

    if (!registry || Object.keys(registry).length === 0) {
      debug('[font-asset-handler] No fonts in registry');
      return [];
    }

    const fonts: InstalledFont[] = [];

    // For each family in the registry, load its font data
    for (const [familySlug, lastIndex] of Object.entries(registry)) {
      for (let i = 0; i <= lastIndex; i++) {
        const assetId = `user/fonts/${familySlug}/${i}`;
        debug('[font-asset-handler] Loading font asset:', assetId);

        const stored = (await host.state.load('font-asset:' + assetId)) as
          | { metadata: FontMetadata & { installedAt: number }; format: string; fileSize: number }
          | null
          | undefined;

        if (stored?.metadata) {
          debug('[font-asset-handler] ✓ Loaded', assetId);
          fonts.push({
            id: assetId,
            family: stored.metadata.family,
            weight: stored.metadata.weight,
            style: stored.metadata.style,
            format: stored.format,
            fileSize: stored.fileSize,
            installedAt: stored.metadata.installedAt,
          });
        } else {
          debug('[font-asset-handler] Not found:', assetId);
        }
      }
    }

    debug('[font-asset-handler] Returning', fonts.length, 'fonts:', fonts);
    return fonts.sort((a, b) => a.family.localeCompare(b.family));
  } catch (e) {
    console.error('[font-asset-handler] getInstalledFonts error:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Remove a font asset.
 */
export async function removeFontAsset(host: HostV1, fontId: string): Promise<boolean> {
  try {
    debug('[font-asset-handler] Removing font:', fontId);
    if (!host.state || !host.state.delete || !host.state.load || !host.state.save) {
      console.error('[font-asset-handler] host.state APIs not available');
      return false;
    }

    // Remove from state
    await host.state.delete('font-asset:' + fontId);
    debug('[font-asset-handler] ✓ Font data deleted');

    // Update registry (optional cleanup - keep it simple for now)
    // The registry still has the entry, but the data is gone
    // This is fine for now as we check if stored?.metadata exists

    return true;
  } catch (e) {
    console.error('[font-asset-handler] removeFontAsset error:', e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Bust the font registry cache and re-register all fonts.
 * Call after installing/removing fonts.
 */
export async function refreshFontRegistry(host: HostV1): Promise<void> {
  try {
    // Dispatch custom event for UI reactivity
    window.dispatchEvent(new CustomEvent('lolly:fonts-refreshing'));

    // Re-registering installed fonts (e.g. re-applying @font-face rules) is left to
    // the caller listening for the events below - there's no host.fonts capability
    // on the bridge (no such API is declared on HostV1).

    // Emit success event
    window.dispatchEvent(
      new CustomEvent('lolly:fonts-refreshed', {
        detail: { timestamp: Date.now() },
      })
    );
  } catch (e) {
    console.error('Font registry refresh failed:', e);
    window.dispatchEvent(
      new CustomEvent('lolly:fonts-refresh-error', {
        detail: { error: String(e) },
      })
    );
  }
}

/**
 * Minimal SHA256 for file checksums (using SubtleCrypto).
 */
async function sha256(buffer: ArrayBuffer): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unknown';
  }
}
