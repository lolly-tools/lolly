// SPDX-License-Identifier: MPL-2.0
/**
 * The /profile "Connected services" section (plans/129): where an individual
 * connects their OWN providers - and where the custody choice lives. Every
 * send is client → provider directly; what this section manages is only what
 * is remembered ON THIS DEVICE:
 *
 *   - OAuth providers (Dropbox, OneDrive, and on the desktop Google Drive and
 *     LinkedIn): Connect runs the grant - a popup on the web, the person's own
 *     system browser with a loopback return in the Tauri shells - and the
 *     "stay connected on this device" checkbox decides whether the refresh
 *     token is stored at rest (lib/provider-connections.ts - excluded from
 *     portable backups, wiped by Disconnect and by Clear-all). Unchecked =
 *     session-only, tokenless at rest.
 *   - Google Drive keeps its deliberate session-only stance (implicit grant,
 *     no refresh token exists): the row says it signs in at send time.
 *   - Credential providers (S3 bucket, Nextcloud/WebDAV): the user's own
 *     endpoint + keys, entered here, stored device-local, testable in place.
 *
 * OAuth rows appear only when their client id is configured on this deploy
 * (the dormant rule); the credential rows always exist - they need nobody's
 * app registration.
 *
 * A provider the user switched off in Feature flags (CONNECTOR_FLAGS) loses its
 * row here as well as its send button, with a one-line note naming what is
 * hidden - a missing Drive row with no explanation reads as a bug.
 */

import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import {
  driveAvailable, connectDriveDesktop, disconnectDriveDesktop,
  connectDriveWeb, disconnectDriveWeb, driveNativeAvailable,
} from '../lib/google-drive.ts';
import { BROWSER_SIGN_IN_KINDS, mobileSignInReady } from '../lib/mobile-sign-in.ts';
import { MOBILE_REDIRECT_URI } from '../lib/provider-auth.ts';
import { isTauriShell, isTauriMobileShell } from '../lib/instance-choice.ts';
import { dropboxAvailable, connectDropbox, disconnectDropbox } from '../lib/dropbox-send.ts';
import {
  oneDriveAvailable, oneDriveDesktopAvailable, oneDriveMobileAvailable, connectOneDrive, connectOneDriveDesktop,
  disconnectOneDrive,
} from '../lib/onedrive-send.ts';
import { linkedInAvailable, connectLinkedIn, disconnectLinkedIn } from '../lib/linkedin-send.ts';
import { connectS3, disconnectS3, testS3, type S3Config } from '../lib/s3-send.ts';
import { connectWebdav, disconnectWebdav, testWebdav, type WebdavConfig } from '../lib/nextcloud-send.ts';
import { connectPenpot, disconnectPenpot, testPenpot } from '../lib/penpot-send.ts';
import { connectMastodon, disconnectMastodon } from '../lib/mastodon-send.ts';
import { connectBluesky, disconnectBluesky, testBluesky, type BlueskyConfig } from '../lib/bluesky-send.ts';
import { connectDiscord, disconnectDiscord, testDiscord } from '../lib/discord-send.ts';
import { listConnections, type ProviderConnection } from '../lib/provider-connections.ts';
import { isExportHomeKind } from '../lib/export-home.ts';
import { CONNECTOR_FLAGS, connectorEnabled } from '../feature-flags.ts';
import { serviceMark } from '../lib/service-marks.ts';
import { COLLAPSE_CHEV, groupSummaryRow } from './profile/shared.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

type ConnHost = HostV1 & { profile: { get(): Promise<Profile>; set(p: Profile): Promise<void> } };

