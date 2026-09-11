// SPDX-License-Identifier: MPL-2.0
/**
 * "Set as wallpaper" send target (plans/174 #6) - desktop shells only.
 *
 * The export bytes go straight to the Tauri side
 * (desktop_set_wallpaper_bytes), which stages them in the app cache and asks
 * the XDG wallpaper PORTAL to apply them - the portal previews and confirms
 * with the user, so the app never changes a desktop silently. No connection,
 * no account, no network: `available()` is just "am I a desktop shell".
 *
 * On non-Linux desktops the command answers Err("unsupported"); the target
 * surfaces that as a plain failure message rather than hiding - a Windows/mac
 * story is a portal-equivalent away, and an honest "not on this OS yet" beats
 * a target that exists on one machine and vanishes on the next.
 */
import type { SendTarget } from './send-target.ts';
import { t } from '../i18n.ts';
import { isTauriShell } from './instance-choice.ts';
import { tauriInvoke } from './nearby-boot.ts';

export const KIND = 'wallpaper';

export function wallpaperSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Wallpaper'),
    formats: ['png', 'jpg', 'jpeg', 'webp'],
    available: () => isTauriShell(),
    hint: t('Sets this render as your desktop background. Your desktop asks you to confirm - nothing changes silently, and nothing leaves this device.'),
    actionLabel: () => t('Set as wallpaper'),
    send: async ({ bytes, format }) => {
      const invoke = tauriInvoke();
      if (!invoke) throw new Error(t('Only available in the desktop app'));
      try {
        await invoke('desktop_set_wallpaper_bytes', {
          bytes: Array.from(bytes),
          ext: format,
          target: 'background',
        });
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        if (/unsupported/.test(msg)) {
          throw new Error(t('Wallpaper setting is not available on this desktop yet'));
        }
        throw new Error(msg);
      }
      return { label: t('Sent to your desktop - confirm the preview to apply') };
    },
  };
}
