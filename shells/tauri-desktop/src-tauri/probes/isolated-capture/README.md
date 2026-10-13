# Native capture checks

This small crate imports the production capture controller and HTTP reader directly. It runs their checks without linking the desktop UI or optional model runtime.

Run the address, pinned connection, concurrency and resource budget checks:

```sh
cargo test --manifest-path shells/tauri-desktop/src-tauri/probes/isolated-capture/Cargo.toml
```

Run the real Chrome checks with one test thread:

```sh
CHROME='/path/to/chrome' cargo test --manifest-path shells/tauri-desktop/src-tauri/probes/isolated-capture/Cargo.toml -- --include-ignored --test-threads=1
```

The browser cases use a synthetic in-process page reader and owned local fixtures. They check fresh cookies, screenshots, resource refusals, paused separate browsing contexts, unsupported APIs and the refusing fallback proxy. They do not visit external sites.

The production mode reads GET and HEAD resources through pinned public connections, with no page-provided cookies or authorization headers. Workers, sockets and child frames cause an explicit error. Existing hook deadlines still apply; a slow page can exceed its caller's hook budget before the native capture deadline.
