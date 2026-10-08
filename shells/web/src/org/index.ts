// SPDX-License-Identifier: MPL-2.0
/**
 * org/ - the single seam through which a deployment's OPTIONAL control plane
 * talks to this shell.
 *
 * A plain Lolly deployment (e.g. the public lolly.tools) ships no control plane:
 * every endpoint below is absent, `initOrg()` resolves to `null` after one
 * tolerant, time-boxed probe (remembered so later boots skip even that), and the
 * shell behaves byte-identically to a build without this module - no gate, no
 * banner, an empty field-policy registry, nothing.
 *
 * When a deployment DOES provide an org-config endpoint, this module is the only
 * place that knows about it. It:
 *   1. probes `GET /api/auth/config` (dormant on 404 / error / non-JSON),
 *   2. resolves the session (`GET /api/auth/session`),
 *   3. gates the app behind sign-in when the deployment is in `gated` mode and
 *      the visitor is not a member,
 *   4. for a member, loads `GET /api/v1/org-config` (ETag-cached) and applies its
 *      profile field policy through the generic src/lib/field-policy.ts registry,
 *      then starts the inbox (org/inbox.ts), which shows its messages as a banner.
 *
 * All traffic goes through instanceFetch/instancePath (src/lib/instance.ts) so a
 * shell pointed at a remote instance consults THAT instance's control plane, and
 * the X-Lolly-Client header rides along for same-origin/native requests. Step 1 -
 * the probe, its negative cache and the tolerant fetch helpers - lives in
 * org/probe.ts, which is what boot imports: a deployment that answers nothing
 * never loads this file. Everything after the probe is initOrgWithAuth() below.
 *
 * Comments here describe a generic "deployment" / "instance" capability, never a
 * specific product: the control plane is a separate, optional server product, and
 * this shell only ever speaks its documented contract.
 */

import {
  instancePath, getInstanceBase,
  ensureInstallId, setInstallTag, setInstanceSession,
} from '../lib/instance.ts';
import { noteCatalogRefused } from '../lib/catalog-access.ts';
import { setFieldPolicies } from '../lib/field-policy.ts';
import { beginAiProbe, finishAiProbe, knownManagedAi, startAiPolicyPolling, stopAiPolicyPolling } from './ai-policy.ts';
import type { AiPolicy } from '../lib/ai-policy.ts';
import type { FieldPolicy } from '../lib/field-policy.ts';
import { setToolInputPolicies, clearInputPolicies, setInputPolicyFailClosed, onToolInputMount } from '../lib/input-policy.ts';
import type { InputPolicy } from '../lib/input-policy.ts';
import { registerShareSection } from '../lib/share-sections.ts';
import { registerProfileSection } from '../lib/profile-sections.ts';
import { setExportPolicy } from '../lib/export-policy.ts';
import { failClosedSitePolicy, setSitePolicy } from '../lib/site-policy.ts';
import { registerApprovalOpener } from '../lib/approval-request.ts';
import { registerCatalogSubmitter } from '../lib/catalog-submit.ts';
import { getSessionWriter, registerSessionSource } from '../lib/session-source.ts';
import { registerNearbyProvider } from '../lib/nearby.ts';
import { createOrgNearbyProvider } from './nearby-source.ts';
import {
  applyOrgDeliveryTargets,
  clearOrgDeliveryTargets,
  type OrgDeliveryDestination,
} from './delivery-targets.ts';
import { setInjectedTools } from '../lib/injected-tools.ts';
import { setOrgGovernanceResolver, type FlagGovernance } from './governance.ts';
// The probe half of this seam, in its own leaf so boot can run it without loading
// this module - see org/probe.ts's header. The helpers below are shared, not
// duplicated: one definition of "tolerant, time-boxed, JSON-only".
import { PROBE_TIMEOUT_MS, isRecentlyAbsent, jsonBody, probeInstance, rememberAbsent, safeFetch } from './probe.ts';
// Import from the LEAF module, not the '@lolly/engine' barrel: org/index.ts is on the boot
// static-import chain (jelly → feature-flags → org), so a barrel import drags the whole
// engine (render/c2pa/handlebars/ajv, ~555KB) onto first paint. tool-url.ts only pulls the
// tiny embed.ts leaf. (Same direct-import pattern the bridge/* modules use.)
import { parseToolUrl } from '../../../../engine/src/tool-url.ts';
import { createInstanceSessionSource } from './session-source.ts';
import { createSourceFiles } from './source-files.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { appPathname } from '../lib/any-site.ts';
import { t, tRaw } from '../i18n.ts';
import { invitePolicy } from './team-access.ts';
import { escape, safeHref } from '../utils.ts';

// ── Contract types (the server product's documented shapes) ───────────────────

export interface AuthConfig {
  mode: 'open' | 'gated' | 'per-tool';
  provider: 'oidc' | 'dev' | 'proxy' | null;
  loginPath: string | null;
  /** Same-origin management route, advertised only by an instance with native passkeys. */
  passkeyManagementPath?: string;
  documentAgentPath?: string;
  /** The workspace's own name ("lolly.ing"), for the sign-in gate and the profile card
   *  before (or without) a member's org-config. Absent on an older instance. */
  instanceName?: string;
  /** True when only invited people (or listed addresses) are let in. Absent on an older
   *  instance, which the gate reads as invite-only, the usual case for a gated one. */
  inviteOnly?: boolean;
}

export interface OrgUser {
  sub: string;
  email?: string;
  /** The person's own name, when the instance sends one. */
  name?: string;
  groups?: string[];
  role?: string;
}

export type Session =
  | { kind: 'member'; user: OrgUser }
  | { kind: 'guest'; guest: Record<string, unknown> };

/** One field's policy as the control plane declares it (mapped to a generic
 *  FieldPolicy before it reaches the registry - no product terms leak out). */
export interface ProfileFieldSpec {
  mode: 'editable' | 'locked' | 'hidden';
  source?: 'idp';
  value?: unknown;
}

/** One input's access rule inside a tool policy (control-plane shape). */
export interface InputAccessSpec {
  level: 'locked' | 'choice';
  value?: unknown;
  allow?: string[];
  /** Display name of the policy that set this rule, and the optional free-text
   *  reason its author wrote. Passed straight through to the generic input-policy
   *  seam, which is what lets the sidebar say WHICH policy locked a control
   *  instead of only that something did. Absent on an instance that names none. */
  by?: string;
  reason?: string;
}

/** One tool's policy as the control plane declares it (mapped to generic
 *  InputPolicy entries before they reach the registry). */
export interface ToolPolicySpec {
  /** Per-input access rules (locked / choice). */
  inputs?: Array<{ id: string; access?: InputAccessSpec }>;
  /** Input ids this caller must not see at all. */
  hidden?: string[];
  /** The approval chain bound to this tool's outputs when the instance requires
   *  approval for them (absent = not gated). Mapped onto the generic export-policy
   *  seam so the tool view can offer "Request approval" in place of download. */
  approvalChain?: string;
  /** The export formats policy binds this tool to (absent = unrestricted). Mapped
   *  onto the export-policy seam; the export panel narrows its format select to
   *  this set, the same cooperative overlay a choice input gets - the control
   *  plane enforces the same set on its own render path. */
  formats?: string[];
}

/** A tool the instance injects into the gallery (control-plane shape). `toolId` is
 *  the id the instance serves under `/tools/<id>/`; `source:'url'` carries a Lolly
 *  tool URL instead. Mapped onto the neutral lib/injected-tools registry. */
export interface ToolInjectable {
  id: string;
  kind: 'tool';
  title: string;
  toolId: string;
  source: 'catalog' | 'url';
  ref?: string;
}

/** A piece of declarative UI chrome the instance injects (control-plane shape).
 *  Pure data - rendered by org/chrome.ts through escape(), never executed. */
export interface ChromeInjectable {
  id: string;
  kind: 'chrome';
  title: string;
  slot: 'banner' | 'nav' | 'panel';
  tone?: 'info' | 'accent' | 'warn';
  text: string;
  link?: { label: string; href: string };
}

/** The injectables the control plane projects into org-config. A discriminated
 *  union keyed by `kind`; an unknown kind is ignored (flag-kind rides featureFlags,
 *  resource-kind rides the catalog - neither reaches this list). */
export type Injectable = ToolInjectable | ChromeInjectable;

