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
  driveAvailable, driveDesktopAvailable, connectDriveDesktop, disconnectDriveDesktop,
} from '../lib/google-drive.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { dropboxAvailable, connectDropbox, disconnectDropbox } from '../lib/dropbox-send.ts';
import {
  oneDriveAvailable, oneDriveDesktopAvailable, connectOneDrive, connectOneDriveDesktop, disconnectOneDrive,
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
    // Desktop only (plans/129 WP4): system-browser sign-in + refresh custody.
    // On the web, Google Drive keeps its session-only implicit grant and shows
    // the static row below instead.
    kind: 'gdrive',
    label: () => t('Google Drive'),
    scopesNote: () => t('Signs in through your own browser. Lolly can only see files it created.'),
    available: () => isTauriShell() && driveDesktopAvailable(),
    connect: connectDriveDesktop,
    disconnect: disconnectDriveDesktop,
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
      <p class="pconn-note">${isTauriShell()
        ? t('This build ships no Dropbox app, so connect with your own: create an app in the Dropbox App Console (scoped access, App folder type) and paste its App key above. No redirect URI needs registering - Dropbox allows localhost, which is where this app receives the sign-in. The key is kept with the connection on this device.')
        : t('This site ships no Dropbox app, so connect with your own: create an app in the Dropbox App Console (scoped access, App folder type), add {redirect} as a redirect URI, and paste its App key above. It is kept with the connection on this device.', { redirect: `${location.origin}/oauth-return.html` })}</p>
      <span class="pconn-status" data-pconn-status="dropbox" role="status"></span>`,
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
    available: () => (isTauriShell() ? oneDriveDesktopAvailable() : oneDriveAvailable()),
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

function oauthRowHtml(kind: string, label: string, scopesNote: string, conn: ProviderConnection | null, home: string | undefined, setup = ''): string {
  if (conn) {
    return `
    <div class="store-manage--row pconn-row" data-pconn="${escape(kind)}">
      <span class="store-manage-name">${escape(label)}
        <span class="pconn-account">${escape(conn.account)}</span>
        <span class="pconn-note">${escape(conn.persist ? t('Stays connected on this device') : t('Connected for this session only'))}</span>
        ${homeToggleHtml(kind, home, conn.persist)}
      </span>
      <button type="button" class="btn-link-danger" data-pconn-disconnect="${escape(kind)}">${t('Disconnect')}</button>
    </div>`;
  }
  return `
    <div class="store-manage--row pconn-row" data-pconn="${escape(kind)}">
      <span class="store-manage-name">${escape(label)}
        <span class="pconn-note">${escape(scopesNote)}</span>
        ${setup}
        <label class="pconn-persist"><input type="checkbox" data-pconn-persist="${escape(kind)}"> ${t('Stay connected on this device')}</label>
      </span>
      <button type="button" class="btn" data-pconn-connect="${escape(kind)}">${t('Connect')}</button>
    </div>`;
}

/** Drop a provider's whole block when its connector kill switch is off (the note
 *  in mountConnectionsBody says where it went). */
const gate = (kind: string, html: string): string => (connectorEnabled(kind) ? html : '');

function credentialRowsHtml(conns: Map<string, ProviderConnection>, home: string | undefined): string {
  const s3 = conns.get('s3');
  const s3cfg = (s3?.config ?? {}) as Partial<S3Config>;
  const dav = conns.get('webdav');
  const davCfg = (dav?.config ?? {}) as Partial<WebdavConfig>;
  return `
    ${gate('s3', `<details class="pconn-cred" data-pconn="s3">
      <summary><span class="store-manage-name">${t('S3 bucket')}
        ${s3 ? `<span class="pconn-account">${escape(s3.account)}</span>` : `<span class="pconn-note">${t('Your own AWS S3, MinIO, R2 or any S3-compatible store')}</span>`}
      </span></summary>
      <div class="pconn-form">
        ${field('endpoint', t('Endpoint URL'), s3cfg.endpoint ?? '', 'text', 'https://s3.eu-central-1.amazonaws.com')}
        ${field('region', t('Region'), s3cfg.region ?? '', 'text', 'eu-central-1')}
        ${field('bucket', t('Bucket'), s3cfg.bucket ?? '')}
        ${field('accessKeyId', t('Access key id'), s3cfg.accessKeyId ?? '')}
        ${field('secretAccessKey', t('Secret access key'), s3cfg.secretAccessKey ?? '', 'password')}
        ${field('prefix', t('Key prefix (optional)'), s3cfg.prefix ?? '', 'text', 'lolly/')}
        ${field('publicBaseUrl', t('Public base URL (optional)'), s3cfg.publicBaseUrl ?? '', 'text', 'https://cdn.example.com')}
        <p class="pconn-note">${t('Keys stay on this device, never in backups. The bucket’s CORS config must allow this origin.')}</p>
        <div class="pconn-actions">
          <button type="button" class="btn" data-pconn-save="s3">${t('Save & test')}</button>
          ${s3 ? `<button type="button" class="btn-link-danger" data-pconn-disconnect="s3">${t('Disconnect')}</button>` : ''}
          <span class="pconn-status" data-pconn-status="s3" role="status"></span>
          ${s3 ? homeToggleHtml('s3', home, s3.persist) : ''}
        </div>
      </div>
    </details>`)}
    ${gate('webdav', `<details class="pconn-cred" data-pconn="webdav">
      <summary><span class="store-manage-name">${t('Nextcloud / WebDAV')}
        ${dav ? `<span class="pconn-account">${escape(dav.account)}</span>` : `<span class="pconn-note">${t('Your own server, signed in with an app password')}</span>`}
      </span></summary>
      <div class="pconn-form">
        ${field('baseUrl', t('Server URL'), davCfg.baseUrl ?? '', 'text', 'https://cloud.example.org')}
        ${field('username', t('Username'), davCfg.username ?? '')}
        ${field('appPassword', t('App password'), davCfg.appPassword ?? '', 'password')}
        ${field('folder', t('Folder (optional)'), davCfg.folder ?? '', 'text', 'Lolly')}
        <p class="pconn-note">${t('Use a per-app password (Nextcloud: Settings → Security), never your account password. Stays on this device.')}</p>
        <div class="pconn-actions">
          <button type="button" class="btn" data-pconn-save="webdav">${t('Save & test')}</button>
          ${dav ? `<button type="button" class="btn-link-danger" data-pconn-disconnect="webdav">${t('Disconnect')}</button>` : ''}
          <span class="pconn-status" data-pconn-status="webdav" role="status"></span>
          ${dav ? homeToggleHtml('webdav', home, dav.persist) : ''}
        </div>
      </div>
    </details>`)}
    ${penpotRowHtml(conns)}
    ${publishRowsHtml(conns)}`;
}

/** Penpot (plans/178): a Personal Access Token, plus an OPTIONAL default
 *  project picked from a list the token itself fetches - the connect flow is
 *  two clicks on one button (Load projects → Connect), with the picker
 *  injected in place by the handler so the pasted PAT survives (a re-render
 *  would drop it). The real destination is chosen at send time, so this card
 *  is custody first: session-only by default, at rest only by explicit choice
 *  (the Mastodon shape). The helper text is deliberately honest about the
 *  pass-through - this is the one connector whose bytes cross a Lolly server,
 *  because Penpot's API refuses direct browser calls from other origins. */
function penpotRowHtml(conns: Map<string, ProviderConnection>): string {
  const pen = conns.get('penpot');
  return gate('penpot', `<details class="pconn-cred" data-pconn="penpot">
      <summary><span class="store-manage-name">${t('Penpot')}
        ${pen ? `<span class="pconn-account">${escape(pen.account)}</span>` : `<span class="pconn-note">${t('Send renders into a Penpot project with an access token')}</span>`}
      </span></summary>
      <div class="pconn-form">
        ${pen ? `
        <span class="pconn-note">${escape(pen.persist ? t('Stays connected on this device') : t('Connected for this session only'))}</span>` : `
        ${field('token', t('Access token'), '', 'password')}
        <p class="pconn-note">${t('Make a token in Penpot under Settings → Access tokens. Each send creates a new Penpot file, on the canvas with your brand tokens inside, in the project you pick at send time. It travels through lolly.tools’s pass-through, because Penpot’s API does not allow browser calls from other sites - your token is forwarded with each send, not stored server-side. What is remembered on this device is your choice below.')}</p>
        <label class="pconn-persist"><input type="checkbox" data-pconn-persist="penpot"> ${t('Stay connected on this device')}</label>`}
        <div class="pconn-actions">
          ${pen
            ? `<button type="button" class="btn-link-danger" data-pconn-disconnect="penpot">${t('Disconnect')}</button>`
            : `<button type="button" class="btn" data-pconn-save="penpot">${t('Load projects')}</button>`}
          <span class="pconn-status" data-pconn-status="penpot" role="status"></span>
        </div>
      </div>
    </details>`);
}

/** The publish tier (plans/129 WP5): Mastodon (per-server OAuth), Bluesky (app
 *  password), Discord (webhook). Same details-block shape as the credential
 *  providers - these need nobody's app-review queue, so the rows always exist. */
function publishRowsHtml(conns: Map<string, ProviderConnection>): string {
  const masto = conns.get('mastodon');
  const bsky = conns.get('bluesky');
  const bskyCfg = (bsky?.config ?? {}) as Partial<BlueskyConfig>;
  const discord = conns.get('discord');
  return `
    ${gate('mastodon', `<details class="pconn-cred" data-pconn="mastodon">
      <summary><span class="store-manage-name">${t('Mastodon')}
        ${masto ? `<span class="pconn-account">${escape(masto.account)}</span>` : `<span class="pconn-note">${t('Post to any Mastodon server - no central app, your server issues the sign-in')}</span>`}
      </span></summary>
      <div class="pconn-form">
        ${masto ? '' : `
        ${field('server', t('Your server'), '', 'text', 'mastodon.social')}
        <label class="pconn-persist"><input type="checkbox" data-pconn-persist="mastodon"> ${t('Stay connected on this device')}</label>`}
        <div class="pconn-actions">
          ${masto
            ? `<button type="button" class="btn-link-danger" data-pconn-disconnect="mastodon">${t('Disconnect')}</button>`
            : `<button type="button" class="btn" data-pconn-save="mastodon">${t('Connect')}</button>`}
          <span class="pconn-status" data-pconn-status="mastodon" role="status"></span>
        </div>
      </div>
    </details>`)}
    ${gate('bluesky', `<details class="pconn-cred" data-pconn="bluesky">
      <summary><span class="store-manage-name">${t('Bluesky')}
        ${bsky ? `<span class="pconn-account">${escape(bsky.account)}</span>` : `<span class="pconn-note">${t('Image posts with an app password - no OAuth, revocable any time')}</span>`}
      </span></summary>
      <div class="pconn-form">
        ${field('service', t('Service URL'), bskyCfg.service ?? 'https://bsky.social')}
        ${field('identifier', t('Handle'), bskyCfg.identifier ?? '', 'text', 'you.bsky.social')}
        ${field('appPassword', t('App password'), bskyCfg.appPassword ?? '', 'password')}
        <p class="pconn-note">${t('Make an app password in Bluesky under Settings → App passwords - never your account password. Stays on this device.')}</p>
        <div class="pconn-actions">
          <button type="button" class="btn" data-pconn-save="bluesky">${t('Save & test')}</button>
          ${bsky ? `<button type="button" class="btn-link-danger" data-pconn-disconnect="bluesky">${t('Disconnect')}</button>` : ''}
          <span class="pconn-status" data-pconn-status="bluesky" role="status"></span>
        </div>
      </div>
    </details>`)}
    ${gate('discord', `<details class="pconn-cred" data-pconn="discord">
      <summary><span class="store-manage-name">${t('Discord')}
        ${discord ? `<span class="pconn-account">${escape(discord.account)}</span>` : `<span class="pconn-note">${t('Post files into a channel through its webhook - no sign-in needed')}</span>`}
      </span></summary>
      <div class="pconn-form">
        ${field('url', t('Webhook URL'), (discord?.config?.url as string | undefined) ?? '', 'password', 'https://discord.com/api/webhooks/…')}
        <p class="pconn-note">${t('Channel settings → Integrations → Webhooks. Anyone holding this URL can post to the channel - it stays on this device, never in backups.')}</p>
        <div class="pconn-actions">
          <button type="button" class="btn" data-pconn-save="discord">${t('Save & test')}</button>
          ${discord ? `<button type="button" class="btn-link-danger" data-pconn-disconnect="discord">${t('Disconnect')}</button>` : ''}
          <span class="pconn-status" data-pconn-status="discord" role="status"></span>
        </div>
      </div>
    </details>`)}`;
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
  const oauthRows = OAUTH_ROWS.filter((r) => connectorEnabled(r.kind) && r.available())
    .map((r) => oauthRowHtml(r.kind, r.label(), r.scopesNote(), conns.get(r.kind) ?? null, home, r.setup?.() ?? '')).join('');
  // Names what a kill switch is hiding, so a vanished Drive row reads as a choice
  // the user made rather than a missing feature.
  const switchedOff = CONNECTOR_FLAGS.filter((f) => !connectorEnabled(f.connector!));
  const offNote = switchedOff.length
    ? `<p class="pconn-note">${t('Turned off in Feature flags: {names}', { names: switchedOff.map((f) => t(f.label)).join(', ') })}</p>`
    : '';
  const gdriveRow = connectorEnabled('gdrive') && driveAvailable() && !isTauriShell()
    ? `<div class="store-manage--row pconn-row" data-pconn="gdrive">
        <span class="store-manage-name">${t('Google Drive')}
          <span class="pconn-note">${t('Signs in when you send; nothing is remembered between sessions.')}</span>
        </span>
       </div>`
    : '';
  body.innerHTML = `
    <p class="storage-hint-text">${t('Send finished exports straight to your own places. Every send goes from this device to the provider directly - no Lolly server ever holds your files or your sign-ins - and what is remembered on this device is your choice, wiped by Disconnect and never included in backups.')}</p>
    ${offNote}
    ${gdriveRow}
    ${oauthRows}
    ${credentialRowsHtml(conns, home)}`;

  // A provider switched off in Feature flags has no row here, so it must not count
  // as connected either.
  const live = [...conns.keys()].filter(connectorEnabled);
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
