// SPDX-License-Identifier: MPL-2.0
/**
 * Provider assembly (plans/99 M2/M3) - the one place the default provider set
 * is registered. Called once by the spotlight overlay's init. Each provider
 * module declares its own minimal structural host slice (the repo convention - 
 * see SyncHost/GalleryHost) so this file stays type-light.
 */
import { registerProvider } from '../registry.ts';
import { createToolsProvider, createUtilitiesProvider } from './tools.ts';
import { createProjectsProvider } from './projects.ts';
import { createCatalogProvider } from './catalog.ts';
import { createSettingsProvider } from './settings.ts';
import { createDocsProvider } from './docs.ts';
import { createAskProvider } from './ask.ts';

export function registerDefaultProviders(host: unknown): void {
  registerProvider(createToolsProvider());
  registerProvider(createUtilitiesProvider());
  registerProvider(createProjectsProvider(host as Parameters<typeof createProjectsProvider>[0]));
  registerProvider(createCatalogProvider(host as Parameters<typeof createCatalogProvider>[0]));
  registerProvider(createSettingsProvider());
  registerProvider(createDocsProvider());
  registerProvider(createAskProvider());
}