const OAUTH_ROWS: Array<{
  kind: string;
  label: () => string;
  scopesNote: () => string;
  available: () => boolean;
  connect: (persist: boolean) => Promise<string>;
  disconnect: () => Promise<void>;
  /** Extra markup inside the disconnected row - the bring-your-own-app-key form
   *  for a deploy that registered no app of its own. */
  setup?: () => string;
}> = [
  {
    // Desktop (plans/129 WP4): system-browser sign-in + refresh custody.
    // Web (plans/138 Tier D, WP-P3): the session-only popup grant, plus a
    // connection record so Drive can be the sync home, and a bring-your-own
    // client id for a deploy that registered none. The web row always exists,
    // like Dropbox's.
    kind: 'gdrive',
    label: () => t('Google Drive'),
    scopesNote: () => (isTauriShell()
      ? t('Signs in through your own browser. Lolly can only see files it created.')
      : t('Lolly can only see files it created. In the browser, the sign-in lasts for one visit, so automatic sync with Drive starts after you sign in.')),
    available: () => (isTauriShell() ? driveNativeAvailable() : true),
    connect: (persist) => (isTauriShell() ? connectDriveDesktop(persist) : connectDriveWeb(persist)),
    disconnect: () => (isTauriShell() ? disconnectDriveDesktop() : disconnectDriveWeb()),
    setup: () => (isTauriShell() || driveAvailable()) ? '' : `
      ${field('clientId', t('Client ID'), '', 'text', '…apps.googleusercontent.com')}
      <p class="pconn-note">${t('This site ships no Google app, so connect with your own. In Google Cloud: create a project, turn on the Google Drive API, set the OAuth consent screen to External and add yourself as a test user, then create an OAuth client of type Web application with {origin} as an authorised JavaScript origin and {redirect} as an authorised redirect URI. Paste its Client ID above. It is kept with the connection in this browser.', { origin: location.origin, redirect: `${location.origin}/oauth-return.html` })}</p>`,
  },
  {
    kind: 'dropbox',
    label: () => t('Dropbox'),
    scopesNote: () => t('Can only see the Lolly app folder in your Dropbox.'),
    // The row always exists (plans/129 WP4b). No deploy registration does NOT
    // hide it - the individuals who rely on Dropbox get no say in their deploy's
    // env - so it falls back to the bring-your-own app key below, on the desktop
    // as well as the web: Dropbox exempts localhost redirect URIs from
    // registration, so the desktop's system-browser sign-in needs nothing added
    // to the app either.
    available: () => true,
    connect: connectDropbox,
    disconnect: disconnectDropbox,
    setup: () => dropboxAvailable() ? '' : `
      ${field('clientId', t('App key'), '', 'text', '')}
      <p class="pconn-note">${isTauriMobileShell()
        ? t('This app has no Dropbox app for phones, so connect with your own: create an app in the Dropbox App Console (scoped access, App folder type), add {redirect} as a redirect URI, and paste its App key above. It is kept with the connection on this device.', { redirect: MOBILE_REDIRECT_URI })
        : isTauriShell()
        ? t('This build ships no Dropbox app, so connect with your own: create an app in the Dropbox App Console (scoped access, App folder type) and paste its App key above. No redirect URI needs registering - Dropbox allows localhost, which is where this app receives the sign-in. The key is kept with the connection on this device.')
        : t('This site ships no Dropbox app, so connect with your own: create an app in the Dropbox App Console (scoped access, App folder type), add {redirect} as a redirect URI, and paste its App key above. It is kept with the connection in this browser.', { redirect: `${location.origin}/oauth-return.html` })}</p>`,
  },
  {
    kind: 'o365',
    label: () => t('OneDrive'),
    // The desktop signs in through the person's own browser (Entra refuses an
    // SPA-registered redirect from a native client), so its note says so.
    scopesNote: () => (isTauriShell()
      ? t('Signs in through your own browser. Can only see the Lolly app folder in your OneDrive.')
      : t('Can only see the Lolly app folder in your OneDrive.')),
    // Two registrations, one row: the SPA client on the web, the mobile-and-
    // desktop-platform client in Tauri (plans/129 WP4b).
    available: () => (isTauriMobileShell() ? oneDriveMobileAvailable()
      : isTauriShell() ? oneDriveDesktopAvailable() : oneDriveAvailable()),
    connect: (persist) => (isTauriShell() ? connectOneDriveDesktop(persist) : connectOneDrive(persist)),
    disconnect: disconnectOneDrive,
  },
  {
    // Desktop only (plans/129 WP4b): LinkedIn's token endpoint requires a client
    // secret and grants PKCE to partner apps only, so there is no honest web
    // shape - see lib/linkedin-send.ts. No setup form: an individual cannot
    // bring their own app here the way they can with Dropbox, because the
    // registration needs LinkedIn's product approvals.
    kind: 'linkedin',
    label: () => t('LinkedIn'),
    scopesNote: () => t('Posts to your own feed as a public post. Signs in through your own browser; Lolly reads nothing else on your LinkedIn.'),
    available: () => isTauriShell() && linkedInAvailable(),
    connect: (persist) => connectLinkedIn(persist),
    disconnect: disconnectLinkedIn,
  },
];

