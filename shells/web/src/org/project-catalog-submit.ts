// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { CatalogSubmitSubject } from '../lib/catalog-submit.ts';
import type { TeamFile } from './team-files.ts';

export function projectFileSubject(projectId: string, file: Pick<TeamFile, 'id' | 'name' | 'checksum'>): CatalogSubmitSubject {
  return { kind: 'upload', ref: `project:${projectId}:${file.id}:${file.checksum}`, name: file.name,
    projectFile: { projectId, fileId: file.id, checksum: file.checksum }, body: async () => new Blob() };
}

export function projectRefSubject(ref: AssetRef): CatalogSubmitSubject | null {
  const projectId = ref.meta?.projectId, fileId = ref.meta?.projectFileId, checksum = ref.meta?.projectChecksum;
  return typeof projectId === 'string' && typeof fileId === 'string' && typeof checksum === 'string'
    ? projectFileSubject(projectId, { id: fileId, name: String(ref.meta?.name ?? fileId), checksum }) : null;
}
