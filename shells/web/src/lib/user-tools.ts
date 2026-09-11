// SPDX-License-Identifier: MPL-2.0
/**
 * User tools - a creative turns a saved Design doc into a reusable TOOL of their own:
 * a bit of metadata (title, description, icon, the export formats it offers) plus the
 * saved `values` that become its template. Opening the user tool is opening its base
 * tool (usually Design) seeded with those values - there is no new mount pipeline, just
 * a preconfigured start. This is the store half; the surfaces that create and list them
 * live in the save dialog and the galleries/pickers.
 *
 * A user tool is deliberately NOT a user template (lib/user-templates.ts): a template is
 * a starting point that shows up INSIDE one tool's "New from template" chooser, whereas a
 * user tool stands on its own in the tool listings, with its own name and icon. The two
 * share the profile-record storage convention and nothing else.
 *
 * Storage mirrors user-templates.ts / folders.ts exactly: the records ride the single
 * profile record (`profile.userTools`) through the host's Profile get/set, so they sync
 * and persist like everything else, and a read-modify-write over the WHOLE profile never
 * clobbers sibling fields (folders, userTemplates, headshot, a11y, …). No new storage
 * layer, no core change - the profile record already tolerates extra fields.
 */

export interface UserTool {
  id: string;
  /** Gallery/picker card title - the tool's display name. */
  title: string;
  /** Card sub-line / tooltip. */
  description?: string;
  /** Inline SVG markup for the card icon (same convention as the catalog index's inlined
   *  tool icons), or a short emoji/text glyph. Optional - the listing falls back to a
   *  generic glyph when absent. */
  icon?: string;
  /** The export formats this tool offers, mirrored from the base tool / the user's pick. */
  formats: string[];
  /** The tool this user tool is built on - opening it opens THIS tool seeded with `values`.
   *  Usually 'design' (a saved Design doc), but any tool id is valid. */
  baseToolId: string;
  /** The saved seed: input values for the base tool, i.e. what `getModel()` returns for the
   *  doc the user saved as this tool. */
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface UserToolProfile {
  userTools?: UserTool[];
  /** Shared with the host's Profile type so it satisfies this weak slice (mirrors folders). */
  custom?: Record<string, string>;
}

/** The slice of the host bridge the store reads/writes - the profile get/set pair only. */
export interface UserToolHost {
  profile: {
    get(): Promise<UserToolProfile>;
    set(profile: UserToolProfile): Promise<unknown>;
  };
}

function uuid(): string {
  if ((globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID) return crypto.randomUUID();
  return 'utool-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const now = (): string => new Date().toISOString();

export interface SaveToolInput {
  title: string;
  description?: string;
  icon?: string;
  formats?: string[];
  baseToolId: string;
  values: Record<string, unknown>;
}

export function createUserToolStore(host: UserToolHost) {
  // Read-modify-write over the whole profile object, so sibling fields survive (folders.ts).
  async function mutate<T>(fn: (list: UserTool[]) => T): Promise<T> {
    const profile = await host.profile.get();
    const list = (profile.userTools ?? []).map(t => ({ ...t }));
    const result = fn(list);
    await host.profile.set({ ...profile, userTools: list });
    return result;
  }

  return {
    /** Every user tool, newest first. */
    async list(): Promise<UserTool[]> {
      const profile = await host.profile.get();
      const all = (profile.userTools ?? []).slice();
      return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },

    /** One user tool by id, or null. */
    async get(id: string): Promise<UserTool | null> {
      const profile = await host.profile.get();
      return (profile.userTools ?? []).find(t => t.id === id) ?? null;
    },

    async save(input: SaveToolInput): Promise<UserTool> {
      const title = String(input.title ?? '').trim();
      if (!title) throw new Error('A tool name is required.');
      if (!input.baseToolId) throw new Error('A base tool id is required.');
      const tool: UserTool = {
        id: uuid(),
        title,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.icon ? { icon: input.icon } : {}),
        formats: Array.isArray(input.formats) ? input.formats.slice() : [],
        baseToolId: input.baseToolId,
        values: input.values ?? {},
        createdAt: now(),
        updatedAt: now(),
      };
      await mutate(list => list.push(tool));
      return tool;
    },

    async rename(id: string, title: string): Promise<void> {
      const label = String(title ?? '').trim();
      if (!label) throw new Error('A tool name is required.');
      await mutate(list => {
        const t = list.find(x => x.id === id);
        if (t) { t.title = label; t.updatedAt = now(); }
      });
    },

    async remove(id: string): Promise<void> {
      await mutate(list => {
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) list.splice(i, 1);
      });
    },
  };
}

export type UserToolStore = ReturnType<typeof createUserToolStore>;

/** The listing shape a gallery/picker tool entry needs, projected from a user tool. Kept
 *  here (beside the store) so every read site derives the same fields the same way. The
 *  synthetic `id` is namespaced so it can never collide with a real catalog tool id, and a
 *  reader can tell a user-tool entry apart to route its open through `baseToolId` + `values`
 *  rather than the normal tool-loader path (which would 404 on the synthetic id). */
export const USER_TOOL_ID_PREFIX = 'usertool:';

export interface ProjectedUserTool {
  id: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  formats: readonly string[];
  /** Present ONLY on a projected user tool - the marker + the open payload. */
  userTool: { baseToolId: string; values: Record<string, unknown> };
}

/** The category user tools group under in the listings. */
export const USER_TOOL_CATEGORY = 'Your tools';

/** Project one stored user tool into a gallery/picker-shaped entry. Pure. */
export function projectUserTool(tool: UserTool): ProjectedUserTool {
  return {
    id: USER_TOOL_ID_PREFIX + tool.id,
    name: tool.title,
    ...(tool.description ? { description: tool.description } : {}),
    category: USER_TOOL_CATEGORY,
    ...(tool.icon ? { icon: tool.icon } : {}),
    formats: tool.formats ?? [],
    userTool: { baseToolId: tool.baseToolId, values: tool.values },
  };
}

/** True for a projected user-tool id (so a listing's open handler can route it specially). */
export function isUserToolId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(USER_TOOL_ID_PREFIX);
}
