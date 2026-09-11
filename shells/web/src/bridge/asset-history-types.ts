// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';

/** Storage shapes shared by asset retention and local revision inspection. */
export interface VersionedUserAsset { id: string; type: AssetRef['type']; format: string; version?: string; blob?: Blob; checksum?: string; meta?: Record<string, unknown>; credential?: Uint8Array; credentialFormat?: string }
export interface UserAssetVersion { assetId: string; version: string; savedAt: number; sha256: string; bytes: number; record: VersionedUserAsset }
