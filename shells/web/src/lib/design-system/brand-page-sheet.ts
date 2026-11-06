// SPDX-License-Identifier: MPL-2.0
/**
 * Publish a brand page (plan 351 B2): the live page as the hero, with a column for what
 * goes public, what was held back and why, what was checked, and the publisher's own
 * words. Nothing leaves the device until the person presses Download folder or Publish.
 *
 * The page runs in a sandboxed frame with no scripts and no origin, so a stranger's
 * words in a token document can do nothing but read as text. The only markup this file
 * writes from data is through `textContent`.
 */
import type { BrandPageHeldV1 } from '@lolly-tools/core/brand-page-v1';
import type { BrandPageBuildV1, BrandPageExampleInputV1, BrandPageOutlineV1 } from '../../../../../engine/src/brand-page.ts';
import { mountModal } from '../../components/modal.ts';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../icons.ts';
import { fmtBytes } from '../format.ts';
import { zipAsync } from '../zip.ts';
import { OWNER_PUBLISHED } from '../../../../../engine/src/asset-rights.ts';
import { brandPageAddress } from '../../../../../engine/src/brand-page-address.ts';
import { connectedInstance, type BrandPageHostingV1 } from '../brand-page-hosting.ts';
import { brandPagePreviewHtml } from './brand-page-preview.ts';
import { readBrandPageSetting, writeBrandPageSetting } from './brand-page-record.ts';
import {
  assembleBrandPage, drawBrandPageExamples, drawBrandPageOutlines, EMPTY_CHOICES, includableLogos, readBrandPageSources,
  type BrandPageChoices, type BrandPageHost, type BrandPageSources,
} from './brand-page-sources.ts';
import '../../styles/parts/brand-page.css';

const REBUILD_MS = 400;
/** The publisher's draft words, on this device, per system. Not tool state: no tool can read this. */
const draftKey = (id: string): string => `lolly:brand-page:${id}`;

