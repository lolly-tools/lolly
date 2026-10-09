# Qualify the mobile product on a physical iPhone

This recipe runs the maintained GPU corpus in a normally started, bundled Lolly
mobile app. The app keeps its usual scene, custom protocol, Content Security
Policy, mobile storage and GPU preferences. The probe loads after the real
startup check and gallery have passed. A simulator or a standalone WKWebView
fixture cannot substitute for this result.

Qualification uses a new UUID app identity and its own data container. The
installed Lolly app is preserved. The generated test package removes document
and `lolly://` registrations before development signing, and carries the
non-release marker inside the app. Catalog signing and release publication
remain disabled. Apple Development signing only permits installation on the
physical test device.

## Prepare the existing tools and credentials

Use a clean, isolated checkout of the reviewed main commit, with the pinned root
and mobile dependencies installed with `pnpm install --frozen-lockfile` in each
dependency root. Include the mobile development dependencies: its Tauri CLI is
needed for the archive build. If the environment sets `CI`, Tauri requires the
literal value `true` or `false`; `CI=1` is refused before building. The Mac needs its existing Xcode, iPhoneOS
SDK and Rust iOS target. Choose an existing, valid Apple Development identity
and an unexpired development profile that authorizes the UUID test app and the
selected phone. This helper does not create profiles, enable automatic
provisioning, change device preferences or install dependencies.

Set `RUSTUP_TOOLCHAIN` to the explicit installed toolchain selected for this
attempt (for example `1.99.0`); do not change the Mac's default toolchain. The
helper resolves and hashes that toolchain's real Cargo, rustc and rustdoc
executables. The selected toolchain also needs its `llvm-tools` component for
the pinned Swift bindings. Install the component for that explicit toolchain,
without changing the default:

```sh
rustup component add llvm-tools --toolchain "$RUSTUP_TOOLCHAIN"
```

