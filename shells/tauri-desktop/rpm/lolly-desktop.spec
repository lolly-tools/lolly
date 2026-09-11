#
# spec file for package lolly-desktop
#
# Copyright (c) 2026 Lolly contributors.
#
# All modifications and additions to the file contributed by third parties
# remain the property of their copyright owners, unless otherwise agreed
# upon.
#
# Licensed under MPL-2.0. See LICENSE in the source tree.
#

# ---------------------------------------------------------------------------
# WHY THIS SPEC LOOKS LIKE THIS
#
# Lolly's desktop app is a Tauri 2 shell whose *frontend is the web shell*: the
# Vite build is rooted at shells/web and the resulting dist/ is embedded into the
# Rust binary at compile time by tauri-build's generate_context!(). That means:
#
#   1. dist/ must be built BEFORE cargo runs, by node+npm, against the whole
#      umbrella repo (submodules, workspaces, and the generated tools/+catalog/
#      profile views). OBS builds are offline, so that cannot happen here.
#      => dist/ is PREBUILT and shipped inside Source0. See ./make-sources.sh.
#
#   2. Every cargo crate must be present offline.
#      => Source1 is a `cargo vendor` tree, wired up by Source2.
#
#   3. ort-sys (ONNX Runtime, used by the native reword feature in
#      src-tauri/src/reword.rs) DOWNLOADS a prebuilt ONNX Runtime in its build
#      script via ureq. That is fatal offline. Setting ORT_LIB_LOCATION makes
#      ort-sys skip the download entirely and link the library we hand it
#      (build.rs: `cfg!(feature = "download-binaries") && env::var(ORT_LIB_LOCATION).is_err()`).
#      The tarball we ship is byte-identical to the one ort-sys would have
#      fetched - make-sources.sh reads the URL and SHA256 straight out of the
#      vendored ort-sys dist.txt, so it cannot drift from the pinned crate.
#      It contains onnxruntime/lib/libonnxruntime.a, so this links STATICALLY
#      and the resulting RPM has no libonnxruntime runtime dependency. That is
#      what makes one spec work on Tumbleweed and Leap 16 alike, neither of
#      which ships onnxruntime in the OSS repo.
# ---------------------------------------------------------------------------

Name:           lolly-desktop
Version:        1.0.7
Release:        0%{?dist}
Summary:        Generate on-brand creative assets from simple inputs
License:        MPL-2.0
Group:          Productivity/Graphics/Other
URL:            https://lolly.tools

Source0:        lolly-desktop-%{version}.tar.zst
Source1:        vendor.tar.zst
Source2:        cargo_config
Source3:        onnxruntime-x86_64-unknown-linux-gnu.tgz
Source4:        onnxruntime-aarch64-unknown-linux-gnu.tgz

# The vendored dependency tree requires Rust >= 1.88 (darling 0.23, icu_collections
# 2.2, headless_chrome 1.0 and others declare it), and Cargo.lock is lockfile v4,
# which needs cargo >= 1.78. Leap's default `rust` may be older than this - if the
# build fails to resolve, add devel:languages:rust to the project repositories and
# switch these to the versioned `rust1.88`/`cargo1.88` packages.
BuildRequires:  cargo >= 1.88
BuildRequires:  rust >= 1.88
BuildRequires:  gcc-c++
BuildRequires:  pkgconfig
BuildRequires:  zstd
BuildRequires:  fdupes
BuildRequires:  hicolor-icon-theme
BuildRequires:  update-desktop-files

# Tauri 2 on Linux renders through webkit2gtk-4.1 (GTK3 + libsoup3). Expressed as
# pkgconfig() symbols rather than distro package names so the same spec resolves on
# Tumbleweed and Leap 16, whose package names for these differ.
BuildRequires:  pkgconfig(webkit2gtk-4.1)
BuildRequires:  pkgconfig(javascriptcoregtk-4.1)
BuildRequires:  pkgconfig(gtk+-3.0)
BuildRequires:  pkgconfig(libsoup-3.0)
BuildRequires:  pkgconfig(glib-2.0)
BuildRequires:  pkgconfig(gdk-pixbuf-2.0)
BuildRequires:  pkgconfig(cairo)
BuildRequires:  pkgconfig(librsvg-2.0)
BuildRequires:  pkgconfig(openssl)
BuildRequires:  pkgconfig(ayatana-appindicator3-0.1)