const field = (name: string, label: string, value = '', type: 'text' | 'password' = 'text', placeholder = ''): string => `
  <label class="pconn-field"><span>${escape(label)}</span>
    <input class="field-input" type="${type}" data-field="${escape(name)}" value="${escape(value)}"${placeholder ? ` placeholder="${escape(placeholder)}"` : ''} autocomplete="off" spellcheck="false">
  </label>`;

/** A remembered sign-in lives in this browser's storage on the web, and on the device
 *  itself in the desktop and mobile apps. Whole sentences per shell, for translation. */
const stayConnectedLabel = (): string => (isTauriShell() ? t('Stay connected on this device') : t('Stay connected in this browser'));
const staysConnectedNote = (): string => (isTauriShell() ? t('Stays connected on this device') : t('Stays connected in this browser'));

/** "Make this my export home" (plans/138 A1): shown on a CONNECTED storage
 *  provider only, and only when the connection is REMEMBERED on this device
 *  (`persist`). A session-only connection vanishes on reload, so a home pinned to
 *  it would silently stop auto-sending - the toggle stays hidden rather than
 *  offering a home that evaporates. A single choice across providers: checking one
 *  is the home, and the re-render unchecks the rest. Absent for the publish tier. */
function homeToggleHtml(kind: string, home: string | undefined, persisted: boolean): string {
  if (!isExportHomeKind(kind) || !persisted) return '';
  return `<label class="pconn-home"><input type="checkbox" data-pconn-home="${escape(kind)}"${home === kind ? ' checked' : ''}> ${t('Make this my export home')}</label>`;
}

/** What a live connection remembers, shown under its account name. */
const rememberedNote = (kind: string, conn: ProviderConnection): string => (!conn.persist ? t('Connected for this session only')
  : kind === 'gdrive' && !isTauriShell() ? t('Remembered in this browser; signs in again on each visit')
    : staysConnectedNote());

const persistHtml = (kind: string): string =>
  `<label class="pconn-persist"><input type="checkbox" data-pconn-persist="${escape(kind)}"> ${stayConnectedLabel()}</label>`;
const disconnectHtml = (kind: string): string =>
  `<button type="button" class="btn-link-danger" data-pconn-disconnect="${escape(kind)}">${t('Disconnect')}</button>`;

/** The status a connected service shows when opened: the account, what is
 *  remembered, and the export-home choice where it applies. */
function statusHtml(kind: string, conn: ProviderConnection, home: string | undefined): string {
  return `<p class="pconn-account">${escape(conn.account)}<span class="pconn-note">${escape(rememberedNote(kind, conn))}</span></p>
        ${homeToggleHtml(kind, home, conn.persist)}`;
}

/** One service: its mark and name, a Connected tag once it is set up, and a body
 *  that opens with the description, then the set-up form or the status. Every
 *  body ends in the one status line the click handler writes to. */
function serviceHtml(kind: string, label: string, connected: boolean, description: string, body: string): string {
  return `
    <details class="pconn-svc" data-pconn="${escape(kind)}">
      <summary class="pconn-svc-sum">${serviceMark(kind)}<span class="pconn-svc-name">${escape(label)}</span>${connected ? `<span class="pconn-svc-state">${t('Connected')}</span>` : ''}${COLLAPSE_CHEV}</summary>
      <div class="pconn-svc-body">
        <p class="pconn-note pconn-desc">${escape(description)}</p>
        ${body}
        <span class="pconn-status" data-pconn-status="${escape(kind)}" role="status"></span>
      </div>
    </details>`;
}

function oauthBody(kind: string, conn: ProviderConnection | undefined, home: string | undefined, setup: string): string {
  if (conn) return `${statusHtml(kind, conn, home)}
        <div class="pconn-actions">${disconnectHtml(kind)}</div>`;
  return `${setup ? `<div class="pconn-form">${setup}</div>` : ''}
        ${persistHtml(kind)}
        <div class="pconn-actions"><button type="button" class="btn" data-pconn-connect="${escape(kind)}">${t('Connect')}</button></div>`;
}

/** A service set up with an address and keys. Once connected, its form folds
 *  behind Edit, under the status, with the saved values filled in. `note` is
 *  already t() output. */
