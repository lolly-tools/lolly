# Local GLib source override

This is the licensed crates.io GLib 0.18.5 source, from upstream commit `42b9caf98e03ded086362d9653ca58fe94dc8658`. Its published archive SHA-256 is `233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`.

The string-array iterator passes writable pointer storage to the C output argument. The change follows the [upstream iterator correction](https://github.com/gtk-rs/gtk-rs-core/pull/1343) and includes focused forward, reverse and skipped-item checks. Public signatures and the GTK dependency family stay unchanged.

The desktop and mobile Cargo manifests use this path override. Keep the upstream licenses, verify the source inventory when changing this directory, and remove the override when the shell dependency family accepts the corrected upstream series.

Run the iterator checks with GLib development libraries available:

```sh
cargo test --manifest-path shells/tauri-desktop/src-tauri/probes/glib-iterator/Cargo.toml
```
