// SPDX-License-Identifier: MPL-2.0
/** Worker receipts are checked by the runtime that owns the exported DOM. */
export function checkDesignLayoutReceipt(
  receipt: unknown,
  values: Record<string, unknown>,
  node: unknown
): void {
  const record = receipt as { values: Array<[string, unknown]>; stamp: string };
  if (
    JSON.stringify(record.values) !==
    JSON.stringify(
      Object.keys(values)
        .sort()
        .map((id) => [id, values[id]])
    )
  ) {
    throw new Error(
      'Layout is still changing. Wait for the current layout to appear, then export again.'
    );
  }
  const root = node as Element;
  const nodes = root?.querySelectorAll
    ? Array.from(root.querySelectorAll('[data-layout-receipt]'))
    : [];
  if (root?.matches?.('[data-layout-receipt]')) nodes.push(root);
  if (!nodes.length || nodes.some((n) => n.getAttribute('data-layout-receipt') !== record.stamp)) {
    throw new Error(
      'Layout is still changing. Wait for the current layout to appear, then export again.'
    );
  }
}
