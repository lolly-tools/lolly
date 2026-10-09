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

The selected iPhone must already be paired, in developer mode and available to
standard developer services. Unlock the phone when normal Apple tooling needs
access. An unavailable or locked device causes a preflight failure before app
installation. The helper requires the exact device identifier; names and
simulators are refused.

Set `LOLLY_WEBGPU_SOURCE_SHA` to the full, lowercase SHA of the reviewed commit.
The checkout and receipt must both match that SHA. Choose a new output directory
for each qualification attempt.

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
version and build. `conformance.json` contains the corpus observations and real
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
