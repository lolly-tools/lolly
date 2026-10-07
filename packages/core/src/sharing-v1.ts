// SPDX-License-Identifier: MPL-2.0
/**
 * Sharing contract v1 (plan 299 M0): the access ladder that a shared project,
 * folder or file uses, the general-access audiences, per-share settings, end
 * dates, user-made groups, and the readers a shell applies to a control
 * plane's answers.
 *
 * The control plane decides who may do what. These readers only stop a shell
 * from acting on a malformed or hostile payload: unknown fields are dropped,
 * unknown roles and audiences are refused, and every string is bounded.
 */

/** Roles a grant can carry, lowest first. `owner` is held by one principal and
 *  is never granted, so it is a level but not a role. */
export const SHARE_ROLES = ['viewer', 'commenter', 'editor', 'manager'] as const;
export type ShareRole = typeof SHARE_ROLES[number];

/** Someone's effective level on a shared item, lowest first. */
export const ACCESS_LEVELS = ['none', 'viewer', 'commenter', 'editor', 'manager', 'owner'] as const;
export type AccessLevel = typeof ACCESS_LEVELS[number];

const RANK: Record<AccessLevel, number> = { none: 0, viewer: 1, commenter: 2, editor: 3, manager: 4, owner: 5 };

export const isShareRole = (v: unknown): v is ShareRole => typeof v === 'string' && (SHARE_ROLES as readonly string[]).includes(v);
export const isAccessLevel = (v: unknown): v is AccessLevel => typeof v === 'string' && Object.hasOwn(RANK, v);

/** Position on the ladder; an unknown value ranks as `none`. */
export function accessRank(level: unknown): number {
  return isAccessLevel(level) ? RANK[level] : 0;
}

/** Whether `level` is `min` or higher. */
export function atLeast(level: unknown, min: AccessLevel): boolean {
  return accessRank(level) >= RANK[min];
}

/** The higher of two levels. */
export function higherLevel<T extends AccessLevel>(a: T, b: T): T {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Per-share settings. Download and export are settings, not roles, as in the
 *  file services people already use. Absent means the default noted on each. */
export interface ShareSettings {
  /** Viewers may comment as well as read. Default on, which keeps commenting
   *  open to everyone who can see a document until a manager turns it off. */
  readonly viewersCanComment?: boolean;
  /** Viewers and commenters may download and export. Default on. */
  readonly viewersCanExport?: boolean;
  /** Editors may change who has access. Default off: managers share. */
  readonly editorsCanShare?: boolean;
  /** Guests may connect their own agents. Default off (plan 299 section 8.4). */
  readonly guestsBringAgents?: boolean;
}

export interface AccessAbilities {
  readonly view: boolean;
  readonly comment: boolean;
  readonly edit: boolean;
  readonly export: boolean;
  readonly share: boolean;
}

/** What a level allows under a share's settings. */
export function abilitiesOf(level: unknown, settings: ShareSettings = {}): AccessAbilities {
  const rank = accessRank(level);
  const view = rank >= RANK.viewer;
  return {
    view,
    comment: rank >= RANK.commenter || (view && settings.viewersCanComment !== false),
    edit: rank >= RANK.editor,
    export: rank >= RANK.editor || (view && settings.viewersCanExport !== false),
    share: rank >= RANK.manager || (rank >= RANK.editor && settings.editorsCanShare === true),
  };
}

/** Who a share reaches without being named. `restricted` reaches nobody extra;
 *  `instance` reaches every signed-in member of the instance (never a guest);
 *  `public` reaches anyone holding the link, without signing in. */
export const GENERAL_AUDIENCES = ['restricted', 'instance', 'public'] as const;
export type GeneralAudience = typeof GENERAL_AUDIENCES[number];
export const isGeneralAudience = (v: unknown): v is GeneralAudience =>
  typeof v === 'string' && (GENERAL_AUDIENCES as readonly string[]).includes(v);

export interface GeneralAccess {
  readonly audience: GeneralAudience;
  /** The role the audience receives. Ignored when `audience` is `restricted`. */
  readonly role: ShareRole;
}

export const RESTRICTED: GeneralAccess = Object.freeze({ audience: 'restricted', role: 'viewer' });

/** The widest role an audience may carry. Public links are view only; the
 *  instance audience stops at the policy's ceiling (Commenter by default) and
 *  never reaches Manager. `restricted` carries no role. */
export function audienceCeiling(audience: GeneralAudience, instanceMaxRole: ShareRole = 'commenter'): ShareRole | null {
  if (audience === 'restricted') return null;
  if (audience === 'public') return 'viewer';
  return RANK[instanceMaxRole] >= RANK.manager ? 'editor' : instanceMaxRole;
}

/** The roles a share dialog may offer for an audience, lowest first. */
export function rolesForAudience(audience: GeneralAudience, instanceMaxRole: ShareRole = 'commenter'): ShareRole[] {
  const ceiling = audienceCeiling(audience, instanceMaxRole);
  return ceiling ? SHARE_ROLES.filter(r => RANK[r] <= RANK[ceiling]) : [];
}

/** `role` lowered to `ceiling` when it is higher. */
export function clampRole(role: ShareRole, ceiling: ShareRole): ShareRole {
  return RANK[role] <= RANK[ceiling] ? role : ceiling;
}

/** Why someone has access, shown beside their row so nobody has to guess. */
export const ACCESS_REASONS = ['owner', 'member', 'group', 'custom-group', 'instance', 'public', 'admin', 'link'] as const;
export type AccessReason = typeof ACCESS_REASONS[number];

/** A principal a grant names. A directory group is identified by its name; a
 *  user-made group by an id the control plane minted. */
export type SharePrincipal =
  | { readonly kind: 'user'; readonly id: string; readonly name: string }
  | { readonly kind: 'group'; readonly name: string }
  | { readonly kind: 'custom-group'; readonly id: string; readonly name: string; readonly memberCount?: number };

export interface ShareGrant {
  readonly principal: SharePrincipal;
  readonly role: ShareRole;
  /** ISO time after which the grant gives nothing. */
  readonly expiresAt?: string;
}

/** The limits a control plane publishes, so a dialog offers only what the
 *  server will accept. */
export interface SharePolicyView {
  readonly audiences: readonly GeneralAudience[];
  readonly instanceMaxRole: ShareRole;
  readonly roles: readonly ShareRole[];
  readonly customGroups: boolean;
  /** Longest end date a grant may carry, in days. Absent means no limit. */
  readonly maxGrantDays?: number;
}

/** A shared item's access, as one answer. People rows come from the members
 *  route; `expiries` carries their end dates by user id. */
export interface ShareState {
  readonly general: GeneralAccess;
  readonly grants: readonly ShareGrant[];
  readonly expiries: Readonly<Record<string, string>>;
  readonly settings: ShareSettings;
  readonly policy: SharePolicyView;
  readonly canManage: boolean;
}

// ── end dates ─────────────────────────────────────────────────────────────

/** End-date presets a dialog offers, in days. */
export const EXPIRY_PRESET_DAYS = [1, 7, 30] as const;
const DAY_MS = 86_400_000;

/** Whether a grant ending at `expiresAt` still applies. No end date applies. */
export function grantLive(expiresAt: string | undefined, now: number = Date.now()): boolean {
  if (expiresAt === undefined) return true;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > now;
}

/** The ISO end date `days` from `now`. */
export function expiryInDays(days: number, now: number = Date.now()): string {
  return new Date(now + Math.max(0, days) * DAY_MS).toISOString();
}

/** Whole days left before `expiresAt`, rounded up; 0 once it has passed. */
export function daysLeft(expiresAt: string, now: number = Date.now()): number {
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - now) / DAY_MS)) : 0;
}

