// SPDX-License-Identifier: MPL-2.0
/**
 * list-event.ts - the event a view that lists design systems listens for.
 *
 * A module of its own with no imports: companions.ts is loaded by the catalog
 * sync, so naming the event in switch.ts would close an import cycle back to
 * catalog/sync.ts.
 */

/** Fired on `window` when systems are added to the list without a switch: the
 *  catalog's companions, seeded after the first sync (companions.ts). A view that
 *  lists systems reads the list again; the active system is unchanged. */
export const DESIGN_SYSTEMS_LISTED_EVENT = 'lolly:design-systems-listed';
