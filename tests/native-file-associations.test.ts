// SPDX-License-Identifier: MPL-2.0
/** Cross-platform ownership and intake contract for the .lolly document type. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP = path.join(ROOT, 'shells/tauri-desktop');
const MOBILE = path.join(ROOT, 'shells/tauri-mobile');
const CANONICAL_MIME = 'application/vnd.lolly+zip';
const CANONICAL_UTI = 'tools.lolly.pack';
const HELPER_EXTENSIONS = [
  'penpot', 'fig', 'idml', 'ai', 'svg', 'pdf', 'xlsx', 'csv', 'tsv',
  'pptx', 'docx', 'psd', 'psb', 'xcf',
] as const;
const HELPER_MIMES = [
  'application/x-penpot',
  'application/x-figma',
  'application/vnd.adobe.indesign-idml-package',
  'application/illustrator',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/vnd.adobe.photoshop',
  'image/x-xcf',
] as const;

interface Association {
  ext?: string[];
  mimeType?: string;
  role?: string;
  rank?: string;
  contentTypes?: string[];
  exportedType?: { identifier?: string; conformsTo?: string[] };
  androidIntentActionFilters?: string[];
}

function associations(shell: string): Association[] {
  const file = path.join(shell, 'src-tauri/tauri.conf.json');
  const conf = JSON.parse(readFileSync(file, 'utf8')) as TauriConfig;
  const list = conf.bundle?.fileAssociations;
  assert.ok(Array.isArray(list), `${path.relative(ROOT, file)} has no bundle.fileAssociations`);
  return list!;
}

interface TauriConfig {
  identifier?: string;
  build?: { beforeBuildCommand?: string };
  bundle?: {
    fileAssociations?: Association[];
    resources?: Record<string, string>;
    macOS?: { files?: Record<string, string> };
  };
}

function association(shell: string): { assoc: Association; conf: TauriConfig } {
  const file = path.join(shell, 'src-tauri/tauri.conf.json');
  const conf = JSON.parse(readFileSync(file, 'utf8')) as TauriConfig;
  const list = conf.bundle?.fileAssociations as Association[] | undefined;
  assert.ok(Array.isArray(list), `${path.relative(ROOT, file)} has no bundle.fileAssociations`);
  const assoc = list!.find((a) => (a.ext ?? []).some((e) => e.replace(/^\./, '').toLowerCase() === 'lolly'));
  assert.ok(assoc, `${path.relative(ROOT, file)} does not claim .lolly`);
  return { assoc: assoc!, conf };
}

test('desktop and mobile bundles own one canonical .lolly type', () => {
  for (const shell of [DESKTOP, MOBILE]) {
    const { assoc } = association(shell);
    assert.equal(assoc.mimeType, CANONICAL_MIME);
    assert.equal(assoc.role, 'Editor');
    assert.equal(assoc.rank, 'Owner');
    assert.equal(assoc.exportedType?.identifier, CANONICAL_UTI);
    assert.ok(assoc.exportedType?.conformsTo?.includes('public.data'));
    assert.ok(assoc.exportedType?.conformsTo?.includes('public.archive'));
  }
  assert.ok(association(MOBILE).assoc.androidIntentActionFilters?.includes('view'),
    'mobile association must generate an Android ACTION_VIEW filter');
});

test('mobile bundle identifier matches the generated Android and Apple projects', () => {
  const configPath = path.join(MOBILE, 'src-tauri/tauri.conf.json');
  const conf = JSON.parse(readFileSync(configPath, 'utf8')) as TauriConfig;
  assert.equal(conf.identifier, 'tools.lolly.mobile');

  const gradle = readFileSync(path.join(MOBILE, 'src-tauri/gen/android/app/build.gradle.kts'), 'utf8');
  assert.match(gradle, /applicationId = "tools\.lolly\.mobile"/);

  const xcodeProject = readFileSync(
    path.join(MOBILE, 'src-tauri/gen/apple/lolly-mobile.xcodeproj/project.pbxproj'),
    'utf8',
  );
  assert.doesNotMatch(xcodeProject, /PRODUCT_BUNDLE_IDENTIFIER = tools\.lolly\.desktop/);
  assert.match(xcodeProject, /PRODUCT_BUNDLE_IDENTIFIER = tools\.lolly\.mobile/);
});

test('foreign formats are alternate openers with a real universal-import route', () => {
  for (const shell of [DESKTOP, MOBILE]) {
    const list = associations(shell);
    for (const ext of HELPER_EXTENSIONS) {
      const assoc = list.find((a) => a.ext?.includes(ext));
      assert.ok(assoc, `${path.relative(ROOT, shell)} does not offer .${ext} as an Open With helper`);
      assert.equal(assoc.rank, 'Alternate', `.${ext} must not displace its specialist app`);
      assert.notEqual(assoc.exportedType?.identifier, CANONICAL_UTI,
        `.${ext} must not masquerade as Lolly's owned UTI`);
      if (shell === MOBILE) assert.ok(assoc.androidIntentActionFilters?.includes('view'));
    }
    assert.ok(!list.some((a) => a.ext?.includes('indd')),
      'raw .indd is not importable; only its exported .idml form may be registered');
  }

  const router = readFileSync(path.join(ROOT, 'shells/web/src/lib/drop-router.ts'), 'utf8');
  for (const ext of ['xlsx', 'csv', 'tsv']) assert.match(router, new RegExp(`UNIVERSAL_ACCEPT[\\s\\S]{0,300}\\.${ext}`));
  assert.match(router, /id: 'spreadsheet', label: t\('Open in Spreadsheet'\)/);
  assert.match(router, /case 'spreadsheet':[\s\S]*pendingSpreadsheetFile = first;[\s\S]*#\/data/);
  const dataView = readFileSync(path.join(ROOT, 'shells/web/src/views/data.ts'), 'utf8');
  assert.match(dataView, /takePendingSpreadsheetFile\(\)/,
    'the spreadsheet view must consume the native-open handoff');
});

test('macOS bundles dedicated Finder artwork for the declared document type', () => {
  const { conf } = association(DESKTOP);
  assert.equal(conf.bundle?.resources?.['icons/lolly-document.icns'], 'lolly-document.icns');
  const plistPath = path.join(DESKTOP, 'src-tauri/Info.plist');
  const plist = readFileSync(plistPath, 'utf8');
  for (const key of ['CFBundleDocumentTypes', 'CFBundleTypeIconFile', 'UTExportedTypeDeclarations', 'UTTypeIconFile']) {
    assert.match(plist, new RegExp(`<key>${key}</key>`), `Info.plist is missing ${key}`);
  }
  assert.match(plist, /<string>tools\.lolly\.pack<\/string>/);
  assert.match(plist, /<string>lolly-document\.icns<\/string>/);
  assert.match(plist, /<string>application\/vnd\.lolly\+zip<\/string>/);
  assert.match(plist, /<string>Document Lolly can open<\/string>[\s\S]*?<string>Alternate<\/string>/);
  for (const ext of HELPER_EXTENSIONS) assert.match(plist, new RegExp(`<string>${ext}</string>`));

  const icon = path.join(DESKTOP, 'src-tauri/icons/lolly-document.icns');
  const source = path.join(DESKTOP, 'src-tauri/icons/lolly-document.png');
  assert.ok(existsSync(source), 'the editable 1024px document-icon source is missing');
  assert.equal(readFileSync(icon).subarray(0, 4).toString('ascii'), 'icns');
  assert.deepEqual([...readFileSync(source).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('macOS packages real sandboxed Quick Look thumbnail and preview extensions', () => {
  const configPath = path.join(DESKTOP, 'src-tauri/tauri.conf.json');
  const conf = JSON.parse(readFileSync(configPath, 'utf8')) as TauriConfig;
  assert.match(conf.build?.beforeBuildCommand ?? '', /npm run build:quicklook/,
    'a direct tauri build must compile the extensions before bundling');
  assert.equal(
    conf.bundle?.macOS?.files?.['PlugIns/LollyThumbnail.appex'],
    '../macos/quicklook/build/LollyThumbnail.appex',
  );
  assert.equal(
    conf.bundle?.macOS?.files?.['PlugIns/LollyPreview.appex'],
    '../macos/quicklook/build/LollyPreview.appex',
  );

  const quickLook = path.join(DESKTOP, 'macos/quicklook');
  const archiveReader = readFileSync(path.join(quickLook, 'LollyArchiveThumbnail.m'), 'utf8');
  assert.match(archiveReader, /@"format"\]\s+isEqual:@"lolly-share"/);
  assert.match(archiveReader, /@"data:image\/png;base64,"/);
  assert.match(archiveReader, /kMaximumManifestBytes = 32 \* 1024 \* 1024/);
  assert.match(archiveReader, /kMaximumThumbnailBytes = 16 \* 1024 \* 1024/);
  assert.match(archiveReader, /crc32\(/, 'the lifted manifest must be checked against the ZIP CRC');

  for (const [plistName, point, principal, minimum] of [
    ['Thumbnail-Info.plist', 'com.apple.quicklook.thumbnail', 'LollyThumbnailProvider', '10.15'],
    ['Preview-Info.plist', 'com.apple.quicklook.preview', 'LollyPreviewProvider', '12.0'],
  ] as const) {
    const plist = readFileSync(path.join(quickLook, plistName), 'utf8');
    assert.match(plist, new RegExp(`<string>${point.replaceAll('.', '\\.')}</string>`));
    assert.match(plist, new RegExp(`<string>${principal}</string>`));
    assert.match(plist, new RegExp(`<key>LSMinimumSystemVersion</key><string>${minimum.replace('.', '\\.')}<\\/string>`));
    assert.match(plist, /<array><string>tools\.lolly\.pack<\/string><\/array>/);
  }

  const entitlements = readFileSync(path.join(quickLook, 'QuickLook.entitlements'), 'utf8');
  assert.match(entitlements, /<key>com\.apple\.security\.app-sandbox<\/key><true\/>/);
  assert.match(entitlements, /<key>com\.apple\.security\.files\.user-selected\.read-only<\/key><true\/>/);
});

test('GNOME and KDE install primary-mark MIME artwork without a mock document page', () => {
  const pipeline = readFileSync(path.join(ROOT, 'scripts/build-app-icons.ts'), 'utf8');
  assert.match(
    pipeline,
    /application-vnd\.lolly\+zip\.png'[\s\S]{0,160}iconPng\(primaryMaster, size, TRANSPARENT\)/,
    'Linux MIME icons must stay derived from icon-primary.svg through primaryMaster',
  );

  const conf = readFileSync(path.join(DESKTOP, 'src-tauri/tauri.conf.json'), 'utf8');
  const rpm = readFileSync(path.join(DESKTOP, 'rpm/lolly-desktop.spec'), 'utf8');
  const flatpak = readFileSync(path.join(DESKTOP, 'flatpak/tools.lolly.Desktop.yml'), 'utf8');
  for (const size of [32, 48, 64, 128, 256]) {
    const rel = `linux/icons/${size}x${size}/application-vnd.lolly+zip.png`;
    const icon = readFileSync(path.join(DESKTOP, rel));
    assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.match(conf, new RegExp(`${size}x${size}/application-vnd\\.lolly\\+zip\\.png`));
    assert.match(rpm, new RegExp(`for size in 32 48 64 128 256|${size}x${size}`));
    assert.match(flatpak, new RegExp(`lolly-mime-${size}\\.png`));
  }
});

test('GNOME and KRunner cold search stays hidden and is discoverable', () => {
  const service = readFileSync(
    path.join(DESKTOP, 'linux/search/tools.lolly.Desktop.SearchProvider.service'),
    'utf8',
  );
  assert.match(service, /^Exec=\/usr\/bin\/lolly-desktop --search-provider$/m);

  const runnerPath = path.join(DESKTOP, 'linux/kde/tools.lolly.Desktop.runner.desktop');
  const runner = readFileSync(runnerPath, 'utf8');
  assert.match(runner, /^X-KDE-ServiceTypes=Plasma\/Runner$/m);
  assert.match(runner, /^X-KDE-PluginInfo-EnabledByDefault=true$/m);
  assert.match(runner, /^X-Plasma-API=DBus$/m);
  assert.match(runner, /^X-Plasma-DBusRunner-Service=tools\.lolly\.Desktop\.SearchProvider$/m);
  assert.match(runner, /^X-Plasma-DBusRunner-Path=\/tools\/lolly\/Desktop\/SearchProvider$/m);

  const cli = readFileSync(path.join(DESKTOP, 'src-tauri/src/cli.rs'), 'utf8');
  const native = readFileSync(path.join(DESKTOP, 'src-tauri/src/desktop_integration.rs'), 'utf8');
  const lib = readFileSync(path.join(DESKTOP, 'src-tauri/src/lib.rs'), 'utf8');
  assert.match(cli, /"--search-provider" => return Mode::SearchProvider/);
  assert.match(lib, /window\.visible = false/);
  assert.match(native, /format!\("#\/\?q=\{\}"/,
    'GNOME LaunchSearch must carry the current query into the gallery');

  for (const [file, install] of [
    ['src-tauri/tauri.conf.json', '/usr/share/krunner/dbusplugins/tools.lolly.Desktop.desktop'],
    ['rpm/lolly-desktop.spec', 'krunner/dbusplugins/tools.lolly.Desktop.desktop'],
    ['flatpak/tools.lolly.Desktop.yml', '/app/share/krunner/dbusplugins/tools.lolly.Desktop.desktop'],
    ['flatpak/flathub/tools.lolly.Desktop.yml', '/app/share/krunner/dbusplugins/tools.lolly.Desktop.desktop'],
  ] as const) {
    assert.match(readFileSync(path.join(DESKTOP, file), 'utf8'), new RegExp(install.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Dolphin verbs route the selected file directly to their named utility', () => {
  const menu = readFileSync(path.join(DESKTOP, 'linux/kde/lolly-utilities.desktop'), 'utf8');
  for (const target of ['strip-data', 'convert', 'redact']) {
    assert.match(menu, new RegExp(`^Exec=lolly-desktop --open-with=${target} %f$`, 'm'));
  }
  assert.doesNotMatch(menu, /^Exec=lolly-desktop %f$/m);

  const native = readFileSync(path.join(DESKTOP, 'src-tauri/src/desktop_integration.rs'), 'utf8');
  const router = readFileSync(path.join(ROOT, 'shells/web/src/lib/drop-router.ts'), 'utf8');
  const tool = readFileSync(path.join(ROOT, 'shells/web/src/views/tool.ts'), 'utf8');
  const convert = readFileSync(path.join(ROOT, 'shells/web/src/views/convert.ts'), 'utf8');
  assert.match(native, /matches!\(target, "strip-data" \| "convert" \| "redact"\)/);
  assert.match(router, /export function openFileInUtility/);
  assert.match(tool, /takePendingToolFile\(toolId\)/);
  assert.match(convert, /takePendingConvertFile\(\)/);
});

test('desktop export and window polish use native, bounded platform facilities', () => {
  const cargo = readFileSync(path.join(DESKTOP, 'src-tauri/Cargo.toml'), 'utf8');
  const rust = readFileSync(path.join(DESKTOP, 'src-tauri/src/lib.rs'), 'utf8');
  const native = readFileSync(path.join(DESKTOP, 'src-tauri/src/desktop_integration.rs'), 'utf8');
  const capability = readFileSync(path.join(DESKTOP, 'src-tauri/capabilities/default.json'), 'utf8');
  const bridge = readFileSync(path.join(DESKTOP, 'bridge-overrides/export.ts'), 'utf8');
  const panel = readFileSync(path.join(ROOT, 'shells/web/src/views/tool-actions.ts'), 'utf8');

  assert.match(cargo, /tauri-plugin-window-state = "2"/);
  assert.match(cargo, /tauri-plugin-dialog = "2"/);
  assert.match(cargo, /crate-type = \["rlib"\]/,
    'the desktop shell must not duplicate its embedded frontend into unused mobile products');
  assert.match(rust, /StateFlags::SIZE[\s\S]*StateFlags::POSITION[\s\S]*StateFlags::MAXIMIZED/);
  assert.doesNotMatch(rust, /StateFlags::VISIBLE/,
    'restored visibility would flash the hidden search-provider window');

  assert.match(capability, /"dialog:allow-save"/);
  assert.match(bridge, /from '@tauri-apps\/plugin-dialog'/);
  assert.match(bridge, /lolly-desktop-last-save-dir/);
  assert.match(bridge, /desktop_note_export/);
  assert.match(bridge, /desktop_reveal_export/);
  assert.match(panel, /desktopExport\?\.cancelSaveAs\(\)/,
    'a failed render must not leak Save As into the next ordinary export');
  assert.match(native, /RecentExports\(Mutex<VecDeque<PathBuf>>\)/);
  assert.match(native, /while recent\.len\(\) > 32/);
  assert.match(native, /that path was not written by this Lolly session/);
});

test('Android VIEW documents and iOS opened files reach the universal importer intake', () => {
  const manifest = readFileSync(path.join(MOBILE, 'src-tauri/gen/android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /android\.intent\.action\.VIEW/);
  assert.match(manifest, /android:mimeType="application\/vnd\.lolly\+zip"/);
  assert.match(manifest, /android:pathPattern="\.\*\\\\\.lolly"/);
  for (const ext of HELPER_EXTENSIONS) {
    assert.match(manifest, new RegExp(`android:pathPattern="\\.\\*\\\\\\\\\\.${ext}"`));
  }

  const kotlin = readFileSync(path.join(MOBILE, 'src-tauri/gen/android/app/src/main/java/tools/lolly/mobile/MainActivity.kt'), 'utf8');
  assert.match(kotlin, /uri\.scheme == "content"/);
  assert.match(kotlin, /stashInboundFile\(uri, intent\.type\)/);

  const rust = readFileSync(path.join(MOBILE, 'src-tauri/src/lib.rs'), 'utf8');
  assert.match(rust, /"file" => events\.push_open_file\(u\)/);
  assert.match(rust, /startAccessingSecurityScopedResource\(\)/);
  assert.match(rust, /stopAccessingSecurityScopedResource\(\)/);
  assert.match(rust, /self\.push\("openFileError", name\)/,
    'an unreadable or oversized iOS document must reach visible web-shell feedback');
  assert.match(rust, /fn mobile_take_open_file\(/);
  assert.match(rust, /mobile_poll_events,[\s\S]*mobile_take_open_file/);

  const webRouter = readFileSync(path.join(ROOT, 'shells/web/src/lib/drop-router.ts'), 'utf8');
  assert.match(webRouter, /e\?\.kind === 'openFileError'[\s\S]{0,400}48 MB mobile document-open limit/);

  const iosPlist = readFileSync(path.join(MOBILE, 'src-tauri/gen/apple/lolly-mobile_iOS/Info.plist'), 'utf8');
  assert.match(iosPlist, /<key>CFBundleTypeRole<\/key>\s*<string>Editor<\/string>/);
  assert.match(iosPlist, /<key>LSHandlerRank<\/key>\s*<string>Owner<\/string>/);
  assert.match(iosPlist, /<string>tools\.lolly\.pack<\/string>/);
  assert.match(iosPlist, /<string>Document Lolly can open<\/string>[\s\S]*?<string>Alternate<\/string>/);

  const appleProject = readFileSync(path.join(MOBILE, 'src-tauri/gen/apple/project.yml'), 'utf8');
  assert.match(appleProject, /CFBundleTypeExtensions: \[lolly\]/);
  assert.match(appleProject, /CFBundleTypeRole: Editor/);
  assert.match(appleProject, /CFBundleTypeExtensions: \[penpot, fig, idml, ai, svg, pdf, xlsx, csv, tsv, pptx, docx, psd, psb, xcf\]/);

  for (const desktopFile of [
    path.join(DESKTOP, 'linux/deb/lolly.desktop.hbs'),
    path.join(DESKTOP, 'flatpak/tools.lolly.Desktop.desktop'),
  ]) {
    const entry = readFileSync(desktopFile, 'utf8');
    for (const mime of HELPER_MIMES) {
      assert.match(entry, new RegExp(mime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }

  const linuxMime = readFileSync(path.join(DESKTOP, 'linux/mime/tools.lolly.Desktop.xml'), 'utf8');
  for (const ext of ['penpot', 'fig', 'idml']) {
    assert.match(linuxMime, new RegExp(`<glob pattern="\\*\\.${ext}"`));
  }

  const dropRouter = readFileSync(path.join(ROOT, 'shells/web/src/lib/drop-router.ts'), 'utf8');
  assert.match(dropRouter, /invoke\('mobile_take_open_file'/);
  assert.match(dropRouter, /openDropChooser\(\[file\], host/);
});