// ── user-made groups ──────────────────────────────────────────────────────

export const SHARE_GROUP_NAME_MAX = 80;
export const SHARE_GROUP_DESCRIPTION_MAX = 280;
export const SHARE_GROUP_MEMBER_LIMIT = 500;
export const SHARE_GROUP_ROLES = ['member', 'manager', 'owner'] as const;
export type ShareGroupRole = typeof SHARE_GROUP_ROLES[number];

export interface ShareGroupSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly memberCount: number;
  readonly myRole: ShareGroupRole;
}

export interface ShareGroupMember {
  readonly id: string;
  readonly name: string;
  readonly role: ShareGroupRole;
}

export interface ShareGroupDetail extends ShareGroupSummary {
  readonly members: readonly ShareGroupMember[];
}

// ── readers ───────────────────────────────────────────────────────────────

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function text(v: unknown, max = 256): string | undefined {
  if (typeof v !== 'string') return undefined;
  let out = '';
  for (const ch of v) {
    const code = ch.codePointAt(0)!;
    if (code < 32 || (code >= 127 && code <= 159)) continue;
    if (out.length + ch.length > max) break;
    out += ch;
  }
  out = out.trim();
  return out || undefined;
}

const ID = /^[A-Za-z0-9_.:@-]{1,128}$/;
const idOf = (v: unknown): string | undefined => (typeof v === 'string' && ID.test(v) ? v : undefined);

function isoOf(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 40) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

const count = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : undefined;

/** General access, falling back to `restricted` for anything unreadable. */
export function readGeneralAccess(v: unknown): GeneralAccess {
  if (!object(v) || !isGeneralAudience(v.audience)) return RESTRICTED;
  if (v.audience === 'restricted') return RESTRICTED;
  const ceiling = audienceCeiling(v.audience, 'editor')!;
  return { audience: v.audience, role: isShareRole(v.role) ? clampRole(v.role, ceiling) : 'viewer' };
}

