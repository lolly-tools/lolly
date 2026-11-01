// SPDX-License-Identifier: MPL-2.0
/**
 * The licence record for each model family, read from shells/web/model-licences.json.
 *
 * Every entry is the publisher's stated licence, copied from its model card or
 * the fetch script that pins the files. The record holds their words, never a
 * clearance: nothing here says a model is safe to use for any purpose.
 *
 * models-manifest.json is generated and carries no licence, so this hand-kept
 * file sits next to the manifest. model-licences.test.ts fails when a family in
 * the manifest has no record.
 */
import records from '../../model-licences.json' with { type: 'json' };
import { t } from '../i18n.ts';

/** What the converter's own repository states about licence. */
export type ConverterLicence = string;

export interface ModelLicenceRecord {
  /** SPDX id, or the publisher's own name for the licence. */
  licence: string;
  url: string;
  upstream: { repo: string; revision: string };
  convertedBy: string;
  /** An SPDX id or name, or 'none-stated', 'not-recorded' or 'not-applicable'. */
  converterLicence: ConverterLicence;
  /** The publisher's terms carry use restrictions to show before the download. */
  acceptRequired: boolean;
  note: string;
  /** The English sentence shown before the download, when there is one. */
  offerLine?: string;
}

const FAMILIES = records.families as Readonly<Record<string, ModelLicenceRecord>>;

/** The record for a model family, or undefined when there is none. */
export function modelLicence(family: string): ModelLicenceRecord | undefined {
  return Object.hasOwn(FAMILIES, family) ? FAMILIES[family] : undefined;
}

/** Every family that has a record. */
export function modelLicenceFamilies(): string[] {
  return Object.keys(FAMILIES);
}

/** The line a surface shows before the download, translated, or undefined. The
 *  keys are listed in scripts/i18n/extra-keys.spa.json because t() is called
 *  with a variable here. */
export function modelLicenceLine(family: string): string | undefined {
  const line = modelLicence(family)?.offerLine;
  return line ? t(line) : undefined;
}
