function onInit({ model }) {
  // Only apply OS preference when theme is still the manifest default ('light').
  const theme = model.find(i => i.id === 'theme');
  if (theme?.value === 'light' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return { theme: 'dark' };
  }
}
