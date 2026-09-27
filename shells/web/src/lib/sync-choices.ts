// SPDX-License-Identifier: MPL-2.0
/**
 * sync-choices (plans/138 Tier D, WP-S5): where can THIS device sync?
 *
 * One pure function turns a few facts about the shell into the list the sync
 * section shows: every sync home Lolly knows, each marked ready, needs set-up,
 * planned, or not possible here, with one sentence saying why. The table in
 * plans/138 section D.4 and this list describe the same thing; tests pin the list
 * per shell, so a change to either is a visible change.
 *
 * Pure on purpose: `shellFacts()` below reads the environment once, and
 * `syncChoicesFor()` never touches it, so every shell is testable in Node.
 */

import { t } from '../i18n.ts';
import { isTauriShell, isTauriMobileShell } from './instance-choice.ts';

export type SyncShell = 'web-hosted' | 'web-self-hosted' | 'desktop' | 'ios' | 'android';

export interface ShellFacts {
  shell: SyncShell;
  /** The desktop app on macOS (iCloud Drive has a local folder there). */
  mac: boolean;
  /** The browser has the File System Access folder picker (Chromium on a computer). */
  folderPicker: boolean;
  /** Provider kinds with a saved connection on this device. */
  connected: ReadonlySet<string>;
  /** Provider kinds that have a sync adapter in this build. */
  syncKinds: ReadonlySet<string>;
  /** In the mobile apps: provider kinds whose sign-in can work there
   *  (lib/mobile-sign-in.ts). Ignored elsewhere. */
  mobileSignIn: ReadonlySet<string>;
}

export type SyncChoiceState = 'ready' | 'setup' | 'planned' | 'unavailable';

export interface SyncChoice {
  id: 'dropbox' | 'gdrive' | 'o365' | 'icloud' | 'webdav' | 's3' | 'folder' | 'device' | 'file';
  label: string;
  state: SyncChoiceState;
  note: string;
  /** Where the person goes to set it up, when there is somewhere to go. */
  action?: 'connections' | 'storage';
}

const isApp = (f: ShellFacts): boolean => f.shell === 'desktop' || f.shell === 'ios' || f.shell === 'android';
const isMobile = (f: ShellFacts): boolean => f.shell === 'ios' || f.shell === 'android';

/** A provider that signs in through a browser (Dropbox, Google Drive, OneDrive). */
function oauthChoice(f: ShellFacts, id: 'dropbox' | 'gdrive' | 'o365', label: string): SyncChoice {
  if (!f.syncKinds.has(id)) {
    return { id, label, state: 'planned', note: t('Sending exports works; syncing with it is planned.') };
  }
  if (f.connected.has(id)) {
    return {
      id, label, state: 'ready',
      note: id === 'gdrive' && !isApp(f)
        ? t('Connected. In the browser, automatic sync starts after you sign in during a visit.')
        : (isApp(f) ? t('Connected on this device.') : t('Connected in this browser.')),
    };
  }
  if (isMobile(f) && !f.mobileSignIn.has(id)) {
    return {
      id, label, state: 'unavailable',
      note: t('This app is not registered for this sign-in yet.'),
    };
  }
  return {
    id, label, state: 'setup', action: 'connections',
    note: id === 'gdrive' && f.shell === 'android'
      ? t('Connect it in Connected services. Needs Google Play services on this phone.')
      : t('Connect it in Connected services.'),
  };
}

/** A person's own server (Nextcloud / WebDAV, an S3 bucket). */
function ownServerChoice(f: ShellFacts, id: 'webdav' | 's3', label: string): SyncChoice {
  if (f.connected.has(id)) {
    return { id, label, state: 'ready', note: isApp(f) ? t('Connected on this device.') : t('Connected in this browser.') };
  }
  if (f.shell === 'web-hosted') {
    return {
      id, label, state: 'unavailable',
      note: t('This website cannot reach your own server. Use the Lolly app, or a Lolly you host yourself.'),
    };
  }
  if (f.shell === 'web-self-hosted') {
    return {
      id, label, state: 'setup', action: 'connections',
      note: id === 's3'
        ? t('Works when the admin of this Lolly allows your bucket, and your bucket allows this site (CORS).')
        : t('Works when the admin of this Lolly allows your server, or routes it through this site.'),
    };
  }
  return {
    id, label, state: 'setup', action: 'connections',
    note: t('Connect it in Connected services. The app reaches HTTPS servers on the public internet only.'),
  };
}

/**
 * Every sync home, in the order the person should consider them, with its state
 * on the shell `f` describes.
 */
export function syncChoicesFor(f: ShellFacts): SyncChoice[] {
  const choices: SyncChoice[] = [
    oauthChoice(f, 'dropbox', t('Dropbox')),
    oauthChoice(f, 'gdrive', t('Google Drive')),
    oauthChoice(f, 'o365', t('OneDrive')),
  ];

  if (f.shell === 'ios' || (f.shell === 'desktop' && f.mac)) {
    choices.push({ id: 'icloud', label: t('iCloud Drive'), state: 'planned', note: t('Planned for the Apple apps.') });
  } else if (!isApp(f)) {
    choices.push({ id: 'icloud', label: t('iCloud Drive'), state: 'unavailable', note: t('iCloud Drive cannot be reached from a browser.') });
  }

  choices.push(ownServerChoice(f, 'webdav', t('Nextcloud / WebDAV')));
  choices.push(ownServerChoice(f, 's3', t('S3 bucket')));

  choices.push(isApp(f) || f.folderPicker
    ? { id: 'folder', label: t('A folder'), state: 'planned', note: t('Planned: sync through a folder that another app keeps in step, such as Syncthing or a cloud drive’s own app.') }
    : { id: 'folder', label: t('A folder'), state: 'unavailable', note: t('This browser cannot keep access to a folder. Chrome or Edge on a computer can, and so can the Lolly app.') });

  choices.push({ id: 'device', label: t('Straight to your other device'), state: 'planned', note: t('Planned: on the same network, with no storage in between.') });
  choices.push({
    id: 'file', label: t('A file you move yourself'), state: 'ready', action: 'storage',
    note: t('Export your data in Storage, then import it on the other device. Works everywhere.'),
  });
  return choices;
}

/** Hosts where the shipped content policy applies and cannot list a person's own server. */
const HOSTED = /(^|\.)lolly\.tools$/i;

/** Read the facts for the running shell. */
export function shellFacts(connected: Iterable<string>, syncKinds: Iterable<string>, mobileSignIn: Iterable<string> = []): ShellFacts {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let shell: SyncShell;
  if (isTauriMobileShell()) shell = /Android/.test(ua) ? 'android' : 'ios';
  else if (isTauriShell()) shell = 'desktop';
  else shell = typeof location !== 'undefined' && HOSTED.test(location.hostname) ? 'web-hosted' : 'web-self-hosted';
  return {
    shell,
    mac: /Macintosh|Mac OS X/.test(ua),
    folderPicker: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    connected: new Set(connected),
    syncKinds: new Set(syncKinds),
    mobileSignIn: new Set(mobileSignIn),
  };
}