Requires:       hicolor-icon-theme
# The tray dlopens libayatana-appindicator3 LAZILY, so rpm's automatic dependency
# finder never sees it - the ELF carries no DT_NEEDED for it. Without this line the
# package installs happily on a system that lacks the library and the app then dies
# on launch, which is exactly how it shipped in 1.0.2. Depend on the soname rather
# than a package name so it resolves on Tumbleweed and Leap alike, whatever either
# calls the containing package.
Requires:       libayatana-appindicator3.so.1()(64bit)
# The url-shot tool drives a headless Chrome over the DevTools Protocol
# (src-tauri/src/capture.rs). Everything else works without it, so this is a
# Recommends, not a Requires - the app starts and renders fine with no browser.
Recommends:     chromium

# ONNX Runtime ships prebuilt for these two only; the crate has no source build path
# wired up here. Anything else would fail in ort-sys, so fail early and legibly.
ExclusiveArch:  x86_64 aarch64

# A Rust binary with a ~171 MB embedded frontend makes debuginfo extraction enormous
# and useless. Standard practice for Rust packages on openSUSE.
%global debug_package %{nil}

%description
Lolly is a constraint-first, template-driven tool for generating on-brand
creative assets - QR codes, charts, diagrams, event badges, documents, filters
and more - as PNG, SVG, PDF or video.

Tools are data, not code: a manifest, a template and optional hooks, so new
tools ship without updating the application. Everything renders on your
device; nothing is uploaded.

%prep
%setup -q
# Cargo vendor tree + the config that points cargo at it, so the build is offline.
# The config MUST land in src-tauri/.cargo/config.toml and the build MUST run with
# src-tauri as its working directory: cargo discovers config by walking up from the
# CWD, and resolves a relative `directory =` against the directory holding .cargo/ -
# so "vendor" means src-tauri/vendor only under those two conditions. Do not set
# CARGO_HOME to this directory; that turns it into the home config instead, where the
# same relative path resolves somewhere else entirely.
tar -xf %{SOURCE1} -C src-tauri
mkdir -p src-tauri/.cargo
install -m 0644 %{SOURCE2} src-tauri/.cargo/config.toml
test -d src-tauri/vendor

# Hand ort-sys a prebuilt ONNX Runtime so its build script does not try to download
# one. Extracts to ./onnxruntime/lib/libonnxruntime.a; ORT_LIB_LOCATION points at the
# directory ABOVE lib/, which is the layout ort-sys's prepare_libort_dir() expects.
%ifarch x86_64
tar -xzf %{SOURCE3}
%endif
%ifarch aarch64
tar -xzf %{SOURCE4}
%endif
test -f onnxruntime/lib/libonnxruntime.a
# Fail in %prep, not 600 crates later in %install: the spec installs the
# freedesktop integration from linux/, which make-sources.sh must stage.
test -d linux/mime -a -d linux/search -a -d linux/thumbnailer || {
  echo "ERROR: linux/ integration files missing from the source tarball." >&2
  echo "       rpm/make-sources.sh must stage shells/tauri-desktop/linux/." >&2
  exit 1
}

%build
# Absolute, because the build runs from src-tauri/ a few lines down.
export ORT_LIB_LOCATION="$(pwd)/onnxruntime"
# Belt and braces: even if ORT_LIB_LOCATION were ignored, this stops the download
# rather than letting the build hang on a network call OBS will refuse.
export ORT_SKIP_DOWNLOAD=1
export CARGO_NET_OFFLINE=true
# A scratch CARGO_HOME, deliberately NOT src-tauri/.cargo - see the note in %prep.
export CARGO_HOME="$(pwd)/.cargo-home"

