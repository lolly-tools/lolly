// SPDX-License-Identifier: MPL-2.0
/** Presentation copy for browser-only Design audit findings.
 *
 * The audit stays renderer-focused and carries an English fallback plus structured
 * evidence. The web shell owns translation, just as export-preflight does for the
 * engine's portable findings. Keeping the literal source strings here also makes
 * them discoverable by scripts/translate.ts.
 */
import { tRaw } from '../i18n.ts';
import type { MountedDesignFinding } from './design-mounted-audit.ts';

export function mountedDesignFindingMessage(finding: MountedDesignFinding): string {
  const { name, reason, ratio, minimum, family } = finding.evidence;
  try {
    switch (finding.id) {
      case 'design.text.overflow':
        return tRaw('Text in “{name}” is clipped at the current size.', { name });
      case 'design.text.contrast-review':
        return reason === 'complex-background'
          ? tRaw(
              'Check “{name}” visually: its image or gradient background has no single contrast ratio.',
              { name }
            )
          : tRaw(
              'Check “{name}” visually: its rendered colours could not be reduced to one contrast ratio.',
              { name }
            );
      case 'design.text.contrast-low':
        return tRaw('“{name}” has {ratio}:1 contrast; this text needs at least {minimum}:1.', {
          name,
          ratio: ratio ?? '',
          minimum: minimum ?? '',
        });
      case 'design.font.unembeddable':
        return tRaw('“{name}” uses {family}, which cannot be embedded in vector exports.', {
          name,
          family: family ?? '',
        });
    }
  } catch {
    return finding.message;
  }
}
