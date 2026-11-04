// SPDX-License-Identifier: MPL-2.0
window.__LOLLY_UPDATER_QUALIFICATION__ = {};
(async () => {
  const delay = () => new Promise(resolve => setTimeout(resolve, 250));
  const invoke = (...args) => window.__TAURI_INTERNALS__.invoke(...args);
  window.addEventListener('error', event => {
    void invoke('updater_probe_report', { value: { phase: 'bootstrap-error', message: event.message, filename: event.filename, line: event.lineno } });
  });
  await invoke('updater_probe_report', { value: { phase: 'bootstrap' } });
  while (!window.__LOLLY_UPDATER_QUALIFICATION__.owner) await delay();
  const { owner, host } = window.__LOLLY_UPDATER_QUALIFICATION__;
  let command = null, error = '', restored = null, result = null;
  let reporting = Promise.resolve();
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');
  const request = value => new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))].map(v => v.toString(16).padStart(2, '0')).join('');
  async function database() { return request(indexedDB.open('lolly')); }
  async function put(store, value, key) {
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        if (key === undefined) tx.objectStore(store).put(value); else tx.objectStore(store).put(value, key);
      });
    } finally { db.close(); }
  }
  async function get(store, key) {
    const db = await database();
    try { return await request(db.transaction(store).objectStore(store).get(key)); }
    finally { db.close(); }
  }
  function report() {
    reporting = reporting.catch(() => {}).then(() => invoke('updater_probe_report', { value: {
      command, error, restored, result, state: owner.state, mode: owner.prefs.mode,
      route: location.hash, dialog: document.querySelector('.unsaved-dialog')?.textContent ?? '',
      bodyInert: document.body.inert,
    } }));
    return reporting;
  }
  owner.subscribe(() => { void report(); });
  await report();
  for (;;) {
    const next = await invoke('updater_probe_poll');
    if (!next) { await delay(); continue; }
    command = next;
    try {
      error = ''; result = null;
      if (next.action === 'mode') owner.setMode(next.mode);
      if (next.action === 'check') await owner.check(true);
      if (next.action === 'download') await owner.download();
      if (next.action === 'restart') void owner.install();
      if (next.action === 'quit') void owner.quit();
      if (next.action === 'navigate') location.hash = next.hash;
      if (next.action === 'click') {
        const el = document.querySelector(next.selector);
        if (!el) throw new Error('Missing probe click target');
        el.click();
      }
      if (next.action === 'input') {
        const el = document.querySelector(next.selector);
        if (!el) throw new Error('Missing probe input target');
        el.value = next.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (next.action === 'dom') result = {
        text: document.body.innerText.slice(-20000),
        fields: [...document.querySelectorAll('input, textarea, button, select')].filter(el => el.getClientRects().length).map(el => ({ tag: el.tagName, id: el.id, name: el.name, type: el.type, value: el.value, text: el.textContent?.slice(0, 100), ariaLabel: el.getAttribute('aria-label') })),
      };
      if (next.action === 'seed') {
        await host.state.save('updater-qualification', { __toolId: 'qr-code', url: 'https://example.com/update-survival' }, null);
        localStorage.setItem('lolly:updater-qualification-preference', 'preserved');
        await host.profile.set({ ...(await host.profile.get()), firstname: 'Updater qualification' });
        await put('user-assets', { id: 'user/updater-qualification', type: 'image', format: 'svg', version: '1', blob: new Blob([bytes], { type: 'image/svg+xml' }) });
        const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        await put('identity', keys, 'updater-qualification');
      }
      if (next.action === 'read') {
        const asset = await get('user-assets', 'user/updater-qualification');
        const keys = await get('identity', 'updater-qualification');
        const signature = keys ? await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, bytes) : null;
        restored = { document: await host.state.load('updater-qualification'),
          preference: localStorage.getItem('lolly:updater-qualification-preference'), profile: (await host.profile.get()).firstname,
          assetSha256: asset?.blob ? await digest(await asset.blob.arrayBuffer()) : null,
          expectedAssetSha256: await digest(bytes),
          credentialWorks: !!signature && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, signature, bytes),
          credentialExtractable: keys?.privateKey.extractable,
        };
      }
    } catch (e) { error = String(e); }
    await report();
  }
})().catch(error => { console.error('Updater probe failed', String(error)); });