# tauri-build reads ../dist (frontendDist in tauri.conf.json) and embeds it via
# generate_context!(). It is already in the tarball, prebuilt - see the header.
cd src-tauri
# MEMORY. The final rustc invocation links lolly-desktop with the ENTIRE frontend
# embedded by generate_context!() (~175 MB of assets) plus a statically linked ONNX
# Runtime, in one process with a large peak RSS. %%limit_build is openSUSE's idiom for
# bounding that: it caps parallel jobs by available memory, so a constrained OBS worker
# throttles instead of dying. Precautionary - a build worker with little RAM per core is
# the case it protects.
#
# It is NOT what fixed the OOM seen while developing this spec. That was rustc getting
# SIGKILLed with no diagnostic, and the cause was the build tree sitting on a tmpfs
# /tmp - so several GB of "disk" were actually resident memory. Build on real disk;
# the same mistake also reports itself as "Disk quota exceeded (os error 122)" once
# tmpfs hits its ceiling. Neither message mentions tmpfs.
# Guarded on BOTH the distro and the macro, because each alone is wrong:
#
#   - distro alone (%if 0%{?suse_version}) is not enough: %%limit_build ships with the
#     OBS build macros, not base rpm-build, so it is undefined on Tumbleweed under a
#     plain rpmbuild - and an undefined macro is emitted verbatim into the shell
#     script, where `%%limit_build -m 3000` is a command-not-found that kills %build
#     before a single crate compiles.
#
#   - macro alone (%%{?limit_build:...}) is not enough either: TWO DIFFERENT MACROS
#     SHARE THE NAME. openSUSE's is a statement that sets _smp_mflags. Fedora's, from
#     redhat-rpm-config, is an *expression* returning a -jN flag for use inside
#     %make_build, and invoking it this way makes its Lua do tonumber(nil) and abort
#     the parse with "attempt to perform arithmetic on a nil value". That breaks the
#     plain-rpmbuild smoke test on another distro that README.md documents.
# NB: the %%limit_build spellings in the comments above are escaped on purpose -
# rpm expands macros INSIDE COMMENTS, and a bare `%%limit_build -m 3000` in prose
# invokes Fedora's macro with a trailing backtick in its argument, so tonumber()
# returns nil and the whole spec fails to parse. Do not unescape them.
%if 0%{?suse_version}
%{?limit_build:%limit_build -m 3000}
%endif

# --features tauri/custom-protocol is NOT optional. It is what the Tauri CLI adds for
# you, and tauri's own is_dev() is literally `!cfg!(feature = "custom-protocol")`
# (tauri/src/lib.rs:309), so a plain `cargo build` produces a DEVELOPMENT binary that
# ignores the embedded frontendDist and tries to load devUrl instead. The packaged app
# would start, show a window, and fail with "Could not connect to localhost: Connection
# refused". Nothing in the build log warns about it - the tell is the binary coming out
# roughly a third of its proper size, which %check below now guards.
# %{?_smp_mflags} is what makes %%limit_build above actually DO something: the macro
# only sets _smp_mflags, so without passing it here cargo would still fan out to every
# core and the memory cap would be inert. Cargo accepts the same -jN spelling make does.
cargo build \
    --release \
    --offline \
    --locked \
    --features tauri/custom-protocol \
    %{?_smp_mflags}

%install
install -Dm0755 src-tauri/target/release/lolly-desktop \
    %{buildroot}%{_bindir}/lolly-desktop

# Desktop entry and AppStream metainfo. The component id, the .desktop basename and
# the icon name are all the Tauri identifier (tools.lolly.Desktop) and must stay in
# agreement or appstream drops the app from the catalog.
install -Dm0644 packaging/tools.lolly.Desktop.desktop \
    %{buildroot}%{_datadir}/applications/tools.lolly.Desktop.desktop
install -Dm0644 packaging/tools.lolly.Desktop.metainfo.xml \
    %{buildroot}%{_datadir}/metainfo/tools.lolly.Desktop.metainfo.xml

for size in 32 64 128 256 512; do
    if [ -f "packaging/icon-${size}.png" ]; then
        install -Dm0644 "packaging/icon-${size}.png" \
            "%{buildroot}%{_datadir}/icons/hicolor/${size}x${size}/apps/tools.lolly.Desktop.png"
    fi