export interface OrgConfig {
  ai?: AiPolicy;
  instance: { name: string };
  /** The view a member's app opens on at the bare app address (no route in it): the
   *  tools gallery or their Projects. Absent ⇒ no instance opinion (the gallery). Applied
   *  once, at boot, by applyHomeView below. */
  home?: 'tools' | 'projects';
  /** Optional root-relative or HTTPS Home destination, overriding home. */
  homeUrl?: string;
  session?: Session;
  profilePolicy?: Record<string, ProfileFieldSpec>;
  tools?: Record<string, ToolPolicySpec>;
  /** Capability flags the caller has on this instance (e.g. 'link.create',
   *  'export.download', 'export.request'. 'export.preflight' is LEGACY: the
   *  prepress card is a personal feature flag since 2026-08-06, and
   *  orgFlagGovernance maps this capability onto that flag's default so an
   *  instance still granting it keeps the card on for members who haven't
   *  chosen). */
  can?: Record<string, boolean>;
  /** Control-plane governance for the shell's per-user feature flags, by flag id:
   *  `default` is applied when the user hasn't chosen; `hidden` suppresses the
   *  profile toggle (the default still applies). Absent ⇒ no instance opinion. */
  featureFlags?: Record<string, { default?: boolean; hidden?: boolean }>;
  /** Capability the instance injects into the shell: tools added to the gallery,
   *  declarative UI chrome (banners). Absent ⇒ no instance opinion; each descriptor
   *  is DATA the shell renders, never code. flag/resource kinds ride other seams. */
  injectables?: Injectable[];
  /** Fixed organisation-owned outbound targets already filtered for this
   *  caller. Provider options and credentials never enter the shell. */
  destinations?: OrgDeliveryDestination[];
  telemetry?: { level?: string; attribution?: unknown; consented?: boolean };
  inboxUnread?: number;
  policyVersion?: string | number;
  branding?: { revision: string; sourceId: string };
  /** Which sites members may contact (lolly-work plan 58, Lolly plan 288): a mode,
   *  allow and block rules by id, each rule's reason, whether the member's own list
   *  is locked and whether the brand's entries apply. Absent ⇒ `open`. */
  network?: OrgNetworkPolicy;
  /** What the caller may share a new team project with (lolly-work plan 74): the
   *  groups usable for sharing. Absent on an older instance, which then offers only
   *  "Only me" (org/session-source.ts teamProjectOptions). */
  sharing?: {
    groups?: string[]; projectFiles?: boolean;
    /** The sharing limits (lolly plan 299 M1, `policy.sharing`): sharing with everyone
     *  signed in to the instance and its highest role, user-made groups and the
     *  longest end date. Absent on an older instance, which then offers none of them. */
    instance?: { enabled?: boolean; maxRole?: string }; customGroups?: boolean; maxGrantDays?: number | null;
  };
  /** Limits on inviting people by email (lolly-work plan 74): the domains an invitee's
   *  address must be at (empty: any), how long an invitation lasts, and the project
   *  roles an invitation may carry. Absent on an older instance, which then has no
   *  invite routes, so the shell offers no "People" panel there
   *  (org/team-access.ts invitePolicy). Whether this caller may invite at all is
   *  `can['user.invite']`. */
  invites?: { domains?: string[]; maxTtlHours?: number; projectRoles?: string[] };
}

export interface OrgNetworkPolicy {
  mode: 'open' | 'ask' | 'allowlist-only' | 'none';
  allow?: Array<{ entry: string; ruleId?: string }>;
  block?: Array<{ entry?: string; ruleId?: string }>;
  memberEntries?: 'allowed' | 'locked';
  brandDefaults?: 'include' | 'ignore';
  by?: string;
  reasons?: Record<string, string>;
}

/** What initOrg resolves with when a control plane is present. `null` (dormant)
 *  means no control plane - see initOrg. */
export interface OrgState {
  auth: AuthConfig;
  session: Session | null;
  config: OrgConfig | null;
  /** True when a sign-in gate has been rendered IN PLACE OF the app; boot must
   *  stop (no view is mounted). */
  gate: boolean;
}

// ── Module state (per session) ────────────────────────────────────────────────

let session: Session | null = null;
/** What the instance's auth config said at boot: where its name comes from before (or
 *  without) a member's org-config. Null when dormant. */
let authState: AuthConfig | null = null;
let orgConfigState: OrgConfig | null = null;
/** org/inbox.ts, loading or loaded: started at boot for every member. Null otherwise. */
let inboxLoad: Promise<typeof import('./inbox.ts')> | null = null;
/** The same module once it has loaded, so a test reset can stop its refetches. */
let inboxModule: typeof import('./inbox.ts') | null = null;
/** Last org-config ETag, for the conditional request (module-state cache). */
let orgConfigEtag: string | null = null;
const listeners = new Set<(config: OrgConfig | null) => void>();
/** Unregister for the Share-dialog "On this instance" section, so a re-init doesn't
 *  stack a second builder onto the generic share-sections registry. */
let unregisterShareSection: (() => void) | null = null;
/** Unregister for the approval-request opener, so a re-init replaces rather than
 *  leaks the previous registration. */
let unregisterApprovalOpener: (() => void) | null = null;
/** Unregister for "Submit to <workspace>" (lib/catalog-submit.ts), replaced on re-init. */
let unregisterCatalogSubmitter: (() => void) | null = null;
let unregisterSessionSource: (() => void) | null = null;
/** Unregister for the Share-dialog "Team" section (save to a team project), so a
 *  re-init replaces the registration instead of stacking a second one. */
let unregisterTeamShareSection: (() => void) | null = null;
/** org/team-save.ts once loaded, so the Team section can be built in the same task as
 *  the Share surface it belongs to. */
let teamSaveModule: typeof import('./team-save.ts') | null = null;
function loadTeamSave(): Promise<typeof import('./team-save.ts')> {
  return import('./team-save.ts').then((m) => (teamSaveModule = m));
}
/** Run `fn` when the page is idle (soon, where there is no idle callback). */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 4000 });
  else setTimeout(fn, 1500);
}
/** Unregister for the profile view's "Linked sign-ins" card (lib/profile-sections.ts),
 *  so a re-init replaces the registration instead of stacking a second one. */
let unregisterProfileSection: (() => void) | null = null;
/** Unregister for the `'org'` nearby provider (plans/26 section 8), so a re-init replaces
 *  rather than stacks it. Registered only when the instance grants `collab.nearby`. */
let unregisterNearbySource: (() => void) | null = null;
/** Unregister for the work-collab factory (plan 100 wave 3.1), so a re-init replaces
 *  rather than stacks the registration. Null whenever the instance does not grant
 *  `collab.join` - which is every instance until the server ships the bits. */
let unregisterCollabFactory: (() => void) | null = null;
/** Unregister for the `'work'` collab opener (plan 100 section 7 item 9, wave 3.3), the
 *  automatic joining that uses it and the presence pill's "Invite to edit now". Same
 *  last-wins reasoning as the handles above. */
let unregisterCollabOpener: (() => void) | null = null;
/** Unregister for the header's account chip (org/account-chip.ts through the neutral
 *  lib/account-slot.ts seam): a member's chip, or Sign in for a visitor on an open
 *  workspace. Null on a dormant shell, which shows no chip at all. */
let unregisterAccountChip: (() => void) | null = null;
/** Unregister for the input-policy tool-mount hook (applyOrgToolPolicies), so a
 *  re-init replaces rather than stacks it. Null on a dormant instance: the hook is
 *  registered only on the member branch, so an ungoverned shell's mount path never
 *  runs anything from here. */
let unregisterToolMount: (() => void) | null = null;

/** How long a successfully-fetched org-config may stand in for a live one when the
 *  (present) control plane can't be reached on a later boot - a bounded freshness
 *  window so a control-plane outage is a non-event, not a fleet-wide policy drop.
 *  Past it, stale policy is discarded and gated actions fail closed rather than
 *  trusting an old copy indefinitely. */
const ORG_CONFIG_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const orgConfigKey = (): string => `lolly:org-config:${getInstanceBase() || 'same-origin'}`;
/** Set by a sign-out and cleared by the next member session: while it is set, the gate's
 *  Sign in asks the identity provider for its account picker. Without it the provider's
 *  own session, which a sign-out here does not end, signs the next person straight back
 *  in as the one who just left. lolly-work's login route passes the prompt on to the
 *  provider (and on through its provider chooser). Device-wide rather than per tab: on a
 *  shared device the next person often opens a new tab. */
const signedOutKey = (): string => `lolly:signed-out:${getInstanceBase() || 'same-origin'}`;

// ── Accessors + subscription (the tiny surface other code may consult) ────────

/** The active org-config, or null when dormant / not a member. */
export function orgConfig(): OrgConfig | null {
  return orgConfigState;
}

/** The resolved session, or null (dormant, or a 401/no-session control plane). */
export function orgSession(): Session | null {
  return session;
}

export { orgAgentInvitesEnabled } from './document-agent-config.ts';
import { setAgentInviteAvailability } from './document-agent-config.ts';
import { homeHref, setHomeDestination } from '../lib/home-destination.ts';

/** Control-plane governance for one feature flag, or null when this control plane
 *  has no opinion on it. Consumed by feature-flags.ts to resolve the default and
 *  hide governed toggles - through the org/governance.ts registry, not from here,
 *  so that read costs nothing on a deployment with no control plane. */
