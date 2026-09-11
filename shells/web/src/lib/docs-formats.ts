// SPDX-License-Identifier: MPL-2.0
/**
 * The formats table's click-to-open detail dialog, for the in-app docs reader
 * (views/docs.ts) - the /info/formats.html page brought to parity in the app.
 *
 * The static build ships this behaviour as an inline <script> appended OUTSIDE
 * `.docs-content` (docs/build.ts FORMATS_DIALOG_SCRIPT); the reader strips every
 * fetched <script> by design, so the rehosted `.fmt-chip` buttons and the
 * `<dialog class="fmt-dialog">` markup arrive inert. This re-wires them:
 *
 *   - a delegated click on a `.fmt-chip` populates the rehosted dialog's slots
 *     (name / full / direction / description / supported specs+features / gaps)
 *     from the format catalog and opens it;
 *   - a backdrop click closes it (Escape and the ✕ close natively via the
 *     dialog's own `<form method="dialog">`).
 *
 * INVARIANTS:
 *   - ADDITIVE ONLY. No catalog, no dialog, or a parse error is a silent no-op -
 *     the chips simply stay as static pills, exactly as before this ran.
 *   - NO raw-HTML sink. Every text slot is filled with textContent; the category
 *     glyph is CLONED from the `.fmt-cat` icon already in the rehosted DOM rather
 *     than injected from the catalog's SVG string, so this adds nothing to the
 *     primitive-guards R10 ledger.
 *   - The listener is bound to `root` (the rehosted <article>), which the reader
 *     replaces on every navigation, so it needs no explicit teardown.
 *
 * The catalog JSON is read from the fetched document by the reader BEFORE it
 * strips scripts, and handed in here - it never survives in the mounted DOM (the
 * reader's "no fetched scripts" invariant, asserted in views/docs.test.ts).
 */

/** One format's record, as serialised by docs/build.ts's formatsSection(). */
interface FmtRecord {
  name: string;
  full: string;
  category: string;
  dir: 'in' | 'out' | 'both';
  features?: string[];
  desc?: string;
}

interface FmtCatalog {
  features?: Record<string, string>;
  specifics?: Record<string, string[]>;
  unsupported?: Record<string, string[]>;
  formats?: Record<string, FmtRecord>;
}

const DIR_LABEL: Record<FmtRecord['dir'], string> = {
  in: 'Reads · import only',
  out: 'Writes · export only',
  both: 'Reads & writes · round-trip',
};

/**
 * Wire the formats dialog inside `root`, using the catalog serialised into
 * `catalogRaw` (the textContent of the built page's `#fmt-catalog-data`). Safe to
 * call on any docs page: it returns immediately unless the page carries both the
 * catalog and a `.fmt-dialog`.
 */
export function enhanceDocsFormats(root: HTMLElement, catalogRaw: string | null): void {
  if (!catalogRaw) return;
  const dialog = root.querySelector<HTMLDialogElement>('.fmt-dialog');
  if (!dialog) return;

  let catalog: FmtCatalog;
  try {
    catalog = JSON.parse(catalogRaw) as FmtCatalog;
  } catch {
    return;
  }
  const formats = catalog.formats;
  if (!formats) return;

  // Category name → its glyph, cloned from the icons already rendered in the
  // table (the header row's .fmt-cat is empty and skipped). Cloning keeps the
  // dialog off the raw-HTML path the catalog's SVG string would need.
  const catIcon = new Map<string, SVGElement>();
  for (const cat of root.querySelectorAll<HTMLElement>('.fmt-cat')) {
    const label = cat.querySelector('.fmt-cat-label')?.textContent?.trim();
    const svg = cat.querySelector('svg');
    if (label && svg && !catIcon.has(label)) catIcon.set(label, svg);
  }

  const slot = (sel: string) => dialog.querySelector<HTMLElement>(sel);
  const fill = (sel: string, text: string) => {
    const el = slot(sel);
    if (el) el.textContent = text;
  };
  const list = (sel: string, items: string[]) => {
    const ul = slot(sel);
    if (!ul) return;
    ul.replaceChildren();
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    }
  };

  const open = (token: string): void => {
    const f = formats[token];
    if (!f) return;

    const iconSlot = slot('#fmt-dlg-icon');
    if (iconSlot) {
      iconSlot.replaceChildren();
      const glyph = catIcon.get(f.category);
      if (glyph) iconSlot.appendChild(glyph.cloneNode(true));
    }
    fill('#fmt-dlg-dir', DIR_LABEL[f.dir] || '');
    fill('#fmt-dlg-name', f.name);
    fill('#fmt-dlg-full', `${f.full} · ${f.category}`);
    fill('#fmt-dlg-desc', f.desc || '');
    list('#fmt-dlg-specs', catalog.specifics?.[token] || []);
    list('#fmt-dlg-feats', (f.features || []).map((k) => catalog.features?.[k] || k));

    const gaps = catalog.unsupported?.[token] || [];
    list('#fmt-dlg-unsup', gaps);
    const unsupWrap = slot('#fmt-dlg-unsup-wrap');
    if (unsupWrap) unsupWrap.hidden = gaps.length === 0;

    // Progressive enhancement of static markup, not a hand-rolled lifecycle: the
    // dialog, its Escape/✕ close (native <form method="dialog">) and focus are
    // the platform's. setAttribute('open') is the fallback for engines without
    // showModal. (Allowlisted in primitive-guards.test.ts R1, like dashboard.ts.)
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  root.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.fmt-chip');
    if (!chip) return;
    e.preventDefault();
    const token = chip.getAttribute('data-fmt');
    if (token) open(token);
  });
  // Backdrop click (the event target is the dialog element itself, never its
  // inner content) dismisses it.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}
