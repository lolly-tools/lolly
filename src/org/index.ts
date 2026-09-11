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
 *      then surfaces any unread inbox messages as a single banner.
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
import { setFieldPolicies } from '../lib/field-policy.ts';
import { beginAiProbe, finishAiProbe, knownManagedAi, startAiPolicyPolling, stopAiPolicyPolling } from './ai-policy.ts';
import type { AiPolicy } from '../lib/ai-policy.ts';
import type { FieldPolicy } from '../lib/field-policy.ts';
import { setToolInputPolicies, clearInputPolicies, setInputPolicyFailClosed } from '../lib/input-policy.ts';
import type { InputPolicy } from '../lib/input-policy.ts';
import { registerShareSection } from '../lib/share-sections.ts';
import { setExportPolicy } from '../lib/export-policy.ts';
import { registerApprovalOpener } from '../lib/approval-request.ts';
import { registerSessionSource } from '../lib/session-source.ts';
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
import { PROBE_TIMEOUT_MS, isRecentlyAbsent, jsonBody, probeAuthConfig, rememberAbsent, safeFetch } from './probe.ts';
// Import from the LEAF module, not the '@lolly/engine' barrel: org/index.ts is on the boot
// static-import chain (jelly → feature-flags → org), so a barrel import drags the whole
// engine (render/c2pa/handlebars/ajv, ~555KB) onto first paint. tool-url.ts only pulls the
// tiny embed.ts leaf. (Same direct-import pattern the bridge/* modules use.)
import { parseToolUrl } from '../../../../engine/src/tool-url.ts';
import { createInstanceSessionSource } from './session-source.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { t, tRaw } from '../i18n.ts';
import { escape, safeHref } from '../utils.ts';

// ── Contract types (the server product's documented shapes) ───────────────────

export interface AuthConfig {
  mode: 'open' | 'gated' | 'per-tool';
  provider: 'oidc' | 'dev' | 'proxy' | null;
  loginPath: string | null;
}

