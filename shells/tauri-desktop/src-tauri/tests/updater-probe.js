// SPDX-License-Identifier: MPL-2.0
window.__LOLLY_UPDATER_QUALIFICATION__ = {};
(async () => {
  const delay = () => new Promise(resolve => setTimeout(resolve, 250));
  const invoke = (...args) => window.__TAURI_INTERNALS__.invoke(...args);
  while (!window.__LOLLY_UPDATER_QUALIFICATION__.owner) await delay();
  const { owner, host } = window.__LOLLY_UPDATER_QUALIFICATION__;
  let command = null, error = '', restored = null;
  async function report() {
    await invoke('updater_probe_report', { value: { command, error, restored, state: owner.state, mode: owner.prefs.mode } });
  }
  await report();
  for (;;) {
    const next = await invoke('updater_probe_poll');
    if (!next) { await delay(); continue; }
    command = next;
    try {
      error = '';
      if (next.action === 'mode') owner.setMode(next.mode);
      if (next.action === 'check') await owner.check(true);
      if (next.action === 'download') await owner.download();
      if (next.action === 'restart') void owner.install();
      if (next.action === 'quit') void owner.quit();
      if (next.action === 'seed') {
        await host.state.save('updater-qualification', { __toolId: 'qr-code', url: 'https://example.com/update-survival' }, null);
        localStorage.setItem('lolly:updater-qualification-preference', 'preserved');
        await host.profile.set({ ...(await host.profile.get()), firstname: 'Updater qualification' });
      }
      if (next.action === 'read') {
        restored = { document: await host.state.load('updater-qualification'),
          preference: localStorage.getItem('lolly:updater-qualification-preference'), profile: (await host.profile.get()).firstname };
      }
    } catch (e) { error = String(e); }
    await report();
  }
})().catch(error => { console.error('Updater probe failed', String(error)); });
