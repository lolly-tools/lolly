/**
 * Export provenance — the generic authorship record embedded into every exported
 * media file (platform-agnostic; no format/DOM knowledge here).
 *
 * The engine assembles these fields from the host profile + the tool manifest;
 * each shell's export bridge then maps them onto the format's native metadata
 * mechanism (PNG iTXt, JPEG EXIF, PDF info dict, SVG <metadata>, …). This is the
 * clean path from author → asset: provenance travels with the file, not the app.
 *
 * Scope: provenance ONLY — who/what made the file. Deliberately NO copyright,
 * licence, or ownership assertions (the platform can't safely assert those).
 * Personal fields (author/contact) appear only if the user filled in their
 * profile; the "Lolly" software/source tags are always stamped.
 */
export async function buildExportMeta(host, manifest, profile) {
  // The runtime already resolved the profile at mount; callers pass it through to
  // avoid a redundant lookup. Fall back to fetching when omitted.
  let p = profile;
  if (p == null) {
    try { p = (await host?.profile?.get?.()) ?? {}; } catch { p = {}; }
  }

  const clean = (s) => (s == null ? '' : String(s).trim());
  // Personal details are embedded only when the user has opted in
  // (Profile → "Use my details"). The platform/tool attribution always stays.
  const optedIn = p.useDetails === true;
  const author  = optedIn ? [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(' ') : '';
  const contact = optedIn ? [clean(p.email), clean(p.phone)].filter(Boolean).join(' · ') : '';
  const tool    = clean(manifest?.name) || clean(manifest?.id);

  const description = ['Made with https://lolly.tools', tool && `— ${tool}`, author && `by ${author}`]
    .filter(Boolean).join(' ');

  return {
    software: 'Lolly',
    source: 'https://lolly.tools',
    tool,
    author,                                                   // '' if not opted in
    contact,                                                  // '' if none
    description,
  };
}
