# Admission policy with Kubewarden

This page is for a platform team that runs [Kubewarden](https://www.kubewarden.io/)
and wants admission policy for Lolly Work's pods. Lolly Work publishes what its pods
need as data and a ready policy set built from published Kubewarden policies. Nothing
is installed with the Helm chart: a cluster without Kubewarden runs Work unchanged, and
the set applies only to namespaces you label. For running Kubewarden itself, and for
rehearsing in audit mode first, see
[WebAssembly and Kubewarden choices](wasm-deployment.md#evaluate-kubewarden).

Three files in the lolly-work repository make up the set:

| File | What it holds |
|---|---|
| [`deploy/kubewarden/lolly-work-requirements.json`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/kubewarden/lolly-work-requirements.json) | What Work's pods need, generated from the Helm chart's templates, the render worker's egress rule and the release workflow |
| [`deploy/kubewarden/policies.yaml`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/kubewarden/policies.yaml) | 13 `ClusterAdmissionPolicy` objects that admit those pods and refuse everything else |
| [`deploy/kubewarden/options/render-worker-user-namespace.yaml`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/kubewarden/options/render-worker-user-namespace.yaml) | Applied on top, only when the render worker runs in its own user namespace |

## What Work's pods need

Work has up to five kinds of container: the control plane, the migration Job, the
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
ports 80 and 443, and its own code refuses the same private, shared, loopback,
link-local (which includes cloud metadata at `169.254.169.254`), documentation and
multicast ranges, so a rendered page cannot reach the cluster or the metadata service.
The requirements file lists every range.

## The policy set

| Policy | Published policy | What it enforces |
|---|---|---|
| `lolly-work-privileged` | `pod-privileged` v1.0.14 | No privileged container |
| `lolly-work-privilege-escalation` | `allow-privilege-escalation-psp` v1.0.15 | `allowPrivilegeEscalation: false` in every container |
| `lolly-work-capabilities` | `capabilities-psp` v1.0.15 | Drop `ALL` and add nothing, in every pod except the render worker |
| `lolly-work-capabilities-render-worker` | `capabilities-psp` v1.0.15 | The same for the render worker |
| `lolly-work-user-group` | `user-group-psp` v1.1.5 | UID and GID 1000, supplemental groups within 1000 |
| `lolly-work-fsgroup` | `allowed-fsgroups-psp` v1.0.14 | `fsGroup` 1000 |
| `lolly-work-host-namespaces` | `host-namespaces-psp` v1.1.13 | No host network, PID, IPC or ports |
| `lolly-work-volumes` | `volumes-psp` v1.1.12 | `configMap`, `emptyDir`, `persistentVolumeClaim` and `secret` only |
| `lolly-work-readonly-root` | `readonly-root-filesystem-psp` v1.0.15 | A read-only root filesystem in every container |
| `lolly-work-seccomp` | `seccomp-psp` v1.0.16 | `RuntimeDefault`, or `Localhost` with `lolly/chromium.json` |
| `lolly-work-apparmor` | `cel-policy` v1.6.5 | Unset, `RuntimeDefault`, or `Localhost` with `lolly-chromium`, in the field and in the older annotation |
| `lolly-work-image-sources` | `trusted-repos` v2.1.6 | Only the two Work images |
| `lolly-work-image-signatures` | `verify-image-signatures` v1.0.13 | Both images carry a signature from the release workflow; each pod runs the digest that was verified |

Every module is pinned by tag and digest in `policies.yaml`. Two policies mutate pods:
`lolly-work-user-group` fills an unset container UID or GID with 1000, and
`lolly-work-image-signatures` replaces an image tag with the digest it verified. The
others only admit or refuse.

## Apply the set

Label the namespace Work runs in, apply the policies and wait for them:

```sh
kubectl label namespace lolly-work lolly.tools/policy-set=lolly-work
kubectl apply -f deploy/kubewarden/policies.yaml
kubectl wait --for=condition=PolicyActive clusteradmissionpolicy \
  -l app.kubernetes.io/part-of=lolly-work-policy-set --timeout=5m
```

The policies apply to every Pod in a labelled namespace, so keep PostgreSQL and other
workloads in a namespace of their own, and let only cluster administrators change
namespace labels. The Policy Server restarts whenever a policy changes; give it a
minute before you test.

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
the policy's message for each, and exits with status 1 when a Work pod is refused or
a probe is admitted.

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

## Behaviour of the published policies

Qualifying the set turned up four things about the published policies that shaped it:

- `verify-image-signatures` reads its prefix setting as `url_prefix`, although its
  README shows `urlPrefix`, and it appends `/` to the prefix. A prefix ending in
  `refs/tags/v` therefore matches nothing, so the set uses
  `https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/`.
- `apparmor-psp` reads only the `container.apparmor.security.beta.kubernetes.io/`
  annotation. Kubernetes 1.30 and later, and Work's chart, set
  `securityContext.appArmorProfile`, which that policy admitted unchecked, so the set
  uses a CEL rule instead.
- `user-group-psp` v1.1.5 with `validate_only: true` refuses `MustRunAs` even when the
  ID is present and within range, and checks each container without the pod's own
  value. The set runs it as a mutating policy.
- A first signature verification fetches Sigstore's trust material and can take longer
  than the Policy Server's 2-second evaluation limit, so the signature policy sets
  `timeoutEvalSeconds: 10`.

## Qualification

On 2026-10-27 the set ran on Kubewarden 1.38.2 (`admission-controller` chart 6.1.0)
with K3s 1.35.5 in k3d, on arm64. Work 1.1.2 and its render worker, pinned by digest,
were installed with PostgreSQL 17 in a separate namespace and the worker on the
`Localhost` seccomp profile.

| Check | Result |
|---|---|
| Migration Job, control plane and render worker | Admitted; both Deployments became ready, and the worker's readiness requires a launched, sandboxed Chromium |
| A privileged pod, created for real | Refused by `lolly-work-privileged` |
| Work's own pod with the unsigned `lolly-work-server:0.2.0` image, created for real | Refused by `lolly-work-image-signatures` |
| A signature from the release workflow, against a policy expecting another workflow | Refused |
| The nine preflight probes | Each refused, by the policy for its rule |
| An unreviewed AppArmor profile on the worker | Refused by `lolly-work-apparmor` |
| The user-namespace worker, without and with the option file | Refused, then admitted |
| A pod with the worker's label adding `SYS_ADMIN` without its own user namespace | Refused by the CEL rule |

## When the chart changes

`node scripts/kubewarden-requirements.ts --write` regenerates the requirements file
from the chart. `tests/kubewarden-policies.test.ts` fails until the requirements match
the chart and the policies agree with the requirements, so a chart change that needs a
new volume type, capability or profile cannot pass review with the set out of date.
