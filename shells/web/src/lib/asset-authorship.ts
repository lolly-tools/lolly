// SPDX-License-Identifier: MPL-2.0
/** An upload owner's authorship declaration, kept separately from file credentials and source credits. */
export interface AssetAuthorDeclaration {
  name: string;
  assertedBy: 'user';
  declaredAt: string;
}

export function readAuthorDeclaration(meta: Record<string, unknown> | undefined): AssetAuthorDeclaration | null {
  const value = meta?.authorDeclaration;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<AssetAuthorDeclaration>;
  if (record.assertedBy !== 'user' || typeof record.name !== 'string' || !record.name.trim()
    || record.name.length > 200 || typeof record.declaredAt !== 'string' || !Number.isFinite(Date.parse(record.declaredAt))) return null;
  return { name: record.name.trim(), assertedBy: 'user', declaredAt: record.declaredAt };
}

/** Changing this declaration preserves all source metadata, including AI and rights records. */
export function withAuthorDeclaration(meta: Record<string, unknown> | undefined, name: string | null, declaredAt: string): Record<string, unknown> {
  const next = { ...meta };
  if (name === null) delete next.authorDeclaration;
  else {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 200 || !Number.isFinite(Date.parse(declaredAt))) throw new Error('Enter an author name of up to 200 characters.');
    next.authorDeclaration = { name: trimmed, assertedBy: 'user', declaredAt } satisfies AssetAuthorDeclaration;
  }
  return next;
}