done

# Freedesktop integration, single-sourced from linux/ (see linux/README.md for
# what each file is): the .lolly MIME type, the GNOME Files thumbnailer, the GNOME
# Shell search-provider registration + D-Bus activation, and the KDE service menu.
# Placements mirror the Flatpak manifest's /app/share ones under /usr/share.
install -Dm0644 linux/mime/tools.lolly.Desktop.xml \
    %{buildroot}%{_datadir}/mime/packages/tools.lolly.Desktop.xml
install -Dm0755 linux/thumbnailer/lolly-thumbnail \
    %{buildroot}%{_bindir}/lolly-thumbnail
install -Dm0644 linux/thumbnailer/lolly.thumbnailer \
    %{buildroot}%{_datadir}/thumbnailers/lolly.thumbnailer
install -Dm0644 linux/search/tools.lolly.Desktop.search-provider.ini \
    %{buildroot}%{_datadir}/gnome-shell/search-providers/tools.lolly.Desktop.search-provider.ini
install -Dm0644 linux/search/tools.lolly.Desktop.SearchProvider.service \
    %{buildroot}%{_datadir}/dbus-1/services/tools.lolly.Desktop.SearchProvider.service
install -Dm0644 linux/search/org.lolly.Desktop1.service \
    %{buildroot}%{_datadir}/dbus-1/services/org.lolly.Desktop1.service
# kio/servicemenus is the KF5 >= 5.85 / KF6 location Dolphin reads today (Leap 16
# and Tumbleweed are both Plasma 6); the legacy kservices5/ServiceMenus path is not
# shipped - installing to both would double the menu on transitional systems.
install -Dm0644 linux/kde/lolly-utilities.desktop \
    %{buildroot}%{_datadir}/kio/servicemenus/lolly-utilities.desktop
install -Dm0644 linux/kde/tools.lolly.Desktop.runner.desktop \
    %{buildroot}%{_datadir}/krunner/dbusplugins/tools.lolly.Desktop.desktop

# The application/vnd.lolly+zip FILETYPE icon, so a .lolly has a face in Files and
# Dolphin. Note the sizes differ from the app-icon loop above (48 here, no 512) -
# these follow what linux/icons/ actually ships, and %files lists exactly these five.
# They were declared in %files without ever being installed, so the build failed at
# the very end with "File not found: .../mimetypes/application-vnd.lolly+zip.png"
# after the whole compile had run.
for size in 32 48 64 128 256; do
    install -Dm0644 "linux/icons/${size}x${size}/application-vnd.lolly+zip.png" \
        "%{buildroot}%{_datadir}/icons/hicolor/${size}x${size}/mimetypes/application-vnd.lolly+zip.png"
done

%fdupes %{buildroot}%{_datadir}/icons

%check
# The binary links a static ONNX Runtime, so it must NOT have picked up a shared one.
# If this ever fires, ORT_LIB_LOCATION stopped taking effect and the build silently
# changed linking strategy.
if ldd %{buildroot}%{_bindir}/lolly-desktop | grep -q libonnxruntime; then
    echo "ERROR: linked against a shared libonnxruntime; expected static" >&2
    exit 1
fi

# The frontend is embedded into the binary by generate_context!(), so a correct build
# is ~110 MB and a custom-protocol-less one is ~43 MB. That difference is the ONLY
# signal: losing the feature still compiles, still links, still produces a binary that
# starts - it just cannot load its own UI. Anything under 80 MB means the frontend is
# missing, whether because the feature was dropped or dist/ was empty at compile time.
sz=$(stat -c %s %{buildroot}%{_bindir}/lolly-desktop)
if [ "$sz" -lt 80000000 ]; then
    echo "ERROR: binary is $sz bytes; expected ~110 MB with the frontend embedded." >&2
    echo "       The frontend is almost certainly missing - check that" >&2
    echo "       --features tauri/custom-protocol survived and that dist/ was built." >&2
    exit 1
fi