function readDraft(id: string): BrandPageChoices {
  try {
    const raw = JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null') as Partial<BrandPageChoices> | null;
    if (!raw || typeof raw !== 'object') return { ...EMPTY_CHOICES };
    return {
      statement: typeof raw.statement === 'string' ? raw.statement : '',
      contact: typeof raw.contact === 'string' ? raw.contact : '',
      origin: typeof raw.origin === 'string' ? raw.origin : '',
      madeWith: raw.madeWith !== false,
      include: Array.isArray(raw.include) ? raw.include.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch { return { ...EMPTY_CHOICES }; }
}

function saveDraft(id: string, choices: BrandPageChoices): void {
  try { localStorage.setItem(draftKey(id), JSON.stringify(choices)); } catch { /* private window: the draft lasts as long as the sheet */ }
}

/** A slug the address can carry. The instance has the last word. */
export function pageSlug(name: string): string {
  return name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'brand';
}

/** How the file list reads: groups a person recognises, in the order they care about. */
const FILE_GROUPS: ReadonlyArray<{ label: () => string; roles: readonly string[] }> = [
  { label: () => t('Logos'), roles: ['logo'] },
  { label: () => t('Fonts'), roles: ['font'] },
  { label: () => t('Examples'), roles: ['example'] },
  { label: () => t('Tokens and DESIGN.md'), roles: ['tokens', 'tokens-resolved', 'design-md', 'design-md-variant'] },
  { label: () => t('Brand skills'), roles: ['skill'] },
];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function fileRows(build: BrandPageBuildV1): HTMLElement[] {
  const files = build.manifest.files;
  const known = new Set(FILE_GROUPS.flatMap(group => group.roles));
  const groups = [...FILE_GROUPS, { label: () => t('The page and its indexes'), roles: [...new Set(files.map(f => f.role))].filter(role => !known.has(role)) }];
  return groups.flatMap(group => {
    const rows = files.filter(file => group.roles.includes(file.role));
    if (!rows.length) return [];
    const details = node('details', 'bp-files');
    const summary = node('summary', '');
    summary.append(node('span', '', group.label()), node('span', 'bp-count', String(rows.length)));
    const list = node('ul', 'bp-file-list');
    for (const file of rows) {
      const li = node('li', '');
      li.append(node('code', '', file.path), node('span', 'bp-count', fmtBytes(file.size)));
      list.append(li);
    }
    details.append(summary, list);
    return [details];
  });
}

function heldRows(held: readonly BrandPageHeldV1[]): HTMLElement {
  const list = node('ul', 'bp-held-list');
  for (const row of held) {
    const li = node('li', '');
    li.append(node('strong', '', row.item), node('span', '', row.reason));
    list.append(li);
  }
  return list;
}

function checkRows(build: BrandPageBuildV1): HTMLElement[] {
  const { variants = [], rules = [] } = build.checks;
  const pairs = variants.flatMap(variant => variant.pairs.map(pair => ({ ...pair, colourway: variant.colourway, mode: variant.mode })));
  const low = pairs.filter(pair => typeof pair.contrast === 'number' && pair.contrast < 3);
  const out: HTMLElement[] = [
    node('p', 'bp-line', t('{pairs} colour pairs measured across {looks} looks.', { pairs: pairs.length, looks: variants.length })),
    node('p', 'bp-line', low.length ? t('{n} read below 3:1.', { n: low.length }) : t('None read below 3:1.')),
    node('p', 'bp-line', rules.length
      ? t('{rules} house rules run, {found} with findings.', { rules: rules.length, found: rules.filter(rule => rule.findings > 0).length })
      : t('This system states no house rules to run.')),
  ];
  if (low.length) {
    const list = node('ul', 'bp-held-list');
    for (const pair of low.slice(0, 40)) {
      const li = node('li', '');
      li.append(node('strong', '', pair.label), node('span', '', `${pair.colourway} ${pair.mode}: ${pair.contrast.toFixed(2)}:1`));
      list.append(li);
    }
    out.push(list);
  }
  const found = rules.filter(rule => rule.findings > 0);
  if (found.length) {
    const list = node('ul', 'bp-held-list');
    for (const rule of found.slice(0, 40)) {
      const li = node('li', '');
      li.append(node('strong', '', rule.label), node('span', '', t('{n} findings.', { n: rule.findings })));
      list.append(li);
    }
    out.push(list);
  }
  if (build.checks.statement) out.push(node('p', 'bp-note', build.checks.statement));
  return out;
}

/** Open the sheet. Resolves when it closes. */
export async function openBrandPageSheet(host: BrandPageHost): Promise<void> {
  const hosting: BrandPageHostingV1 | null = connectedInstance()?.brandPages ?? null;
  let alive = true;
  let settle: () => void = () => {};
  const closed = new Promise<void>(resolve => { settle = resolve; });
  const controller = new AbortController();
  const modal = mountModal(`
    <header class="bp-head">
      <div>
        <h2 class="modal-title">${t('Publish a brand page')}</h2>
        <p class="bp-intro">${t('One address for people and for agents.')}</p>
      </div>
      <button type="button" class="bp-close" data-bp-close aria-label="${t('Close')}">${icon('close', { size: 20 })}</button>
    </header>
    <div class="bp-body">
      <div class="bp-stage">
        <iframe class="bp-frame" sandbox="" referrerpolicy="no-referrer" title="${t('Preview of the brand page')}"></iframe>
        <p class="bp-stage-note" data-bp-stage-note role="status">${t('Reading this design system…')}</p>
      </div>
      <div class="bp-side">
        <section class="bp-section">
          <h3>${t('In your words')}</h3>
          <label class="field-label">${t('Usage statement')}
            <textarea class="field-input bp-statement" data-bp-statement rows="3" maxlength="4000"></textarea>
          </label>
          <label class="field-label">${t('Contact')}
            <input class="field-input" data-bp-contact maxlength="300">
          </label>
          <p class="bp-note">${t('The page prints these as you write them. Lolly adds no licence or legal claim.')}</p>
          <details class="bp-more" data-bp-address>
            <summary>${t('Where it will live')}</summary>
            <label class="field-label">${t('Address, if you know it')}
              <input class="field-input" data-bp-origin type="url" inputmode="url" maxlength="2000" placeholder="https://">
            </label>
            <p class="bp-note">${t('Recorded in brand.json and llms.txt.')}</p>
          </details>
          <label class="field-toggle bp-switch">
            <input type="checkbox" class="field-check" data-bp-madewith checked>
            <span>${t('Show “Made with Lolly” in the footer')}</span>
          </label>
        </section>
        <section class="bp-section" data-bp-record hidden>
          <h3>${t('On exports')}</h3>
          <label class="field-toggle bp-switch">
            <input type="checkbox" class="field-check" data-bp-record-on disabled>
            <span>${t('Record the page address in exports')}</span>
          </label>
          <p class="bp-note" data-bp-record-note role="status" aria-live="polite"></p>
        </section>
        <section class="bp-section">
          <h3><span data-bp-public-title>${t('Goes public')}</span> <span class="bp-count" data-bp-total></span></h3>
          <p class="bp-note" data-bp-owner-note hidden>${t('Owner-published logos go out on the terms their record states, and the page prints those terms.')}</p>
          <div data-bp-files></div>
        </section>
        <details class="bp-section bp-disclose" data-bp-held-box open hidden>
          <summary><h3>${t('Held back')} <span class="bp-count" data-bp-held-count></span></h3></summary>
          <div class="bp-include-box" data-bp-include-box hidden>
            <p class="bp-note">${t('These logos have no recorded licence.')}</p>
            <p class="bp-note">${t('They stay out unless you say you may publish them.')}</p>
            <div class="bp-includes" data-bp-includes></div>
          </div>
          <div data-bp-held></div>
        </details>
        <details class="bp-section bp-disclose">
          <summary><h3>${t('What was checked')}</h3></summary>
          <div data-bp-checks></div>
        </details>
      </div>
    </div>
    <footer class="bp-foot">
      <p class="bp-status" data-bp-status role="status" aria-live="polite"></p>
      <div class="bp-actions">
        <a class="be-btn" data-bp-open target="_blank" rel="noopener noreferrer" hidden>${icon('externalLink', { size: 16 })}<span>${t('Open the page')}</span></a>
        <button type="button" class="be-btn" data-bp-download disabled>${icon('download', { size: 16 })}<span>${t('Download folder')}</span></button>
        <button type="button" class="be-cta is-active" data-bp-publish hidden disabled>${icon('globe', { size: 16 })}<span data-bp-publish-label></span></button>
      </div>
    </footer>
  `, { className: 'modal brand-page-sheet', ariaLabel: t('Publish a brand page'), onClose: () => { alive = false; controller.abort(); settle(); } });
  const el = modal.el;
  const $ = <T extends HTMLElement>(selector: string): T => el.querySelector<T>(selector)!;
  const frame = $<HTMLIFrameElement>('.bp-frame');
  const stageNote = $('[data-bp-stage-note]');
  const status = $('[data-bp-status]');
  const download = $<HTMLButtonElement>('[data-bp-download]');
  const publish = $<HTMLButtonElement>('[data-bp-publish]');
  const say = (message: string, isError = false): void => { status.textContent = message; status.classList.toggle('is-error', isError); };
  el.querySelector('[data-bp-close]')!.addEventListener('click', () => modal.close());

  const refuse = (message: string): void => {
    stageNote.hidden = false;
    stageNote.textContent = message;
    frame.hidden = true;
    download.disabled = true;
  };

  // An instance that offers this caller publishing is the manager's yes for what it manages.
  const sources: BrandPageSources | null = await readBrandPageSources(host, { allowManaged: !!hosting }).catch(() => null);
  if (!alive) return closed;
  if (!sources) {
    refuse(t('There is nothing to publish yet. Add colours, type or logos first, then come back.'));
    return closed;
  }

  const draftId = sources.id || sources.name;
  const choices = readDraft(draftId);
  const statement = $<HTMLTextAreaElement>('[data-bp-statement]');
  const contact = $<HTMLInputElement>('[data-bp-contact]');
  const origin = $<HTMLInputElement>('[data-bp-origin]');
  const madeWith = $<HTMLInputElement>('[data-bp-madewith]');
  statement.value = choices.statement;
  contact.value = choices.contact;
  origin.value = choices.origin;
  madeWith.checked = choices.madeWith;

  const blockedByManager = sources.managed && !hosting;
  const may = !blockedByManager;

  // A logo with no licence on record is the publisher's call, one tick each.
  const candidates = includableLogos(sources.logos);
  $('[data-bp-include-box]').hidden = candidates.length === 0 || blockedByManager;
  for (const logo of candidates) {
    const label = node('label', 'field-toggle');
    const box = node('input', 'field-check');
    box.type = 'checkbox';
    box.checked = choices.include.includes(logo.id);
    box.dataset.bpInclude = logo.id;
    label.append(box, node('span', '', logo.name ?? logo.id));
    $('[data-bp-includes]').append(label);
  }

  let examples: BrandPageExampleInputV1[] = [];
  let outlines: BrandPageOutlineV1[] = [];
  let exampleHeld: BrandPageHeldV1[] = [];
  let outlineHeld: BrandPageHeldV1[] = [];
  const drawn = (): Parameters<typeof assembleBrandPage>[2] => ({ examples, outlines, held: [...outlineHeld, ...exampleHeld] });
  let latest: BrandPageBuildV1 | null = null;
  let revision = 0;

  // Whether exports name the page. Off until there is a page to name, and each change is
  // the person's own act: nothing here turns the setting on for them.
  const recordBox = $('[data-bp-record]');
  const recordOn = $<HTMLInputElement>('[data-bp-record-on]');
  const recordNote = $('[data-bp-record-note]');
  const setting = await readBrandPageSetting(host).catch(() => ({ address: null, locked: true }));
  if (!alive) return closed;
  let recorded = setting.address;
  /** The address an instance gave back for a live page. */
  let hostedAddress: string | null = null;
  let hostedRefused = false;
  const addressNow = (): string | null => hosting && may ? hostedAddress ?? recorded : brandPageAddress(choices.origin);
  const paintRecord = (): void => {
    const address = addressNow();
    recordOn.checked = !!recorded;
    recordOn.disabled = !recorded && !address;
    recordNote.textContent = recorded ? tRaw('Exports record {address}. The export panel shows this and can leave the record out.', { address: recorded })
      : address ? t('Turn this on once the page is live. The export panel shows the address and can leave the record out.')
      : hostedRefused || (!hosting && choices.origin.trim()) ? t('Only an https address on a named host can be recorded.')
      : hosting ? t('You can turn this on once the page is published.')
      : t('Add the page address under “Where it will live” first.');
  };
  const saveRecord = async (address: string | null): Promise<void> => {
    recordOn.disabled = true;
    try {
      await writeBrandPageSetting(host, address, sources.name);
      recorded = address;
    } catch (error) {
      say(tRaw('Could not save this: {error}', { error: String((error as Error)?.message ?? error) }), true);
    }
    if (alive) paintRecord();
  };
  recordBox.hidden = setting.locked || blockedByManager;
  if (recorded && !hosting && !choices.origin) {
    choices.origin = recorded;
    origin.value = recorded;
  }
  if (recorded && !hosting) $<HTMLDetailsElement>('[data-bp-address]').open = true;
  recordOn.addEventListener('change', () => { void saveRecord(recordOn.checked ? addressNow() : null); });
  // Editing the address while the setting is on moves the setting, or turns it off if the new one cannot be recorded.
  origin.addEventListener('change', () => {
    if (recorded && !hosting && brandPageAddress(choices.origin) !== recorded) void saveRecord(brandPageAddress(choices.origin));
  });
  paintRecord();

  const paint = (build: BrandPageBuildV1): void => {
    latest = build;
    frame.srcdoc = brandPagePreviewHtml(build.files.map(file => ({ path: file.path, mediaType: file.mediaType, bytes: file.bytes })));
    const bytes = build.manifest.files.reduce((sum, file) => sum + file.size, 0);
    $('[data-bp-total]').textContent = `${build.manifest.files.length} · ${fmtBytes(bytes)}`;
    // Keep what the person has opened, across a rebuild.
    const opened = new Set([...el.querySelectorAll<HTMLDetailsElement>('.bp-files[open] summary span:first-child')].map(span => span.textContent));
    const rows = fileRows(build);
    for (const row of rows) if (opened.has(row.querySelector('summary span')?.textContent ?? '')) (row as HTMLDetailsElement).open = true;
    $('[data-bp-files]').replaceChildren(...rows);
    $('[data-bp-owner-note]').hidden = !build.manifest.logos?.some(logo => logo.licence === OWNER_PUBLISHED);
    // A logo the publisher can tick is shown once, in the ticks above the list.
    const held = build.manifest.held;
    $('[data-bp-held-box]').hidden = held.length === 0 && candidates.length === 0;
    $('[data-bp-held-count]').textContent = String(held.length);
    $('[data-bp-held]').replaceChildren(heldRows(held.filter(row => !candidates.some(logo => logo.id === row.item))));
    $('[data-bp-checks]').replaceChildren(...checkRows(build));
    download.disabled = !may;
    publish.disabled = !may;
  };

  const rebuild = async (): Promise<void> => {
    const mine = ++revision;
    try {
      const build = await assembleBrandPage(sources, choices, drawn());
      if (!alive || mine !== revision) return;
      paint(build);
    } catch (error) {
      if (!alive || mine !== revision) return;
      say(tRaw('Could not build the page: {error}', { error: String((error as Error)?.message ?? error) }), true);
    }
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const remember = (): void => { saveDraft(draftId, choices); };
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; remember(); void rebuild(); }, REBUILD_MS);
  };
  const flush = async (): Promise<void> => {
    if (timer) { clearTimeout(timer); timer = null; remember(); await rebuild(); }
  };

  el.addEventListener('input', event => {
    const target = event.target as HTMLElement;
    if (target === statement) choices.statement = statement.value;
    else if (target === contact) choices.contact = contact.value;
    else if (target === origin) { choices.origin = origin.value; paintRecord(); }
    else if (target === madeWith) choices.madeWith = madeWith.checked;
    else if (target instanceof HTMLInputElement && target.dataset.bpInclude) {
      const id = target.dataset.bpInclude;
      choices.include = target.checked ? [...new Set([...choices.include, id])] : choices.include.filter(row => row !== id);
      void drawExamples();
    } else return;
    schedule();
  });

  // Specimens once, examples again if a newly included logo could appear in one.
  let drawing = 0;
  let outlineRead: ReturnType<typeof drawBrandPageOutlines> | null = null;
  const drawExamples = async (): Promise<void> => {
    const mine = ++drawing;
    outlineRead ??= drawBrandPageOutlines(host, sources).catch(() => ({ outlines: [], held: [] }));
    const read = await outlineRead;
    if (!alive || mine !== drawing) return;
    outlines = read.outlines;
    outlineHeld = read.held;
    await rebuild();
    stageNote.hidden = false;
    stageNote.textContent = t('Drawing examples…');
    const frames = await drawBrandPageExamples(host, sources, choices.include, controller.signal).catch(() => null);
    if (!alive || mine !== drawing) return;
    stageNote.hidden = true;
    if (frames) { examples = frames.examples; exampleHeld = frames.held; }
    await rebuild();
  };

  // The way out with no server. Pressing the button is the act, and nothing leaves before that.
  download.addEventListener('click', () => {
    void (async () => {
      await flush();
      if (!latest || !may) return;
      download.disabled = true;
      say(t('Packing the folder…'));
      try {
        const bundle = await zipAsync(Object.fromEntries(latest.files.map(file => [file.path, file.bytes])));
        await host.export.download(new Blob([bundle], { type: 'application/zip' }), `${pageSlug(sources.name)}-brand-page.zip`);
        say(t('Downloaded. Nothing has gone public. Host the folder wherever you choose.'));
      } catch (error) {
        say(tRaw('Could not save the folder: {error}', { error: String((error as Error)?.message ?? error) }), true);
      } finally { download.disabled = false; }
    })();
  });

  const wirePublish = (active: BrandPageHostingV1): void => {
    publish.hidden = false;
    $('[data-bp-publish-label]').textContent = tRaw('Publish to {host}', { host: active.host });
    // The instance decides the address, so a typed one could only disagree with that.
    $('[data-bp-address]').hidden = true;
    choices.origin = '';
    publish.addEventListener('click', () => {
      void (async () => {
        await flush();
        if (!latest || !may) return;
        publish.disabled = true;
        say(t('Publishing…'));
        try {
          // The address is recorded inside the folder, so the build that goes up holds the address.
          const url = `${active.base}/brand/${encodeURIComponent(latest.manifest.id)}/`;
          const build = await assembleBrandPage(sources, { ...choices, origin: url }, drawn());
          const bundle = await zipAsync(Object.fromEntries(build.files.map(file => [file.path, file.bytes])));
          if (bundle.length > active.maxBundleBytes) {
            say(tRaw('This folder is {size}. {host} takes up to {limit}.', { size: fmtBytes(bundle.length), host: active.host, limit: fmtBytes(active.maxBundleBytes) }), true);
            return;
          }
          const result = await active.publish({ bundle });
          if (!alive) return;
          say(result.state === 'pending' ? t('Sent for approval. It goes live when it is approved.')
            : result.state === 'unchanged' ? tRaw('Nothing changed. It is still live at {url}', { url: result.url })
            : tRaw('Published at {url}', { url: result.url }));
          if (result.state !== 'pending') {
            const open = $<HTMLAnchorElement>('[data-bp-open]');
            open.href = result.url;
            open.hidden = false;
            hostedAddress = brandPageAddress(result.url);
            hostedRefused = !hostedAddress;
            if (recorded && hostedAddress && hostedAddress !== recorded) await saveRecord(hostedAddress);
            else paintRecord();
          }
        } catch (error) {
          say(tRaw('{host} did not take the folder: {error}', { host: active.host, error: String((error as Error)?.message ?? error) }), true);
        } finally { publish.disabled = false; }
      })();
    });
  };
  if (hosting && may) wirePublish(hosting);

  if (blockedByManager) {
    download.hidden = true;
    $('[data-bp-public-title]').textContent = t('Would go public');
    say(tRaw('{name} is a managed design system. Its manager decides when it is published.', { name: sources.name }));
  } else say(hosting ? t('Nothing goes public until you press Publish.') : t('Nothing goes public from here. You host the folder.'));

  await rebuild();
  stageNote.hidden = true;
  void drawExamples();
  return closed;
}