The preflight asks the selected real rustc for its sysroot and Apple host, then
verifies both `llvm-objcopy` and `rust-objcopy` under
`lib/rustlib/<host>/bin/`. It records their requested paths, resolved executable
identities, hashes and bounded version output before the archive starts.
Missing, nonexecutable or failing tools stop preparation before the expensive
build. There is no object-copy PATH fallback or dynamic-loader override.
Aliases and executable identities are checked again before Xcode runs and after
a successful archive. These facts form part of the source-bound build guard
and archive receipt. Rustup documents `llvm-tools` as an optional component
whose tool availability may change, so the preflight checks the actual tools
instead of inferring their presence from a component name. See the
[Rustup component documentation](https://rust-lang.github.io/rustup/concepts/components.html).

The helper places the real compiler bin directory ahead of rustup shims for this
process and forwards the absolute compiler through `CARGO_BUILD_RUSTC`.
`RUSTUP_TOOLCHAIN` alone is insufficient: the pinned Tauri CLI filters that
variable out before Xcode executes its Rust script. A local observer passes
every compiler argument unchanged and records the actual nested compiler,
target, crate name, completion status and count. It records no source bytes,
compiler argument values or environment dump.

The maintained archive policy is bound to Tauri CLI `2.12.1` and its locked
`cargo-mobile2 0.22.5`. Their archive path injects provisioning flags even for an
unsigned archive. An owned, process-local `xcodebuild` wrapper removes only
`-allowProvisioningUpdates` after validating the exact physical iPhoneOS,
release, unsigned, archive-only command. Export, simulator, device-registration,
authentication and changed signing settings are refused before Xcode runs.
Imported `IOS_CERTIFICATE`, profile and account credentials are removed from
this process environment. The existing local profile and development identity
are used only for the explicit signing step after the archive is verified.

The selected iPhone must already be paired, in developer mode and available to
standard developer services. Unlock the phone when normal Apple tooling needs
access. An unavailable or locked device causes a preflight failure before app
installation. The helper requires the exact device identifier; names and
simulators are refused.

Set `LOLLY_WEBGPU_SOURCE_SHA` to the full, lowercase SHA of the reviewed commit.
The checkout and receipt must both match that SHA. Choose a new output directory
for each qualification attempt. A preparation from an older helper cannot be
reused: immutable copies of the Apple project and generated plist are required.

## Run the three explicit steps

Preparation creates the UUID, source inventory and non-release marker. No build
or device operation occurs:

```sh
node scripts/verify-webgpu-product-ios.ts --prepare \
  --output=plans/295-validation/physical-product-iphone
```

Build with the existing profile path and the certificate fingerprint from the
Mac's valid signing identities. The unsigned, archive-only Tauri build is copied
to the owned output directory, sanitized, development signed and verified. This
step does not install or launch on the device:

```sh
node scripts/verify-webgpu-product-ios.ts --build \
  --output=plans/295-validation/physical-product-iphone \
  --profile="$PROFILE_PATH" --identity="$SIGNING_FINGERPRINT"
```

Only the explicit run step may install the UUID app, launch its console and run
the complete corpus. It refuses to replace an existing app or attach to an
existing process. It removes its own successfully installed app after success
or failure:

```sh
node scripts/verify-webgpu-product-ios.ts --run \
  --output=plans/295-validation/physical-product-iphone \
  --device="$DEVICE_IDENTIFIER"
```

The console transports the existing bounded qualification protocol. No network
test server, external fixture navigation or WebView preference override is
used. The existing corpus assertions and deadlines apply unchanged.

## Read the evidence

The output records source and lock hashes, compiled assets, the complete signed
app digest, development-signing provenance and the actual physical device's OS
version and build. Original source hashes remain in `sources`; `builtSources`
retains the actual postbuild hashes and working diff. `apple-inputs/` preserves
the original project and generated plist bytes. `appleDerivations` records both
input and output hashes. The project may change only the UUID app's bundle ID
and product name in its ordinary debug/release configurations, with all other
bytes identical. The generated plist must exactly match the pinned shallow
overlay order, authored version and unchanged normal scene. An extra setting,
scene change, script change or any other source mutation fails verification;
the Apple files are not excluded from the source inventory.

`build-guard.json`, `xcode-archive-command.json`, `compiler-invocations/` and
`build-processes/` retain bounded local tool and process ownership evidence.
The archive deadline remains 30 minutes. Interruption and timeout stop only
freshly matched owned processes, including separately grouped Xcode scripts,
and wait boundedly for their exit. A replaced PID, malformed ownership journal
or unverifiable cleanup causes a failure and preserves evidence for inspection.
Do not reuse an ambiguous attempt or delete its evidence while ownership is
unresolved. The corpus retains its existing deadlines.

`conformance.json` contains the corpus observations and real
product startup facts. `owned-install.json` records whether installation
ownership remains outstanding, the exact installed app URL and whether an
incomplete command response requires inspection. The journal is written before
and after each mutation. Device identifiers and profile contents should
remain in local evidence, outside published documentation.

If installation completion or cleanup is uncertain, the lease records the
uncertainty and the command fails. Cleanup rechecks the UUID app name and its
installed URL immediately before uninstalling. It refuses to remove a changed
replacement or blindly delete after an incomplete command. Inspect
the exact UUID app and process evidence before further action. The helper never
terminates an unrelated executable or uninstalls the regular Lolly app.

Tauri reads the system WebKit bundle version when available. If that read fails,
the report retains the actual error and device OS/build; it never substitutes a
Safari version. Missing runtime provenance remains incomplete even when the
corpus runs. A qualification result is evidence for this exact source and device,
not a new supported-environment declaration or permission to bypass the release
gate.

The build policy follows the immutable [Tauri CLI environment filter and iOS
archive sources](https://github.com/tauri-apps/tauri/tree/30da1fd6e17de6107ecc850c95dfb16b5729f2dd/crates/tauri-cli/src/mobile)
and [Cargo's compiler environment variables](https://doc.rust-lang.org/cargo/reference/environment-variables.html).
Changing those dependency pins requires a fresh source review of this policy.
