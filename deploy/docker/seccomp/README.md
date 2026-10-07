# Optional Chromium namespace sandbox profile

The public browser image runs as UID 1000 with a read-only root filesystem,
all capabilities dropped, no privilege escalation and Chromium's internal sandbox
on. Its writable configuration/cache directory stays inside the bounded `/tmp`.
The standard images and chart continue using RuntimeDefault seccomp.

`containerd-v2.2.7-no-caps.json` is the actual amd64 RuntimeDefault profile captured
from containerd v2.2.7-k3s1 on the qualified candidate, with no capabilities.
Its SHA-256 is `db20464841fe2183251850805de9269b69f2f4acc819d6a9f7276d12a469b5b3`.
The implementation is maintained in
[containerd's Apache-2.0 source](https://github.com/containerd/containerd/blob/v2.2.7/contrib/seccomp/seccomp_default.go).
This is a versioned workload-specific baseline, not a copy of an arbitrary node's
current defaults. Requalify it when changing the runtime, browser, architecture,
kernel or node security policy.

`public-browser-sandbox.json` preserves that baseline exactly and adds only
`clone`, `setns`, `unshare` and `chroot` to support Chromium's namespace sandbox.
Its SHA-256 is `8f01960c1777252f6c70b64e00fdccec95e86b37f7617cb798df3e36fd987a9b`.
[Playwright's Docker guidance](https://playwright.dev/docs/docker) describes the
first three namespace calls. Chromium additionally uses
[`ChrootToSelfFdinfo`](https://chromium.googlesource.com/chromium/src/+/lkgr/sandbox/linux/services/credentials.cc)
to drop filesystem access inside its user namespace. No capability is added:
ordinary parent-process `chroot` still fails, and `mount`, `bpf` and `clone3`
retain their original refusals. The profile does not disable SELinux or the
browser's own seccomp filter.

The candidate proved actual Chromium namespace/PID/network sandbox and
Seccomp-BPF/TSYNC diagnostics plus native PDF under these controls. Each final
image and target still needs the full signed-catalog/auth/relay/export acceptance;
a profile hash or a raw syscall probe alone is insufficient.

## Install before Kubernetes Pod creation

Install only on the explicitly selected, independently qualified node, beneath
its actual kubelet seccomp directory. Do not assume the kubelet root is the K3s
agent directory. For a kubelet root of `/var/lib/kubelet`:

```sh
profile_sha=8f01960c1777252f6c70b64e00fdccec95e86b37f7617cb798df3e36fd987a9b
profile_source=deploy/docker/seccomp/public-browser-sandbox.json
printf '%s  %s\n' "$profile_sha" "$profile_source" | sha256sum --check
sudo test ! -L /var/lib/kubelet/seccomp
sudo test ! -L /var/lib/kubelet/seccomp/lolly
sudo install -d -o root -g root -m 0755 /var/lib/kubelet/seccomp/lolly
profile_target="/var/lib/kubelet/seccomp/lolly/public-browser-sandbox-${profile_sha}.json"
# Refuse a symlink and verify any existing file instead of replacing it.
sudo test ! -L "$profile_target"
if sudo test -e "$profile_target"; then
  printf '%s  %s\n' "$profile_sha" "$profile_target" | sudo sha256sum --check
else
  sudo install -o root -g root -m 0644 "$profile_source" "$profile_target"
fi
printf '%s  %s\n' "$profile_sha" "$profile_target" | sudo sha256sum --check
```

Set `components.mcp.browser.localhostProfile` to the relative pathname
`lolly/public-browser-sandbox-8f01960c1777252f6c70b64e00fdccec95e86b37f7617cb798df3e36fd987a9b.json`.
The sovereign chart pins that MCP Pod to `edge.nodeName` when this option is set;
other Pods keep RuntimeDefault. `noSandbox` must remain false. Do not select a
node until its installed file hash, ownership and security policy are verified.
The chart does not install a host file or qualify it automatically.

For the optional Compose overlay, set `LOLLY_PUBLIC_BROWSER_SECCOMP_FILE` to an
absolute, verified profile filename on the Docker host. Compose explicitly
requires the value; do not substitute `unconfined` or disable Chromium's sandbox.
Keep profile bytes and their qualification receipts with the release backup.