# Cache refreshes for the freedesktop files above. Current openSUSE and Fedora
# run these from file triggers in shared-mime-info/desktop-file-utils, so each call
# is guarded on the binary existing and never fails the transaction - the guard
# style matches what those distros' own packages do, and a headless install (no
# GUI stack) simply skips them.
%post
if [ -x /usr/bin/update-mime-database ]; then
    /usr/bin/update-mime-database %{_datadir}/mime >/dev/null 2>&1 || :
fi
if [ -x /usr/bin/update-desktop-database ]; then
    /usr/bin/update-desktop-database %{_datadir}/applications >/dev/null 2>&1 || :
fi
if [ -x /usr/bin/gtk-update-icon-cache ]; then
    /usr/bin/gtk-update-icon-cache -q %{_datadir}/icons/hicolor >/dev/null 2>&1 || :
fi

%postun
if [ -x /usr/bin/update-mime-database ]; then
    /usr/bin/update-mime-database %{_datadir}/mime >/dev/null 2>&1 || :
fi
if [ -x /usr/bin/update-desktop-database ]; then
    /usr/bin/update-desktop-database %{_datadir}/applications >/dev/null 2>&1 || :
fi
if [ -x /usr/bin/gtk-update-icon-cache ]; then
    /usr/bin/gtk-update-icon-cache -q %{_datadir}/icons/hicolor >/dev/null 2>&1 || :
fi

%files
%license LICENSE
%doc README.md
%{_bindir}/lolly-desktop
%{_datadir}/applications/tools.lolly.Desktop.desktop
%{_datadir}/metainfo/tools.lolly.Desktop.metainfo.xml
%{_datadir}/icons/hicolor/*/apps/tools.lolly.Desktop.png
%{_bindir}/lolly-thumbnail
%{_datadir}/mime/packages/tools.lolly.Desktop.xml
%{_datadir}/dbus-1/services/tools.lolly.Desktop.SearchProvider.service
%{_datadir}/dbus-1/services/org.lolly.Desktop1.service
# Own the parent dirs that only exist when their consumer is installed - a KDE-less
# GNOME box has no kio/, a GNOME-less KDE box has no gnome-shell/, and thumbnailers/
# belongs to no base package on either.
%dir %{_datadir}/thumbnailers
%{_datadir}/thumbnailers/lolly.thumbnailer
%dir %{_datadir}/gnome-shell
%dir %{_datadir}/gnome-shell/search-providers
%{_datadir}/gnome-shell/search-providers/tools.lolly.Desktop.search-provider.ini
%dir %{_datadir}/kio
%dir %{_datadir}/kio/servicemenus
%{_datadir}/kio/servicemenus/lolly-utilities.desktop
%dir %{_datadir}/krunner
%dir %{_datadir}/krunner/dbusplugins
%{_datadir}/krunner/dbusplugins/tools.lolly.Desktop.desktop

/usr/share/icons/hicolor/32x32/mimetypes/application-vnd.lolly+zip.png
/usr/share/icons/hicolor/48x48/mimetypes/application-vnd.lolly+zip.png
/usr/share/icons/hicolor/64x64/mimetypes/application-vnd.lolly+zip.png
/usr/share/icons/hicolor/128x128/mimetypes/application-vnd.lolly+zip.png
/usr/share/icons/hicolor/256x256/mimetypes/application-vnd.lolly+zip.png

%changelog
* Sun Aug 30 2026 Andy Fitzsimon <andyfitz@gmail.com> - 1.0.2-0
- Flatpak parity: the from-source Flathub manifest now installs the same
  freedesktop integration this spec already did (MIME type, thumbnailer, GNOME
  Shell search provider, D-Bus activation). No change to the RPM's own payload.

* Sun Aug 30 2026 Andy Fitzsimon <andyfitz@gmail.com> - 1.0.1-0
- Linux desktop integration (plans/174): .lolly file association + thumbnailer,
  lolly:// deep links, XDG-portal colour picker and wallpaper, GNOME Shell and
  KRunner search providers, clipboard-lens tray, hot folder, org.lolly.Desktop1
  D-Bus automation surface.

* Sat Aug 29 2026 Andy Fitzsimon <andyfitz@gmail.com> - 1.0.0-0
- First packaged release: tool gallery, brand studio, on-device export.
