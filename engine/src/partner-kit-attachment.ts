// SPDX-License-Identifier: MPL-2.0
/**
 * A partner kit attachment, read from any untrusted value (plans/82 M8). A leaf
 * with no engine imports: the export record (metadata.ts) reads attachments on
 * the web shell's boot path, where url-mode.ts and its graph must not load.
 * url-mode.ts re-exports it for the `_kit` param.
 */
import { PARTNER_KIT_ASSET_ID_PATTERN, PARTNER_KIT_MAX_ASSET_ID, PARTNER_KIT_MAX_LOGO_VERSION, type PartnerKitAttachmentV1 } from '@lolly-tools/core/partner-kit-v1';

const PARTNER_KIT_ID = new RegExp(PARTNER_KIT_ASSET_ID_PATTERN);

/**
 * A partner kit attachment from a saved session's `__partnerKit` or any other untrusted
 * value: a catalog asset id in the kit grammar and a whole revision from 1. Anything
 * else is null, so a malformed record attaches nothing rather than a guess.
 */
export function readPartnerKitAttachment(value: unknown): PartnerKitAttachmentV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  // Own fields only: an inherited `id` or `revision` is not the record's.
  if (!Object.hasOwn(value, 'id') || !Object.hasOwn(value, 'revision')) return null;
  const { id, revision } = value as Record<string, unknown>;
  if (typeof id !== 'string' || id.length > PARTNER_KIT_MAX_ASSET_ID || !PARTNER_KIT_ID.test(id)) return null;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1 || revision > PARTNER_KIT_MAX_LOGO_VERSION) return null;
  return { id, revision };
}