function credentialBody(kind: string, conn: ProviderConnection | undefined, home: string | undefined, fields: string, note: string): string {
  const form = `
        <div class="pconn-form" id="pconn-form-${escape(kind)}"${conn ? ' hidden' : ''}>
          ${fields}
          <p class="pconn-note">${note}</p>
          <div class="pconn-actions"><button type="button" class="btn" data-pconn-save="${escape(kind)}">${t('Save & test')}</button></div>
        </div>`;
  if (!conn) return form;
  return `${statusHtml(kind, conn, home)}
        <div class="pconn-actions">
          <button type="button" class="btn" data-pconn-edit aria-expanded="false" aria-controls="pconn-form-${escape(kind)}">${t('Edit')}</button>
          ${disconnectHtml(kind)}
        </div>${form}`;
}

/** In the mobile apps, hide a browser-sign-in service that is not connected and
 *  cannot sign in there: its Connect button could only fail. */
const signInPossible = (kind: string, connected: boolean): boolean =>
  connected || !BROWSER_SIGN_IN_KINDS.has(kind) || !isTauriMobileShell() || mobileSignInReady(kind);

/** Every service row this device offers, by kind. A kind that is switched off,
 *  unavailable here or cannot sign in here has no entry. */
function serviceRows(conns: Map<string, ProviderConnection>, home: string | undefined): Map<string, string> {
  const rows = new Map<string, string>();
  // A kind switched off in Feature flags gets no row (the note in
  // mountConnectionsBody says where it went).
  const add = (kind: string, label: string, description: string, body: string): void => {
    if (connectorEnabled(kind)) rows.set(kind, serviceHtml(kind, label, conns.has(kind), description, body));
  };
  for (const r of OAUTH_ROWS) {
    if (!r.available() || !signInPossible(r.kind, conns.has(r.kind))) continue;
    add(r.kind, r.label(), r.scopesNote(), oauthBody(r.kind, conns.get(r.kind), home, r.setup?.() ?? ''));
  }

  const s3 = conns.get('s3');
  const s3cfg = (s3?.config ?? {}) as Partial<S3Config>;
  add('s3', t('S3 bucket'), t('Your own AWS S3, MinIO, R2 or any S3-compatible store'), credentialBody('s3', s3, home, `
          ${field('endpoint', t('Endpoint URL'), s3cfg.endpoint ?? '', 'text', 'https://s3.eu-central-1.amazonaws.com')}
          ${field('region', t('Region'), s3cfg.region ?? '', 'text', 'eu-central-1')}
          ${field('bucket', t('Bucket'), s3cfg.bucket ?? '')}
          ${field('accessKeyId', t('Access key id'), s3cfg.accessKeyId ?? '')}
          ${field('secretAccessKey', t('Secret access key'), s3cfg.secretAccessKey ?? '', 'password')}
          ${field('prefix', t('Key prefix (optional)'), s3cfg.prefix ?? '', 'text', 'lolly/')}
          ${field('publicBaseUrl', t('Public base URL (optional)'), s3cfg.publicBaseUrl ?? '', 'text', 'https://cdn.example.com')}`,
  isTauriShell() ? t('Keys stay on this device, never in backups. The bucket’s CORS config must allow this origin.') : t('Keys stay in this browser, never in backups. The bucket’s CORS config must allow this origin.')));

  const dav = conns.get('webdav');
  const davCfg = (dav?.config ?? {}) as Partial<WebdavConfig>;
  add('webdav', t('Nextcloud / WebDAV'), t('Your own server, signed in with an app password'), credentialBody('webdav', dav, home, `
          ${field('baseUrl', t('Server URL'), davCfg.baseUrl ?? '', 'text', 'https://cloud.example.org')}
          ${field('username', t('Username'), davCfg.username ?? '')}
          ${field('appPassword', t('App password'), davCfg.appPassword ?? '', 'password')}
          ${field('folder', t('Folder (optional)'), davCfg.folder ?? '', 'text', 'Lolly')}`,
  isTauriShell() ? t('Use a per-app password (Nextcloud: Settings → Security), never your account password. Stays on this device.') : t('Use a per-app password (Nextcloud: Settings → Security), never your account password. Stays in this browser.')));

  // Penpot (plans/178): a Personal Access Token, plus an OPTIONAL default project
  // picked from a list the token itself fetches - the connect flow is two clicks on
  // one button (Load projects → Connect), with the picker injected in place by the
  // handler so the pasted PAT survives (a re-render would drop it). The real
  // destination is chosen at send time, so this row is custody first: session-only
  // by default, at rest only by explicit choice (the Mastodon shape). The helper
  // text is deliberately honest about the pass-through - this is the one connector
  // whose bytes cross a Lolly server, because Penpot's API refuses direct browser
  // calls from other origins.
  const pen = conns.get('penpot');
  add('penpot', t('Penpot'), t('Send renders into a Penpot project with an access token'), pen ? `${statusHtml('penpot', pen, home)}
        <div class="pconn-actions">${disconnectHtml('penpot')}</div>` : `
        <div class="pconn-form">
          ${field('token', t('Access token'), '', 'password')}
          <p class="pconn-note">${isTauriShell() ? t('Make a token in Penpot under Settings → Access tokens. Each send creates a new Penpot file, on the canvas with your brand tokens inside, in the project you pick at send time. It travels through lolly.tools’s pass-through, because Penpot’s API does not allow browser calls from other sites - your token is forwarded with each send, not stored server-side. What is remembered on this device is your choice below.') : t('Make a token in Penpot under Settings → Access tokens. Each send creates a new Penpot file, on the canvas with your brand tokens inside, in the project you pick at send time. It travels through lolly.tools’s pass-through, because Penpot’s API does not allow browser calls from other sites - your token is forwarded with each send, not stored server-side. What is remembered in this browser is your choice below.')}</p>
        </div>
        ${persistHtml('penpot')}
        <div class="pconn-actions"><button type="button" class="btn" data-pconn-save="penpot">${t('Load projects')}</button></div>`);

  // The publish tier (plans/129 WP5): Mastodon (per-server OAuth), Bluesky (app
  // password), Discord (webhook). These need nobody's app-review queue, so the
  // rows always exist.
  const masto = conns.get('mastodon');
  if (signInPossible('mastodon', !!masto)) {
    add('mastodon', t('Mastodon'), t('Post to any Mastodon server - no central app, your server issues the sign-in'), masto ? `${statusHtml('mastodon', masto, home)}
        <div class="pconn-actions">${disconnectHtml('mastodon')}</div>` : `
        <div class="pconn-form">${field('server', t('Your server'), '', 'text', 'mastodon.social')}</div>
        ${persistHtml('mastodon')}
        <div class="pconn-actions"><button type="button" class="btn" data-pconn-save="mastodon">${t('Connect')}</button></div>`);
  }

  const bsky = conns.get('bluesky');
  const bskyCfg = (bsky?.config ?? {}) as Partial<BlueskyConfig>;
  add('bluesky', t('Bluesky'), t('Image posts with an app password - no OAuth, revocable any time'), credentialBody('bluesky', bsky, home, `
          ${field('service', t('Service URL'), bskyCfg.service ?? 'https://bsky.social')}
          ${field('identifier', t('Handle'), bskyCfg.identifier ?? '', 'text', 'you.bsky.social')}
          ${field('appPassword', t('App password'), bskyCfg.appPassword ?? '', 'password')}`,
  isTauriShell() ? t('Make an app password in Bluesky under Settings → App passwords - never your account password. Stays on this device.') : t('Make an app password in Bluesky under Settings → App passwords - never your account password. Stays in this browser.')));

  const discord = conns.get('discord');
  add('discord', t('Discord'), t('Post files into a channel through its webhook - no sign-in needed'), credentialBody('discord', discord, home,
    field('url', t('Webhook URL'), (discord?.config?.url as string | undefined) ?? '', 'password', 'https://discord.com/api/webhooks/…'),
    isTauriShell() ? t('Channel settings → Integrations → Webhooks. Anyone holding this URL can post to the channel - it stays on this device, never in backups.') : t('Channel settings → Integrations → Webhooks. Anyone holding this URL can post to the channel - it stays in this browser, never in backups.')));
  return rows;
}

