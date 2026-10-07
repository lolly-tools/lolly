# Single-node sovereign profile

This is a separate, optional chart for the complete public Lolly route contract
and one Caddy edge shared with an existing private Lolly Work instance. The
original chart at `deploy/helm/` keeps its existing defaults. This profile does
not create or replace Work, PostgreSQL, the render worker or the private relay.
Those services have their own deployment and qualification.

The public namespace has four singleton Deployments: the signed public web
image, the MCP gateway with its in-process public live relay, the CA and the
Penpot adapter. The edge namespace has one Caddy Deployment with `Recreate`
strategy and explicit node placement. A single process owns each live relay;
there is no high-availability or distributed relay claim. Restarting a relay
ends its in-memory invitations and connected sessions.

Public routing matches the [VM recipe](../../../docker/public-vm.md): docs
aliases and discovery, MIME and cache policy, reserved-path 404s, model HEAD and
Range, MCP and OAuth discovery, public tool rendering, image fetch, CA, Penpot
streaming and the public live routes. The web container serves models from an
existing read-only PVC at `/usr/share/nginx/html/models`; no model HTTP service
is added. The model release identity must come from the
[immutable release verifier](../../../models-host/README.md).

The private host uses separate configuration imported by the same edge. Work
API, login, admin, catalog and collaboration routes reach the existing Work
Service. `/live/*` reaches the separate existing private relay. Public shell
functions reach the appropriate internal public Service with the existing
private proxy cookie policy: instance cookies are stripped from those functions
and explicit Authorization is preserved. The remaining shell routes reach Work
without cookies or Authorization. This does not move private catalogs into the
public namespace or add private pack mounts to public pods.

## Required operator inputs

Every image, including Caddy, requires an independently qualified `sha256`
digest. `fixture.values.json` contains synthetic pins, test domains and a
reserved documentation address; it is for rendering only. Defaults deliberately
refuse installation until actual inputs are supplied.

Set the exact public and private DNS names and their owned redirect aliases.
The default `edge.tls.mode: acme` lets Caddy issue and renew certificates itself,
using `edge.tls.email` and an existing writable `edge.tls.existingClaim` PVC in
the edge namespace. Keep that certificate/account storage persistent across
rollouts and qualify backup/restore. DNS and inbound 80/443 must reach the edge
for domain validation at cutover; staging must not request production
certificates while those domains still point elsewhere.

For HTTPS staging before DNS, select `edge.tls.mode: file` with existing public
and private TLS Secrets in the edge namespace. Certificates must cover the
respective canonical and redirect names. Use a trusted internal CA or explicitly
pinned certificate and `curl --resolve`. File mode does not automatically renew
certificates and needs a Caddy rollout after replacement Secrets. No mode ships
TLS private keys in the chart.

