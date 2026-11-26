# Admission policy with Kubewarden

Lolly Work publishes what its pods need as data and a ready policy set built from
published [Kubewarden](https://www.kubewarden.io/) policies. Nothing
is installed with the Helm chart: a cluster without Kubewarden runs Lolly Work unchanged, and
the set applies only to namespaces you label. For running Kubewarden itself, and for
rehearsing in audit mode first, see
[WebAssembly and Kubewarden choices](wasm-deployment.md#evaluate-kubewarden).

Three files in the lolly-work repository make up the set:

| File | What it holds |
|---|---|
| [`deploy/kubewarden/lolly-work-requirements.json`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/kubewarden/lolly-work-requirements.json) | What Lolly Work's pods need, generated from the Helm chart's templates, the render worker's egress rule and the release workflow |
| [`deploy/kubewarden/policies.yaml`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/kubewarden/policies.yaml) | 13 `ClusterAdmissionPolicy` objects that admit those pods and refuse everything else |
| [`deploy/kubewarden/options/render-worker-user-namespace.yaml`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/kubewarden/options/render-worker-user-namespace.yaml) | Applied on top, only when the render worker runs in its own user namespace |

**What you'll do**, in four steps:

::: steps
- <!--i:eti-checklist--> **[Review the needs](#what-lolly-work-s-pods-need)** What the chart's pods need, and the chart values that change that list.
- <!--i:eti-shield-check--> **[Review the set](#the-policy-set)** The 13 pinned policies and what each enforces.
- <!--i:eti-stamp--> **[Apply the set](#apply-the-set)** Label the namespace, apply the policies and wait for them.
- <!--i:eti-search--> **[Check your values](#check-your-values-before-installing)** A server-side dry run of every pod the chart would create.
:::

<a id="what-work-s-pods-need"></a>
<!--i:eti-checklist-->
## What Lolly Work's pods need

Lolly Work has up to five kinds of container: the control plane, the migration Job, the
optional render worker, and the optional copy steps that fill the pack and web app
volumes from your images. With the chart's defaults, each of them:

| Need | Value |
|---|---|
| User, group and `fsGroup` | 1000, with no supplemental groups |
| Root user | never (`runAsNonRoot: true`) |
| Capabilities | drop `ALL`, add none |
| Privilege escalation and privileged mode | off |
| Root filesystem | read-only; scratch is an `emptyDir` at `/tmp` |
| Seccomp | `RuntimeDefault` |
| AppArmor | unset, so the runtime's default applies |
| Volume types | `configMap`, `emptyDir`, `secret` (the worker's certificates and trust bundle), `persistentVolumeClaim` (pack or web app volumes) |
| Host network, PID, IPC, ports or user namespace | none |
| Kubernetes API access | none; no ServiceAccount token is mounted |

Some chart values change that list:

| Chart value | What changes |
|---|---|
| `renderWorker.seccompProfile: { type: Localhost, localhostProfile: lolly/chromium.json }` | The worker uses the [reviewed Chromium seccomp profile](https://github.com/lolly-tools/lolly-work/blob/main/deploy/seccomp/README.md) installed on the node |
| `renderWorker.appArmorProfile: { type: Localhost, localhostProfile: lolly-chromium }` | On AppArmor nodes, the worker uses the [reviewed AppArmor profile](https://github.com/lolly-tools/lolly-work/blob/main/deploy/apparmor/README.md) |
| `renderWorker.userNamespace.enabled: true` | The worker runs with `hostUsers: false` and adds `SYS_ADMIN` and `SYS_CHROOT` inside its own user namespace |
| `pack.type` or `shell.type` set to `hostPath` | A `hostPath` volume, meant for a single node. The policy set refuses it |
| `serviceAccount.automountServiceAccountToken: true` | A `projected` token volume. The policy set refuses it |
| `pack.image`, `shell.image` | An init container running your image |

**Images and their signatures.** The two images are
`ghcr.io/lolly-tools/lolly-work-server` and `ghcr.io/lolly-tools/lolly-work-render-worker`.
Both are signed keyless with Sigstore by lolly-work's release workflow at a release
tag:

| Field | Value |
|---|---|
| Issuer | `https://token.actions.githubusercontent.com` |
| Subject | `https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/v<version>` |

The signatures are Sigstore bundles stored as OCI referrers, as cosign 3 writes them;
there is no `.sig` tag. To check one by hand:

```sh
cosign verify ghcr.io/lolly-tools/lolly-work-server@sha256:<digest> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/lolly-tools/lolly-work/\.github/workflows/release\.yml@refs/tags/v'
```

**Network.** The control plane accepts traffic on port 8787 and, by default, may
reach anything: PostgreSQL, your identity provider, catalog sources, mail relays and
the SIEM receiver. The render worker accepts connections from the control plane only,
on port 8791. Its NetworkPolicy lets it reach cluster DNS and public addresses on
ports 80 and 443. Its own code refuses the same private, shared, loopback,
link-local (which includes cloud metadata at `169.254.169.254`), documentation and
multicast ranges, so a rendered page cannot reach the cluster or the metadata service.
The requirements file lists every range.

<!--i:eti-shield-check-->
## The policy set

| Policy | Published policy | What it enforces |
|---|---|---|
| `lolly-work-privileged` | `pod-privileged` v1.0.14 | No privileged container |
| `lolly-work-privilege-escalation` | `allow-privilege-escalation-psp` v1.0.16 | `allowPrivilegeEscalation: false` in every container |
| `lolly-work-capabilities` | `capabilities-psp` v1.0.16 | Drop `ALL` and add nothing, in every pod except the render worker |
| `lolly-work-capabilities-render-worker` | `capabilities-psp` v1.0.16 | The same for the render worker |
| `lolly-work-user-group` | `user-group-psp` v1.1.5 | UID and GID 1000, supplemental groups within 1000 |
| `lolly-work-fsgroup` | `allowed-fsgroups-psp` v1.0.15 | `fsGroup` 1000 |
| `lolly-work-host-namespaces` | `host-namespaces-psp` v1.1.14 | No host network, PID, IPC or ports |
| `lolly-work-volumes` | `volumes-psp` v1.1.12 | `configMap`, `emptyDir`, `persistentVolumeClaim` and `secret` only |
| `lolly-work-readonly-root` | `readonly-root-filesystem-psp` v1.0.16 | A read-only root filesystem in every container |
| `lolly-work-seccomp` | `seccomp-psp` v1.0.16 | `RuntimeDefault`, or `Localhost` with `lolly/chromium.json` |
| `lolly-work-apparmor` | `cel-policy` v1.6.6 | Unset, `RuntimeDefault`, or `Localhost` with `lolly-chromium`, in the field and in the older annotation |
| `lolly-work-image-sources` | `trusted-repos` v2.1.7 | Only the two Lolly Work images |
| `lolly-work-image-signatures` | `verify-image-signatures` v1.0.14 | Both images carry a signature from the release workflow; each pod runs the digest that was verified |

Every module is pinned by tag and digest in `policies.yaml`. Two policies mutate pods:
`lolly-work-user-group` fills an unset container UID or GID with 1000, and
`lolly-work-image-signatures` replaces an image tag with the digest it verified. The
others only admit or refuse.

<!--i:eti-stamp-->
## Apply the set

::: warning The set applies to every pod in the namespace
Keep PostgreSQL and other workloads in a namespace of their own, and let only cluster
administrators change namespace labels.
:::

Label the namespace Lolly Work runs in, apply the policies and wait for them:

```sh
kubectl label namespace lolly-work lolly.tools/policy-set=lolly-work
kubectl apply -f deploy/kubewarden/policies.yaml
kubectl wait --for=condition=PolicyActive clusteradmissionpolicy \
  -l app.kubernetes.io/part-of=lolly-work-policy-set --timeout=5m
```

The Policy Server restarts whenever a policy changes; give it a minute before you test.

### Check your values before installing

From a lolly-work checkout, the preflight script sends every pod the chart would
create to the cluster as a server-side dry run, so each admission webhook answers and
nothing is created:

```sh
helm template lolly-work deploy/helm -n lolly-work -f my-values.yaml \
  | node scripts/kubewarden-preflight.ts --namespace lolly-work --probes
```

With `--probes` it also sends nine copies of the control-plane pod, each breaking one
rule: a privileged container, an added capability, the root user, a writable root
filesystem, the host network, a `hostPath` volume, an unconfined seccomp profile, an
unsigned image and an image outside the list. It prints `ADMITTED` or `REFUSED` with
the policy's message for each, and exits with status 1 when a Lolly Work pod is refused or
a probe is admitted. A probe refused for another reason, such as a quota or a missing
namespace, prints `ERROR` and also fails the run.

A Policy Server that takes longer than its evaluation limit, 2 seconds by default,
refuses the request without deciding anything. Kubewarden words that as "exceeded the
allowed execution time" or as a refusal "without explanation". The preflight asks
again, up to three times, and prints `TIMEOUT` when no decision came. A timeout points
to a Policy Server short of CPU, most often just after it restarted, and says nothing
about the pod.

::: check A clean preflight
Every Lolly Work pod prints `ADMITTED`, each of the nine probes prints `REFUSED` with the
message of the policy for its rule, and the script exits with status 0.
:::

### Show Kubewarden's answers to administrators

Lolly Work has no access to the Kubernetes API, so it cannot ask Kubewarden about its
own pods. The preflight can write down what Kubewarden answered, and Setup can show
that record to owners. Add `--report`, then store the file in a ConfigMap:

```sh
helm template lolly-work deploy/helm -n lolly-work -f my-values.yaml \
  | node scripts/kubewarden-preflight.ts --namespace lolly-work --probes --report report.json
kubectl create configmap lolly-work-admission -n lolly-work \
  --from-file=report.json --dry-run=client -o yaml | kubectl apply -f -
```

Set `admissionReport.existingConfigMap: lolly-work-admission` in the chart values and
upgrade. Setup then shows one line under its remaining deployment checks:

> **Pod admission, from Kubewarden: pass.** Reported by Kubewarden 1.39.0 for namespace
> lolly-work on 2026-11-24: 13 of 13 policies active and enforcing, 3 of 3 Lolly Work
> pods admitted, 9 of 9 test pods refused. This is the record your platform team made
> with the preflight, not a live reading.

The record holds Kubewarden's version, each policy's name, module, mode and state, the
pods it admitted and the test pods it refused with the policy that refused each. It
holds names and fixed words only, never a webhook's message.

| The line shows | When |
|---|---|
| `pass` | Every policy was active and in `protect` mode, every Lolly Work pod was admitted and every test pod was refused by a policy |
| `warning` | A policy was pending or in `monitor` mode, a pod was refused, a test pod was admitted, the file cannot be read, or the record is more than 90 days old |
| Nothing | No ConfigMap is named, which is the default |

Lolly Work counts the answers again when it reads the record, so a record that calls
itself clean while a policy was pending is shown with a warning. Run the preflight
again after a cluster, chart or policy change. An updated ConfigMap reaches the running
pod without a restart. The `--report` option needs read access to Kubewarden's
`policyservers` and `clusteradmissionpolicies`; Lolly Work's own pods still mount no
ServiceAccount token.

### Options

- **The render worker in its own user namespace.** After `policies.yaml`, apply
  `options/render-worker-user-namespace.yaml`. It lets the render worker add
  `SYS_ADMIN` and `SYS_CHROOT`, and adds a CEL rule that refuses any pod adding a
  capability unless it sets `hostUsers: false`. The capability policy selects the
  worker by its component label, which anyone who can create pods in the namespace can
  copy; the CEL rule keeps the two capabilities inside a user namespace even then.
- **Your pack and web app images.** Add their repositories to the `images.allow` list
  of `lolly-work-image-sources`. Sign them and add a `signatures` entry to
  `lolly-work-image-signatures` if you want them verified too.
- **A mirror.** Mirrored images have new names. Add the mirrored repositories to
  `lolly-work-image-sources` and as `image` patterns in `lolly-work-image-signatures`,
  and copy the signatures with the images (`cosign copy`, or a registry that serves OCI
  referrers). The signing identity stays the same.
- **`hostPath` volumes.** The set refuses them. A single-node install that needs one
  should add `hostPath` to `lolly-work-volumes` knowingly.

<!--i:eti-info-->
## Behaviour of the published policies

Qualifying the set turned up four things about the published policies that shaped the set:

- `verify-image-signatures` reads its prefix setting as `url_prefix`, although its
  README shows `urlPrefix`, and it appends `/` to the prefix. A prefix ending in
  `refs/tags/v` therefore matches nothing, so the set uses
  `https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/`.
- `apparmor-psp` reads only the `container.apparmor.security.beta.kubernetes.io/`
  annotation. Kubernetes 1.30 and later, and Lolly Work's chart, set
  `securityContext.appArmorProfile`, which that policy admitted unchecked, so the set
  uses a CEL rule instead.
- `user-group-psp` v1.1.5 with `validate_only: true` refuses `MustRunAs` even when the
  ID is present and within range, and checks each container without the pod's own
  value. The set runs it as a mutating policy.
- A first signature verification fetches Sigstore's trust material and can take longer
  than the Policy Server's 2-second evaluation limit, so the signature policy sets
  `timeoutEvalSeconds: 10`.

<!--i:eti-badge-check-->
## Qualification

On 2026-11-24 the set ran on Kubewarden 1.39.0 (`admission-controller` chart 6.2.0)
with K3s 1.35.5 in k3d, on arm64, after eight modules moved to their newer releases.
The pods of chart 1.2.1 with the render worker were sent as server-side dry runs;
Lolly Work itself was not installed in this run.

| Check | Result |
|---|---|
| Three preflight runs with probes | Each time the control plane, the render worker and the migration Job were admitted, and Kubewarden verified the release signatures of both 1.2.1 images |
| The nine preflight probes, in each run | Each refused, by the policy for its rule |
| The record written by `--report` | Kubewarden 1.39.0, 13 of 13 policies active and enforcing; Setup's check read the record as `pass` |
| The user-namespace worker, without and with the option file | Refused, then admitted |
| A Policy Server short of CPU just after a restart | Single evaluations passed the 2-second limit and were refused with no decision. The preflight asks again and prints `TIMEOUT` for these |

Kubewarden 1.39 needs Kubernetes 1.31 or later. It also fixes a certificate reload
fault that affects Kubewarden 1.32.0 to 1.38.0 with mutual TLS turned on
([GHSA-g62h-p6qf-949g](https://github.com/kubewarden/kubewarden-controller/security/advisories/GHSA-g62h-p6qf-949g)).
[How Lolly uses Kubewarden](kubewarden.md#which-kubewarden-version) lists what else
changed.

A real install, the unreviewed AppArmor profile and the pod that borrows the worker's
label were not run again. The earlier run covers them:

On 2026-10-27 the set ran on Kubewarden 1.38.2 (`admission-controller` chart 6.1.0)
with K3s 1.35.5 in k3d, on arm64. Lolly Work 1.1.2 and its render worker, pinned by digest,
were installed with PostgreSQL 17 in a separate namespace and the worker on the
`Localhost` seccomp profile.

| Check | Result |
|---|---|
| Migration Job, control plane and render worker | Admitted; both Deployments became ready, and the worker's readiness requires a launched, sandboxed Chromium |
| A privileged pod, created for real | Refused by `lolly-work-privileged` |
| Lolly Work's own pod with the unsigned `lolly-work-server:0.2.0` image, created for real | Refused by `lolly-work-image-signatures` |
| A signature from the release workflow, against a policy expecting another workflow | Refused |
| The nine preflight probes | Each refused, by the policy for its rule |
| An unreviewed AppArmor profile on the worker | Refused by `lolly-work-apparmor` |
| The user-namespace worker, without and with the option file | Refused, then admitted |
| A pod with the worker's label adding `SYS_ADMIN` without its own user namespace | Refused by the CEL rule |

<!--i:eti-refresh-->
## When the chart changes

`node scripts/kubewarden-requirements.ts --write` regenerates the requirements file
from the chart. `tests/kubewarden-policies.test.ts` fails until the requirements match
the chart and the policies agree with the requirements, so a chart change that needs a
new volume type, capability or profile cannot pass review with the set out of date.