function readFlagGovernance(id: string): FlagGovernance {
  const gov = orgConfigState?.featureFlags?.[id] ?? null;
  // Legacy bridge: `can['export.preflight']` predates the personal
  // 'export-preflight' flag (2026-08-06). An instance still granting the
  // capability - with no explicit featureFlags entry for the flag, which wins - 
  // reads as governance defaulting the flag ON: members keep the card unless
  // they turn it off themselves. (String literal, not an import: flag ids are
  // permanent contracts, and feature-flags.ts reaches this module through the
  // governance registry.)
  if (!gov && id === 'export-preflight' && orgConfigState?.can?.['export.preflight'] === true) {
    return { default: true };
  }
  return gov;
}

// Registered at module scope, not from initOrg(): the read must be correct from the
// moment this module exists, however it was reached - the lazy boot path below, a
// direct import from a view, or a test. Before that it answers null, which is the
// dormant answer.
setOrgGovernanceResolver(readFlagGovernance);

/** Re-exported so `org/index.ts` stays the one import path for org consumers that
 *  already load it; feature-flags.ts imports the registry leaf directly instead. */
export { orgFlagGovernance } from './governance.ts';

/**
 * The instance-admin console href when the current member's role is admin/owner,
 * else null. A one-function seam a view can consult to show an "Instance console"
 * affordance without importing any of the control-plane machinery above.
 */
export function orgAdminHref(): string | null {
  const role = session?.kind === 'member' ? session.user.role : undefined;
  return role === 'admin' || role === 'owner' ? '/admin' : null;
}

/**
 * The same console as {@link orgAdminHref}, as an absolute address on the workspace:
 * what the account chip links to. A root-relative '/admin' resolves against the page,
 * which in the apps is the app's own origin, not the workspace; this one opens the
 * workspace's console from anywhere. Null for everyone orgAdminHref gives null.
 */
export function orgConsoleUrl(): string | null {
  const href = orgAdminHref();
  if (!href) return null;
  if (getInstanceBase()) return instancePath(href);
  try { return new URL(href, location.origin).href; } catch { return null; }
}

/**
 * Whether a member is signed in to this instance: what offers "Sign out" in the
 * profile view's instance card, to every member and not only an admin. False when
 * dormant and for a guest, so a deployment with no control plane shows no such button.
 */
export function orgMemberSignedIn(): boolean {
  return session?.kind === 'member';
}