/** The groups the services sit in, named by what they do with your work. Sync
 *  across devices is the card's last group; the shell renders it around
 *  #sync-body. */
const GROUPS: Array<{ id: string; title: () => string; kinds: string[] }> = [
  { id: 'storage', title: () => t('Storage and sync'), kinds: ['gdrive', 'dropbox', 'o365', 's3', 'webdav'] },
  { id: 'post', title: () => t('Posting'), kinds: ['mastodon', 'bluesky', 'discord', 'linkedin'] },
  { id: 'design', title: () => t('Design apps'), kinds: ['penpot'] },
];

function groupsHtml(rows: Map<string, string>, live: string[]): string {
  return GROUPS.map((g) => {
    const items = g.kinds.filter((k) => rows.has(k));
    if (!items.length) return '';
    const n = items.filter((k) => live.includes(k)).length;
    return `
    <details class="pconn-group" data-pconn-group="${g.id}">
      ${groupSummaryRow(g.title(), n ? t('{n} connected', { n }) : '', items.map(serviceMark).join(''))}
      <div class="pconn-group-body"><div class="pconn-svcs">${items.map((k) => rows.get(k)).join('')}</div></div>
    </details>`;
  }).join('');
}

/** Provider display name for one connection kind - the labels are otherwise spread
 *  across the row builders, and /profile's folded section summary needs to name a
 *  provider without rendering a row. */