export interface OrgUser {
  sub: string;
  email?: string;
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
let orgConfigState: OrgConfig | null = null;
/** Last org-config ETag, for the conditional request (module-state cache). */
let orgConfigEtag: string | null = null;
const listeners = new Set<(config: OrgConfig | null) => void>();
/** Unregister for the Share-dialog "On this instance" section, so a re-init doesn't
 *  stack a second builder onto the generic share-sections registry. */
let unregisterShareSection: (() => void) | null = null;
/** Unregister for the approval-request opener, so a re-init replaces rather than
 *  leaks the previous registration. */
let unregisterApprovalOpener: (() => void) | null = null;
let unregisterSessionSource: (() => void) | null = null;
/** Unregister for the `'org'` nearby provider (plans/26 section 8), so a re-init replaces
 *  rather than stacks it. Registered only when the instance grants `collab.nearby`. */
let unregisterNearbySource: (() => void) | null = null;
/** Unregister for the work-collab factory (plan 100 wave 3.1), so a re-init replaces
 *  rather than stacks the registration. Null whenever the instance does not grant
 *  `collab.join` - which is every instance until the server ships the bits. */
let unregisterCollabFactory: (() => void) | null = null;
/** Unregister for the Share-dialog "Work collab" section (plan 100 section 7 item 9,
 *  wave 3.1), so a re-init replaces rather than stacks the registration onto the
 *  generic share-sections registry - same reasoning as unregisterShareSection
 *  above, kept as its own handle because the two sections are independent rows. */
let unregisterCollabShareSection: (() => void) | null = null;
/** Unregister for the `'work'` collab opener (plan 100 section 7 item 9, wave 3.3) - the
 *  thing that makes the Share row above render at all, since the row is gated on an
 *  opener existing. Same last-wins reasoning as the handles above. */
let unregisterCollabOpener: (() => void) | null = null;

/** How long a successfully-fetched org-config may stand in for a live one when the
 *  (present) control plane can't be reached on a later boot - a bounded freshness
 *  window so a control-plane outage is a non-event, not a fleet-wide policy drop.
 *  Past it, stale policy is discarded and gated actions fail closed rather than
 *  trusting an old copy indefinitely. */
const ORG_CONFIG_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const orgConfigKey = (): string => `lolly:org-config:${getInstanceBase() || 'same-origin'}`;

// ── Accessors + subscription (the tiny surface other code may consult) ────────

/** The active org-config, or null when dormant / not a member. */
export function orgConfig(): OrgConfig | null {
  return orgConfigState;
}

/** The resolved session, or null (dormant, or a 401/no-session control plane). */
export function orgSession(): Session | null {
  return session;
}

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
 * Populate the generic src/lib/input-policy.ts registry for one tool from the
 * control plane's per-tool declaration, translating it into neutral InputPolicy
 * entries. A locked/choice input gets the localised "Managed by <instance>" note
 * here (the registry itself stays product-neutral); `hidden` ids win over any
 * access rule for the same input.
 *
 * Always clears the registry first, so this both installs the mounted tool's policy
 * and drops any previous tool's. A dormant no-op when there is no control plane or
 * no declaration for this tool - the sidebar then renders exactly as today. Called
 * by the tool view when a tool mounts.
 */
export function applyOrgToolPolicies(toolId: string): void {
  clearInputPolicies();
  const spec = orgConfigState?.tools?.[toolId];
  if (!spec) return;
  const instanceName = orgConfigState!.instance?.name || '';
  const managedNote = instanceName
    ? tRaw('Managed by {name}', { name: instanceName })
    : t('Managed by your organisation');
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
 *  returnTo=<the URL the visitor asked for>. */
function loginUrl(loginPath: string): string {
  const returnTo = location.pathname + location.search + location.hash;
  const base = instancePath(loginPath);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Render a minimal sign-in gate into #view, in the shell's visual language. All
 * strings localised; the primary action is a plain link to the login URL, so it
 * behaves like any navigation (open-in-tab, etc.). Returns true when the gate
 * was shown (boot should stop), false when it could not be (no loginPath).
 */
function renderGate(auth: AuthConfig, instanceName?: string): boolean {
  const view = document.getElementById('view');
  if (!view) return false;
  if (!auth.loginPath) return false; // gated but no way in - misconfigured; let boot proceed
  // loginPath comes from the control plane's /api/auth/config, and instancePath
  // passes a non-http(s) value straight through when there is no instance base - 
  // so a javascript: loginPath would otherwise reach an href. Same guard, same
  // reasoning as banner.ts/chrome.ts: escaping is not scheme validation.
  //
  // A rejected href must NOT abandon the gate. Returning false here would mean
  // "no gate was rendered", and the caller then lets boot proceed - turning a
  // hostile loginPath into an authentication BYPASS on a gated instance, which is
  // far worse than the XSS the guard exists to stop. So the gate still renders and
  // still blocks; only the button is dropped, exactly as chrome.ts drops a link
  // and keeps its text.
  const href = loginUrl(auth.loginPath);
  const linkSafe = safeHref(href);
  // t() HTML-escapes interpolated params (see i18n.ts), so the instance name is
  // safe in this innerHTML sink. Do NOT switch this to tRaw without escaping it.
  const heading = instanceName
    ? t('Sign in to {name}', { name: instanceName })
    : t('Sign in to continue');
  document.title = `${t('Sign in')} - Lolly`;
  // Built here rather than inline so the suppression can sit on the sink's own
  // line - semgrep honours nosemgrep only there or on the line directly above,
  // and inside a template literal a JS comment would be emitted as page text.
  const action = linkSafe
    ? `<a class="btn btn--primary" href="${escape(href)}" style="display:inline-flex;align-items:center;justify-content:center;min-width:9rem">${t('Sign in')}</a>` // nosemgrep: lolly-href-escape-is-not-scheme-validation - reached only when safeHref(href) passed; an unsafe loginPath drops the anchor and states why
    : `<p style="margin:0;color:hsl(var(--muted-foreground));font-size:.9rem">${t('This instance did not supply a usable sign-in link. Ask whoever runs it to check its configuration.')}</p>`;
  view.innerHTML = `
    <section class="org-gate" aria-label="${escape(t('Sign in'))}" style="min-height:70vh;display:flex;align-items:center;justify-content:center;padding:40px 20px">
      <div class="org-gate-card" style="width:100%;max-width:26rem;text-align:center;background:hsl(var(--card));color:hsl(var(--card-foreground));border:1px solid hsl(var(--border));border-radius:var(--radius);padding:2rem 1.75rem;box-shadow:0 26px 60px -30px hsl(var(--foreground) / .35)">
        <h1 style="margin:0 0 .5rem;font-size:1.4rem;font-weight:750;letter-spacing:-.01em">${heading}</h1>
        <p style="margin:0 0 1.5rem;color:hsl(var(--muted-foreground));font-size:.95rem;line-height:1.55">${t('This Lolly instance asks you to sign in before you continue.')}</p>
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
    slot.innerHTML = `<button type="button" class="btn" id="org-gate-device-btn" style="min-width:9rem">${t('Sign in with a code on another device')}</button>`;
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

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Initialise the org seam. Resolves:
 *   - `null` - no control plane (dormant): the shell proceeds exactly as today.
 *   - `OrgState` with `gate: true` - a sign-in gate was rendered; STOP boot.
 *   - `OrgState` with `gate: false` - control plane present, proceed to mount the
 *     app; any member profile policy + inbox banner have been applied.
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

    const auth = await probeAuthConfig();
    if (!auth) { finishAiProbe(false); rememberAbsent(); return null; }
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
  try {
    session = await fetchSession();
    const isMember = session?.kind === 'member';
    // A session change must withdraw the previous member's fixed targets before
    // any early gate/return. A successful member load installs its fresh (or
    // bounded-cache) projection below.
    clearOrgDeliveryTargets();

    // Install identity (the covenant's device half): the per-device id joins
    // x-lolly-client exactly while a member session exists - so the org-config
    // fetch below is already a registering request - and never otherwise. An
    // anonymous or guest shell stays untagged; leaveInstance() forgets the id.
    if (isMember) {
      try { setInstallTag(await ensureInstallId()); } catch { /* untagged is always safe */ }
    } else {
      setInstallTag(null);
    }

    // Gated instance, not a member → sign-in gate instead of the app.
    if (auth.mode === 'gated' && !isMember) {
      const gated = renderGate(auth);
      if (gated) return { auth, session, config: null, gate: true };
      // Could not render a gate (no loginPath) - fall through and let the app mount.
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
      // Route the instance's injectables (plans/19): tool descriptors into the
      // gallery registry (pure data, beside the apply* group); chrome descriptors
      // are DOM-mounted lazily after emit() below. Dormant when the list is absent.
      applyInjectables(orgConfigState);
      applyOrgDeliveryTargets(
        orgConfigState?.destinations,
        orgConfigState?.instance?.name || t('your organisation'),
      );
      unregisterApprovalOpener?.();
      unregisterApprovalOpener = registerApprovalOpener((rctx) => {
        import('./approval-dialog.ts')
          .then((m) => m.openApprovalDialog(rctx))
          .catch(() => { /* additive; never break the caller */ });
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
      // unaware). Pure data - the view owns opening a team session, reusing its own
      // engine URL reconstruction, so no engine/DOM concern leaks in here.
      unregisterSessionSource?.();
      unregisterSessionSource = registerSessionSource(
        createInstanceSessionSource(orgConfigState?.instance?.name || t('your organisation')),
      );
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
      // imports this one, and the gate belongs beside the state it reads. ABSENT
      // means NO registration - the
      // server ships these bits later, so every instance today reads as absent and
      // the seam stays dormant, byte-identical to a build without this branch.
      // A FACTORY, not a provider: a collab is per-session and nothing here can yet
      // know a mount came from a team project - that last wire is the wave-1
      // integration, documented in collab-provider.ts's header. Lazy-imported, so
      // the ws client never reaches the boot chunk of an instance without the bit.
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
      if (orgConfigState?.can?.['collab.join'] === true) {
        import('./collab-provider.ts')
          .then(async (m) => {
            // The per-device client id must be durable before any provider is built
            // (two clients on the wire from one device is the failure it prevents).
            await m.initWorkCollab();
            // Policy (or the session) may have changed while this loaded.
            if (orgConfig()?.can?.['collab.join'] !== true) return;
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
            unregisterCollabOpener?.();
            unregisterCollabOpener = opener.registerWorkCollabOpener();
          })
          .catch(() => { /* additive; never block or break boot */ });
      }
      // Offer a "Work collab" row in the Share dialog (plan 100 section 7 item 9, wave
      // 3.1 - the row + gating only; the ceremony/join UI that actually starts a
      // work collab is a later wave). Registered through the same generic
      // lib/share-sections.ts seam as "On this instance" above, with the row's
      // builder module lazy-imported only when a member opens the dialog on an
      // instance that grants `collab.join` - the same inline-`can` bail (and the
      // same reasoning) as the collab-factory registration just above. The
      // builder itself re-checks canJoinCollab() plus a registered 'work' opener
      // (lib/collab-launch.ts) - nothing registers one yet, so the row stays
      // absent everywhere until a later wave lands the ceremony UI.
      unregisterCollabShareSection?.();
      unregisterCollabShareSection = registerShareSection(async (sctx) => {
        if (orgConfigState?.can?.['collab.join'] !== true) return null;
        const { buildWorkCollabShareSection } = await import('./collab-share.ts');
        return buildWorkCollabShareSection(sctx);
      });
      emit();
      if ((orgConfigState?.inboxUnread ?? 0) > 0) {
        // Lazy - the banner (and its modal dep) stay out of the boot chunk, and
        // load only for the rare member with unread messages.
        import('./banner.ts')
          .then((m) => m.mountOrgBanner())
          .catch(() => { /* banner is additive; never block or break boot */ });
      }
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
  orgConfigState = null;
  orgConfigEtag = null;
  listeners.clear();
  unregisterShareSection?.();
  unregisterShareSection = null;
  unregisterApprovalOpener?.();
  unregisterApprovalOpener = null;
  unregisterSessionSource?.();
  unregisterSessionSource = null;
  unregisterNearbySource?.();
  unregisterNearbySource = null;
  unregisterCollabFactory?.();
  unregisterCollabFactory = null;
  unregisterCollabShareSection?.();
  unregisterCollabShareSection = null;
  unregisterCollabOpener?.();
  unregisterCollabOpener = null;
  clearOrgDeliveryTargets();
  clearInputPolicies();
  setInputPolicyFailClosed(null);
  setExportPolicy(undefined);
}
