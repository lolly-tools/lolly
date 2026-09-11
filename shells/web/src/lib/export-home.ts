// SPDX-License-Identifier: MPL-2.0
/**
 * Export home (plans/138 Tier A1) - the standing "my exports live in my cloud"
 * choice. When profile.exportHome names a connected provider kind, every finished
 * export ALSO auto-sends there, over the SAME send-target driver (lib/send-target.ts)
 * a manual "Send to X" uses - no new transport, no new capability.
 *
 * Best-effort and non-blocking: the file already reached the user via download,
 * so this is only the extra copy to their own cloud. It rides the async-job
 * registry (lib/jobs.ts) marked light, so the global toast owns the progress +
 * outcome UI (including the resulting link) without serialising behind heavy
 * video/matte work, and a failure fails the JOB (visible in the toast) rather
 * than throwing back to the export path.
 */
import { sendTargetsFor } from './send-target.ts';
import { startJob } from './jobs.ts';
import { t } from '../i18n.ts';

/** Provider kinds a user can pin as their export home: storage clouds only, not
 *  the publish tier (a Mastodon/Bluesky/Discord post is not a home). Aligned with
 *  the send-target `kind` vocabulary. */
export const EXPORT_HOME_KINDS = ['gdrive', 'dropbox', 'o365', 's3', 'webdav'] as const;
export type ExportHomeKind = typeof EXPORT_HOME_KINDS[number];

export function isExportHomeKind(k: unknown): k is ExportHomeKind {
  return typeof k === 'string' && (EXPORT_HOME_KINDS as readonly string[]).includes(k);
}

/** The minimal host slice: just the profile read. */
interface HomeHost {
  profile: { get(): Promise<{ exportHome?: string } | null | undefined> };
}

export interface HomeExport {
  blob: Blob;
  /** Export format id ('png', 'svg', 'zip', …), lowercase - the send target uses
   *  it to name the file and (where it cares) gate on it. */
  format: string;
  /** Filename stem (no extension); the target appends `.${format}`. */
  name: string;
}

/**
 * Auto-send one finished export to the user's export home, when one is set and its
 * provider can take this format on this device right now. A no-op (returns silently)
 * when there is no home, the home provider isn't currently available (e.g. not
 * connected on this device), or it doesn't accept this format. Never throws.
 */
export async function autoSendToExportHome(host: HomeHost, exp: HomeExport): Promise<void> {
  let home: string | undefined;
  try { home = (await host.profile.get())?.exportHome; } catch { return; }
  if (!isExportHomeKind(home)) return;
  const target = sendTargetsFor(exp.format).find((tg) => tg.kind === home);
  if (!target) return;   // not connected on this device, or doesn't take this format
  // A target that asks where the file goes gets asked here too, BEFORE the job
  // toast opens - an auto-send is the user's standing choice, so a cancelled
  // picker is simply nothing happening, with no failure to report.
  let choice: Record<string, unknown> | undefined;
  if (target.prepare) {
    try {
      const picked = await target.prepare({ name: exp.name, format: exp.format, mime: exp.blob.type });
      if (!picked) return;
      choice = picked;
    } catch { return; }
  }
  const job = startJob({ title: t('Saving to {name}', { name: target.label }), heavy: false });
  await job.started;
  if (job.cancelled) return;
  try {
    const out = await target.send({
      bytes: new Uint8Array(await exp.blob.arrayBuffer()),
      name: exp.name,
      format: exp.format,
      mime: exp.blob.type,
      choice,
    });
    job.finish(out);   // { url?, label } - the toast renders the label + link
  } catch (err) {
    job.fail(err);
  }
}
