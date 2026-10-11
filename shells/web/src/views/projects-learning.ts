// SPDX-License-Identifier: MPL-2.0
import type { Folder } from '../folders.ts';
import type { PickerHost } from './picker.ts';
import { learningEnabled } from '../lib/learning-feature.ts';

interface ProjectCourseSelection {
  kind?: string;
  ref?: string;
  folderId: string | null;
  folders: Folder[];
  uncategorised: () => Array<{ slot: string }>;
  selectedByKind: (kind: 'session' | 'image') => string[];
  topLevelSelectedFolders: () => string[];
}

export async function exportProjectCourse(host: PickerHost, selection: ProjectCourseSelection, closeMenu: () => void): Promise<void> {
  if (!learningEnabled()) return;
  closeMenu();
  const { kind, ref, folderId, folders } = selection;
  const { startLearningCourse } = await import('../lib/learning-entry.ts');
  const id = kind === 'folder' ? ref : folderId;
  const folder = folders.find(f => f.id === id);
  await startLearningCourse(host, {
    title: kind === 'folder' ? folder?.name || 'Learning module' : undefined,
    projectId: folder?.id,
    folders,
    folderIds: kind === 'folder' ? (ref === '__uncat__' ? [] : [ref!]) : kind ? [] : selection.topLevelSelectedFolders(),
    sessionRefs: kind === 'session' ? [ref!] : kind === 'folder' ? (ref === '__uncat__' ? selection.uncategorised().map(e => e.slot) : []) : kind ? [] : selection.selectedByKind('session'),
    assetRefs: kind === 'image' ? [ref!] : kind ? [] : selection.selectedByKind('image'),
  });
}