/** Settings with only boolean fields kept. */
export function readShareSettings(v: unknown): ShareSettings {
  if (!object(v)) return {};
  const out: Record<string, boolean> = {};
  for (const key of ['viewersCanComment', 'viewersCanExport', 'editorsCanShare', 'guestsBringAgents'] as const) {
    if (typeof v[key] === 'boolean') out[key] = v[key] as boolean;
  }
  return out;
}

export function readSharePrincipal(v: unknown): SharePrincipal | null {
  if (!object(v)) return null;
  if (v.kind === 'user') {
    const id = idOf(v.id), name = text(v.name);
    return id && name ? { kind: 'user', id, name } : null;
  }
  if (v.kind === 'group') {
    const name = text(v.name, 128);
    return name ? { kind: 'group', name } : null;
  }
  if (v.kind === 'custom-group') {
    const id = idOf(v.id), name = text(v.name, SHARE_GROUP_NAME_MAX), members = count(v.memberCount);
    return id && name ? { kind: 'custom-group', id, name, ...(members !== undefined ? { memberCount: members } : {}) } : null;
  }
  return null;
}

export function readShareGrant(v: unknown): ShareGrant | null {
  if (!object(v) || !isShareRole(v.role)) return null;
  const principal = readSharePrincipal(v.principal);
  if (!principal) return null;
  const expiresAt = isoOf(v.expiresAt);
  return { principal, role: v.role, ...(expiresAt ? { expiresAt } : {}) };
}

/** Stable key for a grant's principal, for diffing and de-duplicating. */
export function principalKey(p: SharePrincipal): string {
  return p.kind === 'group' ? `group:${p.name}` : `${p.kind}:${p.id}`;
}

export function readSharePolicy(v: unknown): SharePolicyView {
  const o = object(v) ? v : {};
  const audiences = Array.isArray(o.audiences) ? GENERAL_AUDIENCES.filter(a => (o.audiences as unknown[]).includes(a)) : [];
  const roles = Array.isArray(o.roles) ? SHARE_ROLES.filter(r => (o.roles as unknown[]).includes(r)) : [];
  const maxDays = count(o.maxGrantDays);
  return {
    audiences: audiences.includes('restricted') ? audiences : ['restricted', ...audiences],
    instanceMaxRole: isShareRole(o.instanceMaxRole) ? o.instanceMaxRole : 'commenter',
    roles: roles.length ? roles : [...SHARE_ROLES],
    customGroups: o.customGroups === true,
    ...(maxDays ? { maxGrantDays: maxDays } : {}),
  };
}

/** A whole share answer, or null when it is not one. Grants are capped at 200
 *  and de-duplicated by principal (first wins). */
export function readShareState(v: unknown): ShareState | null {
  if (!object(v) || !object(v.general) && v.general !== undefined) return null;
  const seen = new Set<string>();
  const grants: ShareGrant[] = [];
  for (const raw of Array.isArray(v.grants) ? v.grants.slice(0, 200) : []) {
    const grant = readShareGrant(raw);
    if (!grant) continue;
    const key = principalKey(grant.principal);
    if (seen.has(key)) continue;
    seen.add(key);
    grants.push(grant);
  }
  const expiries: Record<string, string> = {};
  if (object(v.expiries)) {
    for (const [userId, at] of Object.entries(v.expiries).slice(0, 1000)) {
      const id = idOf(userId), iso = isoOf(at);
      if (id && iso) expiries[id] = iso;
    }
  }
  return {
    general: readGeneralAccess(v.general),
    grants,
    expiries,
    settings: readShareSettings(v.settings),
    policy: readSharePolicy(v.policy),
    canManage: v.canManage === true,
  };
}

const groupRole = (v: unknown): ShareGroupRole | undefined =>
  typeof v === 'string' && (SHARE_GROUP_ROLES as readonly string[]).includes(v) ? v as ShareGroupRole : undefined;

export function readShareGroupSummary(v: unknown): ShareGroupSummary | null {
  if (!object(v)) return null;
  const id = idOf(v.id), name = text(v.name, SHARE_GROUP_NAME_MAX), myRole = groupRole(v.myRole);
  if (!id || !name || !myRole) return null;
  const description = text(v.description, SHARE_GROUP_DESCRIPTION_MAX);
  return { id, name, memberCount: count(v.memberCount) ?? 0, myRole, ...(description ? { description } : {}) };
}

export function readShareGroupDetail(v: unknown): ShareGroupDetail | null {
  const summary = readShareGroupSummary(v);
  if (!summary || !object(v)) return null;
  const members: ShareGroupMember[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(v.members) ? v.members.slice(0, SHARE_GROUP_MEMBER_LIMIT) : []) {
    if (!object(raw)) continue;
    const id = idOf(raw.id), name = text(raw.name), role = groupRole(raw.role) ?? 'member';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    members.push({ id, name, role });
  }
  return { ...summary, members };
}
