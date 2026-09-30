// SPDX-License-Identifier: MPL-2.0
/** Snapshot the selected view, produce a PDF, and verify its signature before delivery. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebHost } from '../bridge/export-shared.ts';
import { deliverFile } from '../lib/deliver-file.ts';
import { outcomeOf } from '../bridge/download.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { forensicStateForReport } from './valid-forensics.ts';
import { productionForReport } from './valid-production.ts';
import { renderLocator } from './valid-context.ts';
import type { VerifyPdfInput } from './valid-report-pdf.ts';

function sectionText(element: Element, exclude = ''): string {
  const clone = element.cloneNode(true) as HTMLElement;
  if (exclude)
    clone.querySelectorAll(exclude).forEach((node) => {
      node.remove();
    });
  clone
    .querySelectorAll(
      'button, input, select, textarea, svg, style, script, [hidden], [data-toolbar-source], .forensic, [data-claim-panel], .valid-meta-actions, .valid-meta-count, .valid-meta-group summary small'
    )
    .forEach((node) => {
      node.remove();
    });
  clone
    .querySelectorAll('p, li, dt, dd, h2, h3, h4, summary, tr, div, .guide-fact')
    .forEach((node) => {
      node.append('\n');
    });
  clone.querySelectorAll('span, strong, small, a').forEach((node) => {
    node.append(' ');
  });
  return (clone.textContent ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
export async function saveReportCard(
  host: HostV1,
  btn: HTMLButtonElement,
  file?: File
): Promise<void> {
  const scope = btn.closest<HTMLElement>('.valid-result');
  if (!scope || !file) return;
  const span = btn.querySelector('span'),
    original = span?.textContent ?? '';
  const reportError = scope.querySelector('[data-report-error]');
  reportError?.remove();
  btn.disabled = true;
  if (span) span.textContent = t('Preparing…');
  try {
    const { buildVerifyPdf, reportPreviewPng } = await import('./valid-report-pdf.ts');
    const panel = scope.querySelector<HTMLElement>('.forensic');
    if (panel?.hasAttribute('aria-busy'))
      throw new Error(t('Wait for inspection to finish, then save the report.'));
    const state = panel ? forensicStateForReport(panel) : undefined;
    const snapshot: VerifyPdfInput = {
      name: file.name,
      textPreview: scope.querySelector('.valid-preview-text')?.textContent ?? undefined,
      verdict:
        scope.querySelector('.valid-hero-pill, .valid-hero-verdict')?.textContent?.trim() ?? '',
      timestamp: new Date().toISOString(),
      sha256: '',
      signing: '',
      sections: [],
      ...(productionForReport(file)
        ? { production: structuredClone(productionForReport(file)) }
        : {}),
      ...(state
        ? {
            forensic: {
              report: structuredClone(state.collection.report),
              annotations: structuredClone(state.annotations),
              pageCount: state.collection.pageCount,
              previews: new Map(),
              imported: state.imported,
            },
          }
        : {}),
    };
    const { captureReportTheme } = await import('./valid-report-theme.ts');
    snapshot.theme = await captureReportTheme(host, scope);
    const groups: [string, string][] = [
      [
        'Credentials',
        '.valid-top, .valid-origin-layout > :not(.valid-preview), [data-lamp-section="provenance"]',
      ],
      ['People and links', '.valid-people, .valid-recorded-links'],
      ['Origin', '[data-lamp-section="origin"]'],
      ['Metadata', '.valid-meta, .valid-auxiliary'],
      ['Text checks', '.valid-text-preflight, [data-ocr-result]'],
      ['Checks', '.valid-receipt, .valid-wm, .valid-seal, .valid-notes'],
    ];
    for (const [title, selector] of groups) {
      const nodes = [...scope.querySelectorAll(selector)].filter(
        (node) => !node.parentElement?.closest(selector)
      );
      const text = nodes
        .map((node) =>
          sectionText(
            node,
            title === 'Credentials'
              ? '.valid-meta, .valid-auxiliary, .valid-hero-title'
              : title === 'Text checks'
                ? '.valid-tsig-extract'
                : ''
          )
        )
        .filter(Boolean)
        .join('\n\n');
      if (text) snapshot.sections.push({ title, text });
    }
    const preview = scope.querySelector<HTMLImageElement>('.valid-preview-stage img');
    const previewJobs: Promise<void>[] = [];
    if (preview)
      previewJobs.push(
        reportPreviewPng(preview.src)
          .then((image) => {
            snapshot.preview = image;
          })
          .catch(() => {
            snapshot.sections.push({
              title: 'Preview',
              text: 'The displayed preview could not be included.',
            });
          })
      );
    if (state)
      for (const [id, url] of state.collection.previews)
        previewJobs.push(
          reportPreviewPng(url)
            .then((image) => {
              snapshot.forensic!.previews.set(id, image);
            })
            .catch(() => {})
        );
    const gps = scope.querySelector<HTMLElement>('[data-request-address]');
    if (gps) {
      const lat = Number(gps.dataset.lat),
        lon = Number(gps.dataset.lon);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
      ) {
        const svg = renderLocator(lat, lon)
          .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="528" ')
          .replace(
            '<rect ',
            `<style>.valid-locator-sea{fill:${snapshot.theme.surface}}.valid-locator-land{fill:${snapshot.theme.line}}.valid-locator-tick{stroke:${snapshot.theme.accent};stroke-width:2}.valid-locator-halo{fill:${snapshot.theme.paper}}.valid-locator-dot{fill:${snapshot.theme.accent}}</style><rect `
          );
        previewJobs.push(
          reportPreviewPng(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).then(
            (image) => {
              snapshot.map = { image, coordinates: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
            }
          )
        );
      }
    }
    const { embedC2pa, verifyC2pa, ENGINE_VERSION } = await import('@lolly/engine');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    snapshot.sha256 = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (snapshot.forensic && snapshot.forensic.report.artifactSha256 !== snapshot.sha256)
      throw new Error(t('The evidence belongs to a different file. Inspect this file again.'));
    await Promise.all(previewJobs);
    const signer = await (host as WebHost).identity?.signer();
    snapshot.signing = signer
      ? 'Created by Lolly. Content Credentials use the enrolled device identity.'
      : 'Created and signed locally by Lolly. The device signature is self-signed; no verified publisher identity is claimed.';
    const pdf = await buildVerifyPdf(snapshot);
    const signed = await embedC2pa(pdf, 'pdf', {
      title: `Verification of ${file.name}`,
      claimGenerator: `Lolly Verify ${ENGINE_VERSION} lolly.tools`,
      generatorInfo: { name: 'Lolly Verify', version: ENGINE_VERSION },
      actions: [
        {
          action: 'c2pa.created',
          description:
            'Created a verification report from local observations. The signature attests this report, not authorship of the inspected file.',
        },
      ],
      environment: {
        application: 'Lolly Verify',
        sourceSha256: snapshot.sha256,
        ...(snapshot.forensic ? { evidenceSha256: snapshot.forensic.report.reportSha256 } : {}),
      },
      ...(signer ? { signer } : {}),
    });
    const checked = await verifyC2pa(signed);
    if (checked.state !== 'valid')
      throw new Error(t('Report signing could not be verified. No report was saved.'));
    const delivery = await deliverFile(
      host,
      new Blob([signed as BlobPart], { type: 'application/pdf' }),
      `${file.name.replace(/\.[a-z0-9]+$/i, '')}-verification.pdf`
    );
    const outcome = outcomeOf(delivery);
    announce(
      outcome === 'saved'
        ? t('Signed PDF saved.')
        : outcome === 'cancelled'
          ? t('Save cancelled.')
          : t('Signed PDF download requested.')
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : t('The PDF could not be created.');
    const note = document.createElement('p');
    note.dataset.reportError = '';
    note.setAttribute('role', 'alert');
    note.textContent = message;
    scope.querySelector('.valid-receipt')?.append(note);
    announce(message);
  } finally {
    btn.disabled = false;
    if (span) span.textContent = original;
  }
}