const kindLabel = (kind: string): string => ({
  gdrive: t('Google Drive'), dropbox: t('Dropbox'), o365: t('OneDrive'),
  s3: t('S3 bucket'), webdav: t('Nextcloud / WebDAV'), penpot: t('Penpot'),
  mastodon: t('Mastodon'), bluesky: t('Bluesky'), discord: t('Discord'),
  linkedin: t('LinkedIn'),
} as Record<string, string>)[kind] ?? kind;

/** Fill the section body and wire it. Re-renders itself after every change.
 *  `onSummary` (optional) receives the one-line "what is connected" text for the
 *  card's folded summary, on the first mount and after every re-render. */
export async function mountConnectionsBody(body: HTMLElement, host: ConnHost, onSummary?: (text: string) => void): Promise<void> {
  const conns = new Map((await listConnections()).map((c) => [c.kind, c]));
  const home = (await host.profile.get().catch(() => ({}) as Profile)).exportHome;
  // Names what a kill switch is hiding, so a vanished Drive row reads as a choice
  // the user made rather than a missing feature.
  const switchedOff = CONNECTOR_FLAGS.filter((f) => !connectorEnabled(f.connector!));
  const offNote = switchedOff.length
    ? `<p class="pconn-note">${t('Turned off in Feature flags: {names}', { names: switchedOff.map((f) => t(f.label)).join(', ') })}</p>`
    : '';
  const notHere = isTauriMobileShell()
    ? [...BROWSER_SIGN_IN_KINDS].filter((k) => connectorEnabled(k) && !mobileSignInReady(k) && !conns.has(k)).map(kindLabel)
    : [];
  const mobileNote = notHere.length
    ? `<p class="pconn-note">${t('Not available in the mobile app yet: {names}. Signing in to them needs a registration this app does not have.', { names: notHere.join(', ') })}</p>`
    : '';
  // A provider switched off in Feature flags has no row here, so it must not count
  // as connected either.
  const live = [...conns.keys()].filter(connectorEnabled);
  // Every group and service starts folded, and a re-render after a change keeps
  // open what was open, so a connect shows the row's new status.
  const openKey = (d: HTMLDetailsElement): string => d.dataset.pconnGroup ?? `svc:${d.dataset.pconn ?? ''}`;
  const wasOpen = new Set([...body.querySelectorAll<HTMLDetailsElement>('details[open]')].map(openKey));
  body.innerHTML = `
    <p class="storage-hint-text">${isTauriShell() ? t('Send finished exports straight to your own places. Every send goes from this device to the provider directly - no Lolly server ever holds your files or your sign-ins - and what is remembered on this device is your choice, wiped by Disconnect and never included in backups.') : t('Send finished exports straight to your own places. Every send goes from this device to the provider directly - no Lolly server ever holds your files or your sign-ins - and what is remembered in this browser is your choice, wiped by Disconnect and never included in backups.')}</p>
    ${offNote}
    ${mobileNote}
    ${groupsHtml(serviceRows(conns, home), live)}`;
  body.querySelectorAll<HTMLDetailsElement>('details').forEach((d) => { if (wasOpen.has(openKey(d))) d.open = true; });

  onSummary?.(live.length === 0 ? t('None connected')
    : live.length === 1 ? kindLabel(live[0]!)
    : tRaw('{first} + {n}', { first: kindLabel(live[0]!), n: live.length - 1 }));

  // The Penpot token the last successful probe listed projects for (memory only,
  // never an attribute): the Connect step compares against it.
  let probedPenpotToken = '';
  const readForm = (kind: string): Record<string, string> => {
    const out: Record<string, string> = {};
    body.querySelectorAll<HTMLInputElement>(`[data-pconn="${CSS.escape(kind)}"] [data-field]`).forEach((el) => {
      out[el.dataset.field!] = el.value.trim();
    });
    return out;
  };
  const status = (kind: string, text: string): void => {
    const el = body.querySelector<HTMLElement>(`[data-pconn-status="${CSS.escape(kind)}"]`);
    if (el) el.textContent = text;
  };

  body.onclick = async (ev) => {
    const el = ev.target as HTMLElement;
    // Edit unfolds a connected service's saved settings in place.
    const edit = el.closest<HTMLButtonElement>('[data-pconn-edit]');
    if (edit) {
      const form = body.querySelector<HTMLElement>(`#${CSS.escape(edit.getAttribute('aria-controls') ?? '')}`);
      if (!form) return;
      form.hidden = !form.hidden;
      edit.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) form.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    const connectKind = el.closest<HTMLElement>('[data-pconn-connect]')?.dataset.pconnConnect;
    const disconnectKind = el.closest<HTMLElement>('[data-pconn-disconnect]')?.dataset.pconnDisconnect;
    const saveKind = el.closest<HTMLElement>('[data-pconn-save]')?.dataset.pconnSave;
    if (!connectKind && !disconnectKind && !saveKind) return;
    const btn = el.closest<HTMLButtonElement>('button');
    if (btn?.disabled) return;
    if (btn) btn.disabled = true;
    try {
      if (connectKind) {
        const row = OAUTH_ROWS.find((r) => r.kind === connectKind);
        const persist = body.querySelector<HTMLInputElement>(`[data-pconn-persist="${CSS.escape(connectKind)}"]`)?.checked ?? false;
        if (connectKind === 'dropbox' && !dropboxAvailable()) {
          // Bring-your-own app key (no deploy registration): the key rides the
          // grant and is saved with the connection.
          const key = readForm('dropbox').clientId;
          if (!key) {
            status('dropbox', t('Paste your Dropbox App key first'));
            return;
          }
          await connectDropbox(persist, undefined, key);
        } else if (connectKind === 'gdrive' && !isTauriShell() && !driveAvailable()) {
          // Bring-your-own client id (plans/138 Tier D, WP-P3), as for Dropbox.
          const id = readForm('gdrive').clientId;
          if (!id) {
            status('gdrive', t('Paste your Google Client ID first'));
            return;
          }
          await connectDriveWeb(persist, id);
        } else if (row) await row.connect(persist);
      } else if (disconnectKind) {
        if (disconnectKind === 's3') await disconnectS3();
        else if (disconnectKind === 'webdav') await disconnectWebdav();
        else if (disconnectKind === 'penpot') await disconnectPenpot();
        else if (disconnectKind === 'mastodon') await disconnectMastodon();
        else if (disconnectKind === 'bluesky') await disconnectBluesky();
        else if (disconnectKind === 'discord') await disconnectDiscord();
        else await OAUTH_ROWS.find((r) => r.kind === disconnectKind)?.disconnect();
      } else if (saveKind === 'penpot') {
        // Two clicks on one button: first "Load projects" (probe the PAT, inject
        // the destination picker IN PLACE - a full re-render would drop the
        // pasted token), then "Connect" once a project is chosen.
        const f = readForm('penpot');
        if (!f.token) {
          status('penpot', t('Paste your Penpot access token first'));
          return;
        }
        let picker = body.querySelector<HTMLSelectElement>('[data-penpot-project]');
        // The second click must connect the token that was PROBED. A token edited after
        // "Load projects" drops the injected picker and probes again, so an unverified
        // token is never saved on the strength of an earlier one's project list.
        if (picker && f.token !== probedPenpotToken) {
          picker.closest('label.pconn-field')?.remove();
          picker = null;
        }
        if (!picker) {
          status('penpot', t('Checking…'));
          const res = await testPenpot(f.token);
          status('penpot', res.note);
          if (!res.ok || !res.projects) return;
          probedPenpotToken = f.token;
          const label = document.createElement('label');
          label.className = 'pconn-field';
          const caption = document.createElement('span');
          caption.textContent = t('Default project');
          const select = document.createElement('select');
          select.className = 'field-input';
          select.dataset.penpotProject = '';
          // The destination is a send-time question now, so no project here is
          // a complete answer - it just means the picker opens on the first one.
          const none = document.createElement('option');
          none.value = '';
          none.textContent = t('Choose at send time');
          select.append(none);
          for (const p of res.projects) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.append(opt);
          }
          label.append(caption, select);
          const actions = body.querySelector('[data-pconn="penpot"] .pconn-actions');
          actions?.before(label);
          if (btn) btn.textContent = t('Connect');
          return;
        }
        const projectName = picker.selectedOptions[0]?.textContent ?? '';
        const persist = body.querySelector<HTMLInputElement>('[data-pconn-persist="penpot"]')?.checked ?? false;
        // An empty value is "Choose at send time": the token alone connects.
        await connectPenpot(persist, f.token, picker.value ? { id: picker.value, name: projectName } : undefined);
      } else if (saveKind === 'mastodon') {
        const f = readForm('mastodon');
        if (!f.server) {
          status('mastodon', t('Enter your server like mastodon.social'));
          return;
        }
        const persist = body.querySelector<HTMLInputElement>('[data-pconn-persist="mastodon"]')?.checked ?? false;
        status('mastodon', t('Opening sign-in…'));
        await connectMastodon(persist, f.server);
      } else if (saveKind === 'bluesky') {
        const f = readForm('bluesky');
        if (!f.service || !f.identifier || !f.appPassword) {
          status('bluesky', t('Service, handle and app password are required'));
          return;
        }
        const cfg: BlueskyConfig = { service: f.service, identifier: f.identifier, appPassword: f.appPassword };
        status('bluesky', t('Testing…'));
        const res = await testBluesky(cfg);
        status('bluesky', res.note);
        if (!res.ok) return;
        await connectBluesky(cfg, res.handle);
      } else if (saveKind === 'discord') {
        const f = readForm('discord');
        if (!f.url) {
          status('discord', t('Paste the channel webhook URL'));
          return;
        }
        status('discord', t('Testing…'));
        const res = await testDiscord(f.url);
        status('discord', res.note);
        if (!res.ok) return;
        await connectDiscord(f.url, res.name);
      } else if (saveKind === 's3') {
        const f = readForm('s3');
        if (!f.endpoint || !f.bucket || !f.accessKeyId || !f.secretAccessKey) {
          status('s3', t('Endpoint, bucket and both keys are required'));
          return;
        }
        const cfg: S3Config = {
          endpoint: f.endpoint, region: f.region || 'us-east-1', bucket: f.bucket,
          accessKeyId: f.accessKeyId, secretAccessKey: f.secretAccessKey,
          prefix: f.prefix, publicBaseUrl: f.publicBaseUrl,
        };
        status('s3', t('Testing…'));
        const res = await testS3(cfg);
        status('s3', res.note);
        if (!res.ok) return;
        await connectS3(cfg);
      } else if (saveKind === 'webdav') {
        const f = readForm('webdav');
        if (!f.baseUrl || !f.username || !f.appPassword) {
          status('webdav', t('Server URL, username and app password are required'));
          return;
        }
        const cfg: WebdavConfig = { baseUrl: f.baseUrl, username: f.username, appPassword: f.appPassword, folder: f.folder };
        status('webdav', t('Testing…'));
        const res = await testWebdav(cfg);
        status('webdav', res.note);
        if (!res.ok) return;
        await connectWebdav(cfg);
      }
      await mountConnectionsBody(body, host, onSummary); // re-render with the new state
    } catch (err) {
      const kind = connectKind ?? disconnectKind ?? saveKind ?? '';
      const msg = String((err as Error)?.message || t('That did not work - try again'));
      status(kind, msg.length <= 140 ? msg : t('That did not work - try again'));
    } finally {
      // Also covers the validation early-returns above, which used to leave the
      // button disabled. Harmless after a success re-render (btn is detached).
      if (btn) btn.disabled = false;
    }
  };

  // "Make this my export home" (plans/138 A1). Single choice: checking one sets
  // profile.exportHome to that kind; the re-render unchecks every other. Its own
  // change handler - the click handler above ignores it (no connect/disconnect/save
  // attribute), so a toggle never triggers a connect flow.
  body.onchange = async (ev) => {
    const cb = (ev.target as HTMLElement).closest<HTMLInputElement>('[data-pconn-home]');
    if (!cb) return;
    const kind = cb.dataset.pconnHome!;
    const current = await host.profile.get().catch(() => ({}) as Profile);
    const next = { ...current };
    if (cb.checked) next.exportHome = kind;
    else if (current.exportHome === kind) delete next.exportHome;
    try { await host.profile.set(next); } catch { /* storage off - non-fatal */ }
    await mountConnectionsBody(body, host, onSummary);   // re-render so the choice stays single
  };
}