/** A name or address from the instance as plain text: trimmed and kept short, or ''. */
function cleanText(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** One field of an instance-supplied object, or undefined when there is no object. */
function fieldOf(v: unknown, key: string): unknown {
  return v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined;
}

/** The workspace's own name: the member's org-config first, then the auth config. */
function workspaceName(): string {
  return cleanText(orgConfigState?.instance?.name) || cleanText(authState?.instanceName);
}

/**
 * The workspace this shell is connected to, who is signed in, and their inbox: what the
 * profile view's instance card shows ("Connected to lolly.ing", "Signed in as ...",
 * Inbox). Handed to the view on its context by views/profile.ts, so the card's own
 * modules import nothing from org/. Null when dormant, so a deployment with no control
 * plane shows the card exactly as before. `member` is null on an open workspace nobody
 * is signed in to, and for a guest.
 *
 * The name comes from the session when the instance sends one there, else from the
 * org-config's session block, which the instance fills with the address when it knows
 * no name; a name that is only the address again is dropped, so the card says it once.
 */
export function orgProfileAccount(): {
  securityHref?: string;
  workspace: string;
  member: { email: string; name: string } | null;
  inbox: { count(): number; onChange(fn: (count: number) => void): () => void; open(): void } | null;
} | null {
  if (!authState) return null;
  if (session?.kind !== 'member') return { workspace: workspaceName(), member: null, inbox: null };
  // The org-config's session block is the instance's `{ sub, email, name, ... }`.
  const fromConfig: unknown = orgConfigState?.session;
  const email = cleanText(session.user.email, 254) || cleanText(fieldOf(fromConfig, 'email'), 254);
  const name = cleanText(session.user.name) || cleanText(fieldOf(fromConfig, 'name'));
  return {
    ...(authState.passkeyManagementPath === '/api/auth/security' ? { securityHref: instancePath('/api/auth/security') } : {}),
    workspace: workspaceName(),
    member: { email, name: name.toLowerCase() === email.toLowerCase() ? '' : name },
    inbox: {
      // Until the inbox module has loaded, the count the org-config carried.
      count: () => inboxModule ? inboxModule.inboxMessages().length : Math.max(0, Number(orgConfigState?.inboxUnread) || 0),
      onChange(fn) {
        let off: (() => void) | null = null;
        let done = false;
        inboxLoad?.then((m) => {
          if (done) return;
          fn(m.inboxMessages().length);
          off = m.onInboxChange((msgs) => fn(msgs.length));
        }).catch(() => { /* no inbox this session; the count stays as shown */ });
        return () => { done = true; off?.(); };
      },
      open() {
        Promise.all([import('./inbox-sheet.ts'), import('./banner.ts')])
          .then(([m, banner]) => m.openInboxSheet({ workspace: workspaceName() || undefined, roles: invitePolicy(orgConfig())?.projectRoles, mountCollabAction: banner.mountCollabAction }))
          .catch(() => { /* additive; the profile view stands without it */ });
      },
    },
  };
}

/**
 * Fill `into` with the signed-in member's account card ("Linked sign-ins"), for the
 * profile view's instance section. Registered with lib/profile-sections.ts on the
 * member branch of initOrg, so the view imports nothing from org/. Returns false, and touches nothing, when there is
 * no member session, so a deployment with no control plane renders exactly as before.
 * The card's module loads only when it is shown.
 */
export function mountOrgAccount(into: HTMLElement): boolean {
  if (session?.kind !== 'member') return false;
  import('./linked-signins.ts')
    .then((m) => m.mountLinkedSignIns(into))
    .catch(() => { /* additive; the rest of the profile view stands without it */ });
  return true;
}

function emit(): void {
  for (const fn of listeners) {
    try { fn(orgConfigState); } catch (e) { console.error(e); }
  }
}

// ── Network helpers (all tolerant; a control-plane hiccup never throws to boot) ─

async function fetchSession(): Promise<Session | null> {
  const res = await safeFetch('/api/auth/session');
  if (!res || res.status === 401) return null; // 401 ⇒ no session
  const body = await jsonBody<Session>(res);
  return body && (body.kind === 'member' || body.kind === 'guest') ? body : null;
}

/**
 * Sign the member out of this instance the way its console does: `POST /api/auth/logout`
 * with no body, which clears the session cookies. No token rides along - the control
 * plane's cross-site guard admits a same-site request carrying the cookie - and it goes
 * through instanceFetch like every call here, so the instance the shell points at is the
 * one signed out of. Resolves true when the instance confirmed it (any 2xx), false on a
 * refusal, a network error or the time box, having changed nothing.
 *
 * On success it notes the sign-out, so the gate's Sign in offers the identity provider's
 * account picker next time ({@link signedOutKey}), and it forgets what this device kept
 * for the person, so the reload that follows cannot show them again: the org-config
 * cache (kept per instance, not per person, so the next member to sign in here would
 * otherwise stand on it whenever their own load failed), the session pair a native
 * shell parked (its transport has no cookie jar, so the cleared cookie never reaches
 * it), the install tag and this module's session and config. The install id stays: it
 * identifies the device, not the person, and only Leave forgets it
 * (lib/instance-leave.ts).
 *
 * A 401 means the session had already ended (it was revoked from another device, or
 * ran out): this device is signed out either way, so it forgets the member and the
 * sign-out counts as done.
 */
export async function signOutOfInstance(): Promise<boolean> {
  const res = await safeFetch('/api/auth/logout', { method: 'POST' }, PROBE_TIMEOUT_MS * 4);
  if (!res?.ok && res?.status !== 401) return false;
  await forgetMemberHere();
  return true;
}

/** What a sign-out forgets on this device (see signOutOfInstance), once the instance has
 *  ended the session: the team-document origins first (plan 75 G17), then the member. */
async function forgetMemberHere(): Promise<void> {
  await forgetTeamOrigins();
  try { localStorage.removeItem(orgConfigKey()); } catch { /* storage unavailable - the copy expires on its TTL */ }
  try { localStorage.setItem(signedOutKey(), '1'); } catch { /* storage unavailable - the gate's plain link */ }
  await setInstanceSession(null);
  setInstallTag(null);
  session = null;
  orgConfigState = null;
  orgConfigEtag = null;
}

/**
 * Sign the member out on every device (`POST /api/v1/me/revoke-sessions`): the instance
 * ends every session this account holds, this browser's included, and clears this
 * browser's cookie. On success this device forgets the member the same way a sign-out
 * does. A 401 means this session had already ended (revoked from another device, or run
 * out): nothing is left to end from here, so this device forgets the member all the
 * same and it counts as done. Resolves 'unsupported' when the instance has no such route
 * (an older instance answers 404 or 405), 'failed' on another refusal (a rate limit
 * included), a network error or the time box, having changed nothing here.
 */
export async function signOutEverywhere(): Promise<'ok' | 'unsupported' | 'failed'> {
  const res = await safeFetch('/api/v1/me/revoke-sessions', { method: 'POST' }, PROBE_TIMEOUT_MS * 4);
  if (!res) return 'failed';
  if (res.status === 404 || res.status === 405) return 'unsupported';
  if (!res.ok && res.status !== 401) return 'failed';
  await forgetMemberHere();
  return 'ok';
}

/**
 * Drop where this device's copies of team documents came from (org/team-origin-durable.ts,
 * plan 75 G17): they are bound to the person signed in, so a sign-out or another account
 * ends them at once, whether or not a copy is ever opened again. Lazy, off the boot path;
 * never rejects.
 */
async function forgetTeamOrigins(): Promise<void> {
  try {
    await (await import('./team-origin-durable.ts')).dropDurableTeamOrigins();
  } catch {
    await import('../lib/team-origin-records.ts').then((m) => m.dropTeamOriginRecords()).catch(() => { /* unreachable chunk: the next look prunes */ });
  }
}

/** The account the cached org-config was loaded for (its session block's `sub`), or null. */
function cachedMemberSub(): string | null {
  try {
    const raw = localStorage.getItem(orgConfigKey());
    const block = raw ? (JSON.parse(raw) as { config?: { session?: { sub?: unknown; user?: { sub?: unknown } } } }).config?.session : null;
    const sub = block?.sub ?? block?.user?.sub;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

/** The outcome of one member org-config load. `ok` carries a usable config (a fresh
 *  200, or an in-session 304 whose in-memory copy still stands); `!ok` means the load
 *  failed (network error, timeout, 5xx, or an unusable body) and the caller must decide
 *  between a cached fallback and failing closed. */
type OrgConfigLoad = { ok: true; config: OrgConfig } | { ok: false };

/**
 * Load the member-only org-config with a conditional request. A fresh 200 is persisted
 * to the resilient cache (see rememberOrgConfig) so a later failed boot can stand on it;
 * a 304 keeps - and re-freshens the cache stamp for - the in-memory copy. Any genuine
 * failure (no response, 5xx, unusable body) resolves `{ ok: false }` so the orchestration
 * can fall back to a still-fresh cached copy or, absent one, fail closed.
 */
async function fetchOrgConfig(): Promise<OrgConfigLoad> {
  // A real network confirmation is required before this payload can grant an
  // AI lease. The server's private HTTP cache must not extend that lease.
  const init: RequestInit = { cache: 'no-store', ...(orgConfigEtag ? { headers: { 'If-None-Match': orgConfigEtag } } : {}) };
  const res = await safeFetch('/api/v1/org-config', init);
  if (!res) return { ok: false };                       // network error / timeout
  if (res.status === 304) {                             // unchanged - honour the cache
    if (!orgConfigState) return { ok: false };
    rememberOrgConfig(orgConfigState, orgConfigEtag);   // re-stamp so the cache stays fresh
    return { ok: true, config: orgConfigState };
  }
  const body = await jsonBody<OrgConfig>(res);           // null on 5xx / non-JSON / bad body
  if (!body || typeof body.instance?.name !== 'string') return { ok: false };
  orgConfigEtag = res.headers.get('etag') || orgConfigEtag;
  rememberOrgConfig(body, orgConfigEtag);                // persist the good copy for later
  return { ok: true, config: body };
}

// ── Field policy: map the contract's profilePolicy onto the generic registry ──

/**
 * Translate the control-plane profile policy into generic FieldPolicy entries
 * and install them. A locked field gets a localised "Managed by <instance>" note
 * here (the registry itself stays product-neutral). Called with an empty/absent
 * policy too, which clears the registry back to its dormant default.
 */
function applyProfilePolicy(config: OrgConfig | null): void {
  const spec = config?.profilePolicy;
  if (!spec) { setFieldPolicies({}); return; }
  const instanceName = config!.instance?.name || '';
  const managedNote = instanceName
    ? tRaw('Managed by {name}', { name: instanceName })
    : t('Managed by your organisation');
  const out: Record<string, FieldPolicy> = {};
  for (const [field, s] of Object.entries(spec)) {
    if (!s || !['editable', 'locked', 'hidden'].includes(s.mode)) continue;
    out[field] = {
      mode: s.mode,
      note: s.mode === 'locked' ? managedNote : undefined,
      value: s.value,
    };
  }
  setFieldPolicies(out);
}

// ── Export policy: map the contract's capability bits + per-tool chains onto the seam ─

/**
 * Translate the caller's export capability bits and per-tool approval chains into a
 * generic ExportPolicy and install it (see src/lib/export-policy.ts). `export.download`
 * defaults to allowed when the control plane doesn't say otherwise, so an instance that
 * doesn't use this feature stays byte-identical to today; only an explicit `false`
 * withholds download. `export.request` gates whether "Request approval" is offered in
 * its place, and each tool's `approvalChain` binds the chain used for that request.
 * A null config (dormant / non-member) clears the seam back to its dormant default.
 *
 * `failClosed` is the governed-but-unreachable-and-un-cached case: policy is known to
 * exist on this instance but couldn't be confirmed this boot. Rather than fall open to
 * a free download, the seam withholds direct download and offers only the (more
 * restrictive) approval path - never fail open. It takes precedence over `config`,
 * which is null in that case anyway.
 */
/**
 * Install the organisation's site rules in the neutral lib/site-policy.ts seam (plan
 * 288, lolly-work plan 58). An instance that sends no `network` leaves the shell open.
 * Governed and unreachable with no cached copy: no outside site at all, with the reason
 * shown wherever a site is refused. Each rule's reason is looked up by its id here, so
 * the seam carries plain entries and words.
 */
function applySitePolicy(config: OrgConfig | null, failClosed = false): void {
  if (failClosed) { setSitePolicy(failClosedSitePolicy(undefined, t("Can't reach your organisation's settings."))); return; }
  const sites = config?.network;
  if (!sites) { setSitePolicy(null); return; }
  const reasons = sites.reasons ?? {};
  const rule = (r: { entry?: string; ruleId?: string }) => ({ entry: r.entry ?? '', ...(r.ruleId && reasons[r.ruleId] ? { reason: reasons[r.ruleId] } : {}) });
  setSitePolicy({
    mode: sites.mode,
    allow: (sites.allow ?? []).map(rule),
    block: (sites.block ?? []).map(rule),
    by: sites.by ?? config?.instance?.name,
    memberEntries: sites.memberEntries,
    brandDefaults: sites.brandDefaults,
  });
}

function applyExportPolicy(config: OrgConfig | null, failClosed = false): void {
  if (failClosed) { setExportPolicy({ canDownload: false, canRequestApproval: true, chains: {} }); return; }
  if (!config) { setExportPolicy(undefined); return; }
  const can = config.can ?? {};
  // The export-panel preflight card is a personal feature flag (default OFF) as
  // of 2026-08-06; the legacy can['export.preflight'] capability is honoured by
  // orgFlagGovernance below, not applied here.
  const chains: Record<string, string> = {};
  const formats: Record<string, string[]> = {};
  for (const [toolId, spec] of Object.entries(config.tools ?? {})) {
    if (spec?.approvalChain) chains[toolId] = spec.approvalChain;
    // An empty list is a real (fully restrictive) policy and is passed through - 
    // the view's never-empty rule decides what to render, not this mapper.
    if (Array.isArray(spec?.formats)) formats[toolId] = spec.formats.filter((f): f is string => typeof f === 'string');
  }
  setExportPolicy({
    canDownload: can['export.download'] !== false,
    canRequestApproval: !!can['export.request'],
    chains,
    formats,
  });
}

/**
 * Install (or lift) the global input-policy fail-closed overlay for the governed-but-
 * unreachable-and-un-cached case. When on, every tool input the sidebar renders is
 * treated as locked read-only - the more restrictive state - so a momentarily-unknown
 * policy can never leave a gated input editable. Off restores the ordinary per-tool
 * behaviour. The overlay outlives applyOrgToolPolicies (which only swaps explicit
 * per-tool entries), so it keeps holding across tool mounts until policy is known again.
 */
function applyInputFailClosed(on: boolean): void {
  setInputPolicyFailClosed(on ? { mode: 'locked', note: t('Managed by your organisation') } : null);
}

// ── Tool input policy: map the contract's per-tool spec onto the generic registry ─

/**
 * Populate the generic src/lib/input-policy.ts registry from the control plane's
 * per-tool declarations, translating them into neutral InputPolicy entries. A
 * locked/choice input gets the localised "Managed by <instance>" note here (the
 * registry itself stays product-neutral); `hidden` ids win over any access rule
 * for the same input.
 *
 * Replaces the whole registry with the current org-config's set, so a re-run
 * after a fresh config drops what the config no longer says. A dormant no-op when
 * there is no control plane - the sidebar then renders exactly as today. Reaches
 * the tool view through the generic input-policy tool-mount hook, which the member
 * branch of initOrgWithAuth registers: the view announces each mount and never
 * imports this module. (From 2026-07-21 to 2026-09-12 nothing called this at all,
 * so a lock the control plane declared never reached a sidebar.)
 */
export function applyOrgToolPolicies(): void {
  clearInputPolicies();
  const tools = orgConfigState?.tools;
  if (!tools) return;
  const instanceName = orgConfigState!.instance?.name || '';
  const managedNote = instanceName
    ? tRaw('Managed by {name}', { name: instanceName })
    : t('Managed by your organisation');
  // Every governed tool at once, not only the one that mounted: the registry is
  // keyed per tool, so nothing bleeds, and a surface that hosts several tools
  // (bulk editing, the embed child editor) is governed the same as a single one.
  for (const [toolId, spec] of Object.entries(tools)) {
    if (!spec) continue;
    const out: Record<string, InputPolicy> = {};
    for (const inp of spec.inputs ?? []) {
      const access = inp?.access;
      if (!inp?.id || !access) continue;
      // `by`/`reason` are pass-through DATA, not a sentence composed here: the
      // sidebar owns the wording, so a policy source that is not this control plane
      // can attribute itself the same way. Spread rather than assigned, so an
      // instance that names no policy produces the exact object shape it always
      // did - the key absent, not present and undefined, which is what the JSON
      // the resilient cache round-trips depends on.
      const by = typeof access.by === 'string' && access.by ? access.by : undefined;
      const reason = by && typeof access.reason === 'string' && access.reason ? access.reason : undefined;
      const why = { ...(by ? { by } : {}), ...(reason ? { reason } : {}) };
      if (access.level === 'locked') {
        out[inp.id] = { mode: 'locked', note: managedNote, value: access.value, ...why };
      } else if (access.level === 'choice') {
        out[inp.id] = { mode: 'choice', note: managedNote, value: access.value, allow: access.allow, ...why };
      }
    }
    // `hidden` (must-not-see) wins over any access rule for the same input.
    for (const id of spec.hidden ?? []) out[id] = { mode: 'hidden' };
    setToolInputPolicies(toolId, out);
  }
}

/**
 * Route the instance's injectables (plans/19, control-plane side) to their generic
 * seams: tool descriptors populate the neutral lib/injected-tools registry (the
 * gallery lists them beside the pack's own); chrome descriptors are DOM-mounted by
 * the caller (lazy, after emit()). flag/resource kinds ride other rails and are not
 * in this list.
 *
 * Clears the tool registry first, so this both installs and drops a prior set - a
 * dormant no-op with no control plane (or no tool injectables), leaving the gallery
 * byte-identical to today. Descriptors are data; nothing here is executed.
 */
export function applyInjectables(config: OrgConfig | null): void {
  // A control plane could send anything; a wrong TYPE here must not throw (it would
  // abort the whole member branch after policies are half-applied). Coerce to [].
  const list = Array.isArray(config?.injectables) ? config!.injectables : [];
  const seen = new Set<string>();
  const tools: Array<{ id: string; name: string; openQuery?: string }> = [];
  for (const d of list) {
    if (d?.kind !== 'tool' || !d.title) continue;
    let id = d.toolId;
    let openQuery: string | undefined;
    if (d.source === 'url') {
      // A url-source tool is "this tool, preconfigured": resolve the link to its
      // served tool id + URL-mode query through the engine's own vetted parser. An
      // unresolvable URL injects nothing (fail closed) rather than a dead card.
      const parsed = d.ref ? parseToolUrl(d.ref) : null;
      if (!parsed) continue;
      id = parsed.toolId;
      openQuery = parsed.query || undefined;
    }
    if (!id || seen.has(id)) continue; // dedupe by the resolved served id
    seen.add(id);
    tools.push({ id, name: d.title, ...(openQuery ? { openQuery } : {}) });
  }
  setInjectedTools(tools);
}

// ── The sign-in gate (rendered in place of the app for a gated instance) ──────

/** Build the login URL: the deployment's loginPath (instance-prefixed) carrying
 *  returnTo=<the URL the visitor asked for>, plus `prompt=select_account` after a
 *  sign-out on this device (see {@link signedOutKey}). */
function loginUrl(loginPath: string): string {
  const returnTo = location.pathname + location.search + location.hash;
  const base = instancePath(loginPath);
  const sep = base.includes('?') ? '&' : '?';
  let picker = false;
  try { picker = localStorage.getItem(signedOutKey()) === '1'; } catch { /* storage unavailable - the plain link */ }
  return `${base}${sep}returnTo=${encodeURIComponent(returnTo)}${picker ? '&prompt=select_account' : ''}`;
}

/**
 * Render a minimal sign-in gate into #view, in the shell's visual language. All
 * strings localised; the primary action is a plain link to the login URL, so it
 * behaves like any navigation (open-in-tab, etc.). Returns true when the gate
 * was shown (boot should stop), false when it could not be (no loginPath).
 *
 * With the workspace's name the gate says whose sign-in this is and, on an invite-only
 * workspace, which account to use: most people reach it from an invitation, and the
 * usual wrong turn is signing in with another address. A visitor who followed a team
 * link is told the link opens once they are in.
 */
function renderGate(auth: AuthConfig, instanceName?: string): boolean {
  const view = document.getElementById('view');
  if (!view) return false;
  // loginPath comes from the control plane's /api/auth/config, and instancePath
  // passes a non-http(s) value straight through when there is no instance base - 
  // so a javascript: loginPath would otherwise reach an href. Same guard, same
  // reasoning as banner.ts/chrome.ts: escaping is not scheme validation.
  //
  // An absent or rejected href keeps the gate and replaces its link with an
  // explanation. The caller stops boot even when the view cannot be rendered.
  const href = typeof auth.loginPath === 'string' && auth.loginPath ? loginUrl(auth.loginPath) : '';
  const linkSafe = !!href && safeHref(href);
  // t() HTML-escapes interpolated params (see i18n.ts), so the instance name is
  // safe in this innerHTML sink. Do NOT switch this to tRaw without escaping it.
  const heading = instanceName
    ? t('Sign in to {name}', { name: instanceName })
    : t('Sign in to continue');
  const body = instanceName && auth.inviteOnly !== false
    ? t('{name} is a private Lolly workspace. Sign in with the account your invitation went to.', { name: instanceName })
    : t('This Lolly instance asks you to sign in before you continue.');
  const lines = location.hash.startsWith('#/team')
    ? [body, t('Sign in to open the team project you were sent.')]
    : [body];
  document.title = `${t('Sign in')} - Lolly`;
  // Built here rather than inline so the suppression can sit on the sink's own
  // line - semgrep honours nosemgrep only there or on the line directly above,
  // and inside a template literal a JS comment would be emitted as page text.
  // min-height is the shared 44px finger floor (--ui-size-target, styles/tokens.css):
  // the .btn padding alone made this a 32px target on a phone, and it is the one thing
  // on the page a signed-out visitor has to press.
  const action = linkSafe
    ? `<a class="btn btn--primary" href="${escape(href)}" style="display:inline-flex;align-items:center;justify-content:center;min-width:9rem;min-height:var(--ui-size-target)">${t('Sign in')}</a>` // nosemgrep: lolly-href-escape-is-not-scheme-validation - reached only when safeHref(href) passed; an unsafe loginPath drops the anchor and states why
    : `<p style="margin:0;color:hsl(var(--muted-foreground));font-size:.9rem">${t('This instance did not supply a usable sign-in link. Ask whoever runs it to check its configuration.')}</p>`;
  view.innerHTML = `
    <section class="org-gate" aria-label="${escape(t('Sign in'))}" style="min-height:70vh;display:flex;align-items:center;justify-content:center;padding:40px 20px">
      <div class="org-gate-card" style="width:100%;max-width:26rem;text-align:center;background:hsl(var(--card));color:hsl(var(--card-foreground));border:1px solid hsl(var(--border));border-radius:var(--radius);padding:2rem 1.75rem;box-shadow:0 26px 60px -30px hsl(var(--foreground) / .35)">
        <h1 style="margin:0 0 .5rem;font-size:1.4rem;font-weight:750;letter-spacing:-.01em">${heading}</h1>
        ${lines.map((line, i) => `<p style="margin:0 0 ${i === lines.length - 1 ? '1.5rem' : '.5rem'};color:hsl(var(--muted-foreground));font-size:.95rem;line-height:1.55">${line}</p>`).join('')}
        ${action}
        ${isTauriShell() ? '<div id="org-gate-device" style="margin-top:1.25rem"></div>' : ''}
      </div>
    </section>`;
  // Native shells get the device-code alternative: leaving the app shell to
  // ride a browser OIDC redirect is exactly what a webview cannot do well, so
  // the deployment's device flow (POST /api/v1/auth/device + /activate) signs
  // this shell in via any browser where the person already has a session.
  const slot = view.querySelector<HTMLElement>('#org-gate-device');
  if (slot) wireDeviceCodeSignIn(slot);
  // Local backups remain in authenticated Settings. A signed-out visitor cannot
  // establish custody of saved sessions or documents derived into templates/tools.
  return true;
}

// ── Device-code sign-in (native shells; the deployment's /activate flow) ─────

interface DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval?: number;
  expiresIn?: number;
}

/** Render + drive the device-code option inside the gate card. Additive and
 *  tolerant like everything in this seam: a deployment without the flow (404 /
 *  501 / no JSON) collapses the affordance to nothing after the first press. */
function wireDeviceCodeSignIn(slot: HTMLElement): void {
  const idle = (): void => {
    // The same 44px finger floor as the gate's Sign in: on a phone app this is the way in.
    slot.innerHTML = `<button type="button" class="btn" id="org-gate-device-btn" style="min-width:9rem;min-height:var(--ui-size-target)">${t('Sign in with a code on another device')}</button>`;
    slot.querySelector('#org-gate-device-btn')?.addEventListener('click', () => { void start(); });
  };

  const note = (msg: string, withRetry = false): void => {
    slot.innerHTML = `<p style="margin:0;color:hsl(var(--muted-foreground));font-size:.9rem">${msg}</p>`;
    if (withRetry) idleRetry();
  };
  const idleRetry = (): void => {
    const p = slot.querySelector('p');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.style.marginTop = '.75rem';
    btn.style.minHeight = 'var(--ui-size-target)';
    btn.textContent = t('Try again');
    btn.addEventListener('click', () => { void start(); });
    p?.insertAdjacentElement('afterend', btn);
  };

  async function start(): Promise<void> {
    note(t('Asking this instance for a code…'));
    const res = await safeFetch('/api/v1/auth/device', { method: 'POST' }, PROBE_TIMEOUT_MS * 4);
    const started = await jsonBody<DeviceStart>(res);
    if (!started?.deviceCode || !started.userCode || !started.verificationUri) {
      note(t('This instance does not offer code sign-in. Use the sign-in button instead.'));
      return;
    }
    // t() escapes interpolated params (same innerHTML-sink rule as the gate
    // heading above), so the server-supplied code + URL are safe here.
    slot.innerHTML = `
      <p style="margin:0 0 .35rem;font-size:.9rem;color:hsl(var(--muted-foreground))">${t('On any signed-in device, open {url} and enter:', { url: started.verificationUri })}</p>
      <p style="margin:0 0 .5rem;font-family:ui-monospace,monospace;font-size:1.6rem;letter-spacing:.12em">${escape(started.userCode)}</p>
      <p id="org-gate-device-status" style="margin:0;font-size:.85rem;color:hsl(var(--muted-foreground))">${t('Waiting for approval - the code lives about ten minutes.')}</p>`;
    const status = slot.querySelector<HTMLElement>('#org-gate-device-status');
    const intervalMs = Math.max(2, started.interval ?? 5) * 1000;
    const deadline = Date.now() + (started.expiresIn ?? 600) * 1000;

    const poll = async (): Promise<void> => {
      if (!slot.isConnected) return; // gate replaced (navigation) - stop quietly
      if (Date.now() > deadline) { note(t('That code expired.'), true); return; }
      const claim = await jsonBody<{ status: string; cookie?: string }>(
        await safeFetch('/api/v1/auth/device/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceCode: started.deviceCode }),
        }),
      );
      if (claim?.status === 'approved' && claim.cookie) {
        // Park the session pair for the Rust transport (instance.ts scopes it
        // to the instance origin), then reboot into the signed-in app.
        await setInstanceSession(claim.cookie);
        if (status) status.textContent = t('Signed in - loading…');
        location.reload();
        return;
      }
      if (claim?.status === 'denied') { note(t('That sign-in was denied from the other device.'), true); return; }
      if (claim?.status === 'expired') { note(t('That code expired.'), true); return; }
      setTimeout(() => { void poll(); }, intervalMs);
    };
    setTimeout(() => { void poll(); }, intervalMs);
  }

  idle();
}

// ── Account chip (header) ─────────────────────────────────────────────────────

/**
 * Put the account chip (org/account-chip.ts) in the header's account slot, for the
 * session `owner` (null: a visitor). Lazy, so the chip's module is not on the boot path;
 * a sign-out, a re-init or a later session replaces the chip. Everything the chip reads and
 * does is handed in here, so the chip module imports nothing from this one.
 */
function showAccountChip(auth: AuthConfig, owner: Session | null, principal: string | undefined): void {
  unregisterAccountChip?.();
  unregisterAccountChip = null;
  // A visitor's chip is only Sign in: with no way in there is nothing to show.
  if (!owner && !auth.loginPath) return;
  void import('./account-chip.ts').then((m) => {
    if (session !== owner || authState !== auth) return;
    unregisterAccountChip?.();
    unregisterAccountChip = m.registerAccountChip({
      account: orgProfileAccount,
      consoleUrl: orgConsoleUrl,
      signInUrl: () => {
        if (!auth.loginPath) return null;
        const href = loginUrl(auth.loginPath);
        return safeHref(href) ? href : null;
      },
      signOut: signOutOfInstance,
      signOutEverywhere,
      ...(principal ? { principal } : {}),
      workspaceOrigin: getInstanceBase() || location.origin,
    });
  }).catch(() => { /* additive; the header stands without it */ });
}

// ── Home view (org-config `home`) ─────────────────────────────────────────────

/** Whether this page load has had its one chance to open the instance's home view. */
let homeViewDecided = false;

/**
 * Open the member's Projects in place of the tools gallery when the instance asks
 * for it (`home: 'projects'`). Boot awaits this seam before its first navigate, so
 * the first view mounted is Projects and nothing paints twice. It acts once per page
 * load and only on the bare app address: a link to a tool, a team project, a view
 * or a search opens where it points, and later navigation (choosing Tools) is never
 * redirected. The history entry is replaced, so Back does not land on the
 * bare address and bounce again. A link that means Tools uses `#/tools`, never the
 * bare address, so it is not redirected either.
 */
function applyHomeView(config: OrgConfig | null): void {
  setHomeDestination(config?.home, config?.homeUrl);
  if (homeViewDecided) return;
  homeViewDecided = true;
  if (homeHref() === '/#/' || homeHref() === '/#/tools') return;
  try {
    // A reload, or Back/Forward to a page the browser did not keep in memory, returns
    // to a view the member was already on. The Tools tab's address is the bare `/#`,
    // so F5 on Tools must stay on Tools.
    const returning = performance.getEntriesByType('navigation')
      .some((entry) => 'type' in entry && (entry.type === 'reload' || entry.type === 'back_forward'));
    if (returning) return;
    const hash = location.hash;
    if ((hash && hash !== '#' && hash !== '#/') || location.search || appPathname() !== '/') return;
    const target = homeHref();
    if (target === '/' || target === location.href) return;
    if (target.startsWith('/#/')) history.replaceState(history.state, '', target);
    else location.replace(target);
  } catch { /* the gallery is a fine first view; never break boot over this */ }
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Initialise the org seam. Resolves:
 *   - `null` - no control plane (dormant): the shell proceeds exactly as today.
 *   - `OrgState` with `gate: true` - a sign-in gate was rendered; STOP boot.
 *   - `OrgState` with `gate: false` - control plane present, proceed to mount the
 *     app; any member profile policy has been applied and the inbox started.
 *
 * Tolerant by construction: any unexpected failure resolves to dormancy so this
 * optional seam can never block or break boot.
 */
export async function initOrg(): Promise<OrgState | null> {
  beginAiProbe();
  try {
    // Skip even the probe when this origin was recently seen to have no control
    // plane (module state already covers a single session; this covers reloads).
    if (!knownManagedAi() && isRecentlyAbsent()) { finishAiProbe(false); return null; }

    // Remember absence only on a definitive answer (see org/probe.ts's header):
    // a timeout or a 5xx is dormancy for this boot, not for the next six hours.
    const { auth, absent } = await probeInstance();
    if (!auth) { finishAiProbe(false); if (absent) rememberAbsent(); return null; }
    finishAiProbe(true);

    return await initOrgWithAuth(auth);
  } catch (e) {
    console.warn('[org] init failed - proceeding without a control plane', e);
    return null;
  }
}

/**
 * Everything initOrg does AFTER a control plane has answered the probe. Split out
 * so boot can run the probe from the org/probe.ts leaf and only load this module
 * when the answer was yes (plans/155 WP-3) - the dormant deployment never executes
 * a line of it. Same tolerance contract: it resolves, it does not throw to boot.
 */
export async function initOrgWithAuth(auth: AuthConfig): Promise<OrgState | null> {
  stopAiPolicyPolling();
  finishAiProbe(true);
  authState = auth;
  setAgentInviteAvailability(false, null);
  unregisterAccountChip?.();
  unregisterAccountChip = null;
  try {
    session = await fetchSession();
    const isMember = session?.kind === 'member';
    setAgentInviteAvailability(isMember, auth.documentAgentPath);
    // A session change must withdraw the previous member's fixed targets before
    // any early gate/return. A successful member load installs its fresh (or
    // bounded-cache) projection below.
    clearOrgDeliveryTargets();

    // Install identity (the covenant's device half): the per-device id joins
    // x-lolly-client exactly while a member session exists - so the org-config
    // fetch below is already a registering request - and never otherwise. An
    // anonymous or guest shell stays untagged; leaveInstance() forgets the id.
    if (isMember) {
      // Another account than the one this device last loaded for: what the last one left
      // here is not this person's (plan 75 G17).
      const before = cachedMemberSub();
      if (before && session?.kind === 'member' && before !== session.user.sub) await forgetTeamOrigins();
      try { localStorage.removeItem(signedOutKey()); } catch { /* storage unavailable */ }
      try { setInstallTag(await ensureInstallId()); } catch { /* untagged is always safe */ }
    } else {
      setInstallTag(null);
    }

    // Gated instance, not a member → sign-in gate instead of the app.
    if (auth.mode === 'gated' && !isMember) {
      renderGate(auth, workspaceName() || undefined);
      // Signed out of a gated instance: no catalog or tool reads until sign-in
      // (which reloads). A missing view or sign-in link must not let boot proceed.
      noteCatalogRefused();
      return { auth, session, config: null, gate: true };
    }

    // Member → load org-config, apply its profile policy, surface the inbox.
    if (isMember) {
      const load = await fetchOrgConfig();
      startAiPolicyPolling(load.ok ? load.config.ai : undefined);
      // Resilient-cache resolution. A fresh (or in-session 304) load governs directly.
      // A failed load (the present control plane is unreachable this boot) falls back to
      // the last good copy while it is still within ORG_CONFIG_TTL_MS; past the TTL - or
      // with no cached copy at all - we do NOT trust stale policy, and gated surfaces
      // fail CLOSED instead (never open).
      let failClosed = false;
      if (load.ok) {
        orgConfigState = load.config;
      } else {
        const cached = readCachedOrgConfig();
        if (cached) {
          orgConfigState = cached;                       // honour a still-fresh cached policy
        } else {
          orgConfigState = null;                         // governed, but currently unknowable
          failClosed = true;
        }
      }
      // Before boot's first navigate reads the address: the instance's home view.
      applyHomeView(orgConfigState);
      applyProfilePolicy(orgConfigState);
      // Populate the generic export-policy seam (download vs. request-approval) from
      // the caller's capability bits + per-tool approval chains, and register the
      // approval-request opener. The opener lazy-imports the dialog only when a member
      // actually requests approval, keeping it out of the boot chunk. Both are
      // dormant-safe: a member whose instance withholds nothing downloads exactly as
      // today, and the opener is only ever reached via the export-policy affordance.
      // When failing closed, both the export seam and the input overlay clamp to the
      // more restrictive state rather than falling open.
      applyExportPolicy(orgConfigState, failClosed);
      applyInputFailClosed(failClosed);
      applySitePolicy(orgConfigState, failClosed);
      // Route the instance's injectables (plans/19): tool descriptors into the
      // gallery registry (pure data, beside the apply* group); chrome descriptors
      // are DOM-mounted lazily after emit() below. Dormant when the list is absent.
      applyInjectables(orgConfigState);
      applyOrgDeliveryTargets(
        orgConfigState?.destinations,
        orgConfigState?.instance?.name || t('your organisation'),
      );
      // Install the mounted tool's input policy on each mount, through the generic
      // lib/input-policy.ts mount hook. If a tool is already open the hook runs
      // for it at once, so a member whose org-config arrived after the tool view
      // is governed too.
      unregisterToolMount?.();
      unregisterToolMount = onToolInputMount(() => applyOrgToolPolicies());
      unregisterApprovalOpener?.();
      unregisterApprovalOpener = registerApprovalOpener((rctx) => {
        import('./approval-dialog.ts')
          .then((m) => m.openApprovalDialog(rctx))
          .catch(() => { /* additive; never break the caller */ });
      });
      // "Submit to <workspace>" on the member's own uploads, templates and tools,
      // through the generic lib/catalog-submit.ts seam. `accepts` reads the live
      // org-config, so the action follows a changed `can['catalog.submit']`; the
      // dialog's module loads only when someone opens the dialog.
      unregisterCatalogSubmitter?.();
      unregisterCatalogSubmitter = registerCatalogSubmitter({
        label: () => (workspaceName() ? tRaw('Submit to {name}', { name: workspaceName() }) : t('Submit to the catalog')),
        accepts: () => orgConfig()?.can?.['catalog.submit'] === true,
        open: (subject) => {
          import('./catalog-submit.ts')
            .then((m) => m.openCatalogSubmitDialog(subject, workspaceName()))
            .catch(() => { /* additive; never break the caller */ });
        },
      });
      // Offer instance-hosted links in the Share dialog. Registered through the
      // generic lib/share-sections.ts seam (so the dialog stays control-plane-
      // unaware), with the heavy builder module lazy-imported only when a member
      // actually opens the dialog. The builder self-gates on the caller's `can`
      // bits, so registering for every member is safe - it renders nothing for a
      // member without link permissions.
      unregisterShareSection?.();
      unregisterShareSection = registerShareSection(async (sctx) => {
        const cfg = orgConfig();
        if (!cfg) return null;
        const { buildInstanceShareSection } = await import('./share-links.ts');
        return buildInstanceShareSection(sctx, cfg);
      });
      // Surface the instance's shared team projects in the Projects view, through
      // the generic lib/session-source.ts seam (so the view stays control-plane-
      // unaware). Pure data - opening a session lives in org/team-open.ts, loaded only
      // when someone opens one. The write half reads this org-config live for the
      // project-creation options (can['project.create'], sharing.groups).
      unregisterSessionSource?.();
      unregisterSessionSource = registerSessionSource(
        createInstanceSessionSource(orgConfigState?.instance?.name || t('your organisation'), () => orgConfig(),
          createSourceFiles(() => (session?.kind === 'member' ? session.user.sub : 'none'))),
      );
      // The signed-in member's linked sign-ins, as a card in the profile view's
      // instance section, through the generic lib/profile-sections.ts seam (so the
      // view stays control-plane-unaware). The card's module loads only when shown.
      unregisterProfileSection?.();
      unregisterProfileSection = registerProfileSection((into) => { mountOrgAccount(into); });
      // Save the document on screen to a team project, save changes back to the team
      // session it came from, and copy its #/team/<id> link: a "Team" section in the
      // Share dialog, through the same generic seam as "On this instance" above. It
      // renders nothing unless the source just registered can write. It sits above the
      // dialog's own link rows, and first among the extra sections: on an instance,
      // saving to a team project is the main way to share with teammates.
      // The builder module loads once, early when idle for a member who can write, and
      // is kept: from then on the builder returns its node directly, so the section is
      // laid out with the rest of the surface. The docked Share panel rebuilds that
      // surface on every edit, and a lead section arriving a frame late would push the
      // panel's content down each time.
      unregisterTeamShareSection?.();
      unregisterTeamShareSection = registerShareSection((sctx) => {
        if (!getSessionWriter()) return null;
        // The live org-config reader, handed in so team-save.ts needs no import of
        // this module (a load-order cycle the maintainability budget refuses).
        if (teamSaveModule) return teamSaveModule.buildTeamShareSection(sctx, orgConfig);
        return loadTeamSave().then((m) => m.buildTeamShareSection(sctx, orgConfig));
      }, { order: -10, placement: 'lead' });
      if (getSessionWriter()) whenIdle(() => { loadTeamSave().catch(() => { /* loaded again when the dialog opens */ }); });
      // Instance-mediated "nearby" (plans/26 section 8): register the `'org'` provider when
      // this instance grants `collab.nearby` (enabled policy ∩ collab.join). Absent
      // ⇒ NO registration, so a plain build or an instance without the bit stays
      // byte-identical. Replaced (not stacked) on re-init, and dropped on reset.
      unregisterNearbySource?.();
      unregisterNearbySource = null;
      if (orgConfigState?.can?.['collab.nearby'] === true) {
        unregisterNearbySource = registerNearbyProvider(createOrgNearbyProvider());
      }
      // Offer live co-editing on this instance's sessions (plan 100 section 7, wave 3.1),
      // through the factory seam in org/collab-provider.ts. Gated on the caller's
      // `collab.join` capability bit - read inline here rather than through
      // org/collab-config.ts's `canJoinCollab()` (the same test, and the accessor
      // every consumer OUTSIDE this module should use) only because that module
      // imports this one, and the gate belongs beside the state it reads. A
      // factory creates each session's provider when its tool opens. The client
      // remains lazy on an instance without a live gateway or join capability.
      unregisterCollabFactory?.();
      unregisterCollabFactory = null;
      unregisterCollabOpener?.();
      unregisterCollabOpener = null;
      // The PRINCIPAL, captured HERE rather than read inside the async callback: it
      // is the partition key of the provider's durable outbox, and the 'profile' KV
      // store that outbox lives in is origin-wide, shared by everyone who signs into
      // this browser. Without it, one user's undelivered ops replay over the NEXT
      // user's authenticated socket and the gateway audits them as that user's edits.
      const principal = session?.kind === 'member' ? session.user.sub : undefined;
      const memberSession = session;
      const stillAllowed = (): boolean => session === memberSession && orgConfig()?.can?.['collab.join'] === true;
      if (orgConfigState?.can?.['collab.join'] === true) {
        import('./collab-provider.ts')
          .then(async (m) => {
            // The per-device client id must be durable before any provider is built
            // (two clients on the wire from one device is the failure it prevents).
            await m.initWorkCollab();
            // Policy (or the session) may have changed while this loaded.
            if (!stillAllowed()) return;
            unregisterCollabFactory = m.registerWorkCollabFactory(
              (sid, o) => m.createWorkCollabProvider(sid, { ...o, principal: o?.principal ?? principal }),
            );
            // …and the `'work'` opener that consumes it, registered AFTER the factory
            // so the chain is complete the moment the row can be pressed. It is what
            // turns the "Work collab" Share row on (the row is gated on an opener
            // existing), and the same module carries the inbox invite affordance that
            // org/banner.ts lazy-loads. The opener re-checks the caller's capability
            // bits on every press - this registration is an instance fact, not a
            // per-member grant.
            const opener = await import('./collab-work-opener.ts');
            if (!stillAllowed()) return;
            unregisterCollabOpener?.();
            unregisterCollabOpener = opener.registerWorkCollabOpener();
            const automatic = await import('./collab-auto-join.ts');
            if (!stillAllowed()) return;
            const stopOpener = unregisterCollabOpener;
            const stopAutomatic = automatic.registerAutomaticWorkCollab({
              canJoin: stillAllowed, join: opener.openWorkCollab,
            });
            const stopJoining = (): void => { stopAutomatic(); stopOpener?.(); };
            unregisterCollabOpener = stopJoining;
            // "Invite to edit now" lives on the live collab's presence pill
            // (org/collab-invite.ts through lib/collab-pill-invite.ts). The Share dialog's
            // "Work collab" row that used to carry it, beside its own "Start a collab",
            // is no longer registered (plan 75 G10): a team document joins its live collab
            // when it opens (org/collab-auto-join.ts), so a second start button on it was
            // a duplicate of the Private collab row's and refused whenever it was pressed.
            const invite = await import('./collab-invite.ts');
            if (!stillAllowed() || unregisterCollabOpener !== stopJoining) return;
            const stopInvite = invite.registerWorkCollabPillInvite();
            unregisterCollabOpener = () => { stopInvite(); stopJoining(); };
          })
          .catch(() => { /* additive; never block or break boot */ });
      }
      emit();
      // The inbox, for every member: it refetches when the tab comes back and while it
      // is visible, so a request, an answer or a welcome arrives without a reload, and
      // it mounts the banner itself. Lazy - the inbox, the banner and their modal stay
      // out of the boot chunk. It fetches at once only when the org-config counted
      // unread messages; otherwise when the tab comes back or its first poll is due.
      inboxLoad = import('./inbox.ts');
      inboxLoad
        .then((m) => {
          if (session !== memberSession) return;
          inboxModule = m;
          m.startInbox({ initialUnread: Math.max(0, Number(orgConfigState?.inboxUnread) || 0), principal, review: () => orgProfileAccount()?.inbox?.open() });
          void import('./banner.ts').then((banner) => { if (session === memberSession) banner.attachBanner(); }).catch(() => {});
        })
        .catch(() => { /* the inbox is additive; never block or break boot */ });
      // Array.isArray guards a malformed (non-array) injectables value - a `.some`
      // on a non-array would throw and abort the branch (never break boot).
      if (Array.isArray(orgConfigState?.injectables) && orgConfigState.injectables.some((d) => d?.kind === 'chrome')) {
        // Lazy, exactly like the banner: the chrome renderer stays out of the boot
        // chunk and loads only when the instance actually injects some chrome.
        const chrome = orgConfigState.injectables.filter((d): d is ChromeInjectable => d?.kind === 'chrome');
        import('./chrome.ts')
          .then((m) => m.mountOrgChrome(chrome))
          .catch(() => { /* chrome is additive; never block or break boot */ });
      }
      // Who is signed in, in the header: the account chip and its menu (plan 75 G5).
      showAccountChip(auth, memberSession, principal);
    } else if (!session) {
      // A visitor on a workspace that lets them in without signing in: the chip is Sign in.
      showAccountChip(auth, null, undefined);
    }

    return { auth, session, config: orgConfigState, gate: false };
  } catch {
    // Absolute backstop: this seam is additive - a bug here must not break boot.
    return null;
  }
}

// ── localStorage negative cache (best-effort; never breaks the dormant path) ──

// ── Resilient org-config cache (best-effort; makes a control-plane outage a non-event) ─

/** One stored org-config record, keyed by instance base. */
interface CachedOrgConfig { at: number; etag: string | null; config: OrgConfig }

/** Persist a successfully-fetched org-config (and its ETag) so a later boot whose
 *  refetch fails can stand on it within ORG_CONFIG_TTL_MS. Best-effort - a storage
 *  error is swallowed (the live copy still governs this session). */
function rememberOrgConfig(config: OrgConfig, etag: string | null): void {
  try {
    const rec: CachedOrgConfig = { at: Date.now(), etag, config };
    localStorage.setItem(orgConfigKey(), JSON.stringify(rec));
  } catch { /* storage unavailable - nothing to fall back on later, that's fine */ }
}

/** The cached org-config when one is stored, well-formed, and still within the freshness
 *  TTL - else null (stale or past-TTL copies are never served, and an expired one is
 *  evicted). Restores the ETag alongside, so a subsequent conditional request is warm. */
function readCachedOrgConfig(): OrgConfig | null {
  try {
    const raw = localStorage.getItem(orgConfigKey());
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<CachedOrgConfig>;
    const at = Number(rec?.at);
    if (!Number.isFinite(at) || Date.now() - at >= ORG_CONFIG_TTL_MS) {
      localStorage.removeItem(orgConfigKey());          // past the TTL - drop, never serve stale
      return null;
    }
    const config = rec.config;
    if (!config || typeof config.instance?.name !== 'string') return null;
    orgConfigEtag = rec.etag ?? orgConfigEtag;
    return config;
  } catch {
    return null; // unreadable / malformed cache - behave as if there were none
  }
}

/** TEST-ONLY: reset module state between cases. */
export function _resetOrgForTests(): void {
  stopAiPolicyPolling();
  setInstallTag(null);
  session = null;
  authState = null;
  setHomeDestination();
  setAgentInviteAvailability(false, null);
  inboxModule?._resetInboxForTests();
  inboxModule = null;
  inboxLoad = null;
  orgConfigState = null;
  orgConfigEtag = null;
  homeViewDecided = false;
  listeners.clear();
  unregisterShareSection?.();
  unregisterShareSection = null;
  unregisterApprovalOpener?.();
  unregisterApprovalOpener = null;
  unregisterCatalogSubmitter?.();
  unregisterCatalogSubmitter = null;
  unregisterSessionSource?.();
  unregisterSessionSource = null;
  unregisterTeamShareSection?.();
  unregisterTeamShareSection = null;
  unregisterProfileSection?.();
  unregisterProfileSection = null;
  unregisterNearbySource?.();
  unregisterNearbySource = null;
  unregisterCollabFactory?.();
  unregisterCollabFactory = null;
  unregisterCollabOpener?.();
  unregisterCollabOpener = null;
  unregisterAccountChip?.();
  unregisterAccountChip = null;
  unregisterToolMount?.();
  unregisterToolMount = null;
  clearOrgDeliveryTargets();
  clearInputPolicies();
  setInputPolicyFailClosed(null);
  setExportPolicy(undefined);
}