After DNS and inbound 80/443 reach this edge, `edge.tls.mode: bootstrap` can keep
both exact file Secrets mounted while using the same persistent
`edge.tls.existingClaim` and `edge.tls.email` as ACME mode. Caddy's
[`auto_https ignore_loaded_certs`](https://caddyserver.com/docs/caddyfile/options#auto-https)
requests managed certificates even with trusted certificates already loaded.
The file certificates continue to be selected during bootstrap. Do not enable
this mode before DNS moves; challenges reaching the previous host can fail and
consume issuance limits. Qualify the actual managed certificate names, chain,
expiry and persistent storage, then select `acme` to stop selecting file
certificates. Verify the managed certificates after a restart with the same PVC
and record the renewal/restore procedure. An initial staging certificate or
configuration validation does not prove automatic renewal. The single edge
uses `Recreate`, so these rollouts require a bounded service interruption.

Provide separate existing MCP and CA configuration Secrets in the public
namespace. Only each respective service receives its Secret. MCP configuration
needs the approved bearer/OAuth credentials and durable HTTPS REST rate limiter;
CA needs its root key/certificate, service secret, configured identity provider,
durable HTTPS REST limiter and approved email adapter. Keep the current REST
limiter and CA email dependencies until their replacements have their own
qualification. Missing credentials do not enable anonymous access. Production
settings disable anonymous MCP by default and always disable private-file access,
fake CA provider and in-memory rate-limit fallbacks. A deployment with reviewed
public open access can explicitly set `components.mcp.allowAnonymous: true`;
this still exposes only its public catalog and metered tools. Never copy a shared
token from a different deployment to change that identity policy.

The standard MCP image has no Chromium and defaults to an empty web base.
The optional `mcp-browser.Dockerfile` installs lockfile-scoped Chromium and its
runtime dependencies without enabling a sandbox bypass. Apply
`browser.values.yaml` for its larger memory/scratch bounds and set a qualified
browser-image digest plus `components.mcp.webBase` to the exact public HTTPS
origin. The browser queue is bounded to one active and four waiting jobs by
default. Qualify sandbox startup and actual exports on the target before enabling
this variant. `components.mcp.browser.noSandbox` stays false; any explicit bypass
needs review of the actual container boundary and untrusted rendering workload.

Set `edge.nodeName` to the exact node and `edge.upstreamSourceAddress` to a local
node address used for outgoing Caddy sockets. Measure the actual peer at each
public API and private Work Service before setting `edge.proxyAddresses`. These
are exact IPv4 or IPv4-mapped IPv6 addresses; pod CIDRs and wildcard trust are
refused. Binding an outgoing address alone does not prove the observed peer;
CNI routing and source NAT must be checked. NetworkPolicies restrict public
Service ingress to those normalized IPv4 peers on each component's native port.
Keep private Work ingress similarly closed and preserve its qualified
`trustedProxyHops` setting. Caddy overwrites forwarded client addresses and
removes spoofable alternative proxy headers. Host networking bypasses some
namespace NetworkPolicy assumptions, so firewall and route checks remain
required.

Existing image-pull Secret names apply to all pods. Supply those Secret names in
both public and edge namespaces if using a private registry. The chart does not
copy credentials between namespaces. The models PVC must exist in the public
namespace and contain the verified release. An optional `models.subPath` selects
a safe relative release directory; absolute paths and traversal are refused.

## Admission and network preparation

Use Kubernetes 1.30 or newer with `ValidatingAdmissionPolicy` enabled. Disable
Traefik and ServiceLB in the K3s operator configuration. The single edge binds
host ports 80 and 443 directly; the chart creates no NodePorts, LoadBalancer
Services or edge Service. Reserve those ports for this owner. Keep the API,
kubelet, database and VXLAN ports closed on public interfaces using the provider
and host firewalls.

The public and private application namespaces remain under restricted Pod
Security Admission. Host networking needs a separate edge namespace exception.
The chart includes a fail-closed admission policy and namespace-scoped binding
that allow only the pinned single Caddy container, reviewed node, command,
hostnames, resources, mounts, certificate mode and ports. It forbids sidecars, debug containers,
service-account token mounts, host paths and privilege escalation. The edge
runs as UID 1000 with a read-only filesystem and RuntimeDefault seccomp, drops
all capabilities and adds only `NET_BIND_SERVICE` to bind 80/443.

By default namespaces are prepared by the operator. `manageNamespaces: true`
creates the public namespace with restricted enforcement and the edge namespace
with privileged enforcement plus restricted audit/warn labels. It does not
manage the private namespace. The edge exception must be explicitly reviewed
with `edge.hostNetworkAcknowledged: true`; that value is an acknowledgment, not
proof that the admission policy or networking passed runtime acceptance.

Prepare the namespaces, then install the policy and binding before allowing any
edge Pod. For example, using the same release name and namespace as the later
Helm installation:

```sh
helm template sovereign deploy/helm/profiles/sovereign --namespace lolly-public \
  -f /secure/sovereign.values.yaml --show-only templates/admission.yaml \
  | kubectl apply --server-side -f -
```

The policy resources include Helm ownership annotations so the later release can
adopt them. They have `helm.sh/resource-policy: keep` so uninstall or a failed
release does not remove the guard from a still-exempt namespace. Review and
remove the namespace exception and retained admission resources together when
decommissioning. Do not disable the policy to bypass a failed qualification.

Inspect the policy's `status.typeChecking.expressionWarnings` and require no
warnings. Server-dry-run the actual edge **Pod**, then test refusal of changed
image, node, root identity, extra capability, sidecar, environment, mount and
unbounded resource. A dry-run of a Deployment alone does not evaluate Pod
admission. Qualify these checks on the target Kubernetes API before installing
this profile; local schema validation and Caddy adaptation cannot prove CEL
admission behavior.

```sh
helm lint deploy/helm/profiles/sovereign --strict -f /secure/sovereign.values.yaml
helm upgrade --install sovereign deploy/helm/profiles/sovereign \
  --namespace lolly-public -f /secure/sovereign.values.yaml --wait --timeout 5m
```

## Resource and acceptance contract

The standard browser-free starting public plus edge requests total 150 millicores and 352 MiB memory;
memory limits total 1600 MiB and CPU limits total 2.75 cores. Each pod has explicit
CPU, memory and ephemeral-storage requests/limits and bounded disk-backed scratch
volumes. These are initial limits, not a capacity result. Add the independently
bounded Work, PostgreSQL, worker and private relay footprint when sizing a shared
node. Measure observed memory, throttle events and large-asset behavior under
the actual team/agent workload. Do not infer thousands of users or a resilient
cluster from a successful single-node render.

The dedicated deployment workflow runs strict chart lint/schema checks and
actual Caddy parsing, including refusal cases for missing trust data and
malformed image/storage inputs. The native VM suite separately checks real
Caddy/nginx routes with bounded fixtures. Neither test is production acceptance.

Before DNS cutover, qualify actual signed images, published catalog pin and
sample manifest hashes; all public/private route classes; HTTPS/Host/header and
cookie custody; durable limiter failure behavior; CA root and enrollment;
Penpot streaming; native model Range/HEAD/CORS; browser and invited-agent
permissions; measured proxy peers; actual admission refusals; application and
edge readiness; and firewall exposure. Complete provider login callback
acceptance after the canonical domains move. Retain the previous runtime and DNS
rollback until those checks pass. Application live behavior and HA remain
explicitly unqualified until exercised on the real candidate.


## Optional namespace sandbox seccomp profile

When the browser needs namespace syscalls under the no-capability runtime,
use the maintained [browser seccomp profile](../../../docker/seccomp/README.md). It preserves the captured
RuntimeDefault baseline and adds only the measured `clone`, `setns`, `unshare`
and `chroot` calls. All capabilities stay dropped; the root filesystem remains
read-only and privilege escalation stays disabled. Chromium's internal namespace
and Seccomp-BPF sandboxes remain enabled. Other components retain RuntimeDefault.

Install and verify the exact profile on the prepared node before creating an
MCP Pod. The sovereign option `components.mcp.browser.localhostProfile` is empty
by default; setting the hash-bearing relative path pins only MCP to
`edge.nodeName`. The optional Compose browser overlay requires an absolute,
verified `LOLLY_PUBLIC_BROWSER_SECCOMP_FILE` on its Docker host. Do not substitute
an unconfined profile, a capability increase or a sandbox bypass.

Record actual Chromium sandbox diagnostics and real SVG/PNG/PDF exports from
the final image under the target's kernel, seccomp and SELinux policy. Repeat
this acceptance after runtime/browser/node upgrades. The CI native export check
uses the same versioned profile, but does not replace target acceptance or prove
high availability.
