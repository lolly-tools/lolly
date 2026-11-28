# How Lolly uses Kubewarden

[Kubewarden](https://www.kubewarden.io/) is a policy engine for Kubernetes. Each time
something asks the cluster to create or change an object, Kubewarden runs its policies
and admits or refuses the request. This page says where Lolly uses it, what it checks
and what an administrator can see. Kubewarden is optional, and every Lolly install works without Kubewarden.

<!--i:eti-grid-->
## Where Kubewarden applies

| Part of Lolly | Uses Kubewarden |
|---|---|
| The Lolly app in a browser, on a desktop or on a phone | No. Nothing runs in a cluster |
| The CLI, the MCP server and the render action | No |
| Lolly Work on Docker Compose, YunoHost or a single server | No. There is no Kubernetes admission step |
| Lolly Work on Kubernetes | Optional. Your platform team applies the policy set and Kubewarden checks every Lolly Work pod |

Lolly installs no admission controller and its Helm chart enforces no policy. A cluster
without Kubewarden runs Lolly Work unchanged.

<!--i:eti-shield-check-->
## What Kubewarden checks

Lolly Work publishes what its pods need as data, generated from the Helm chart, and 13
policies built from Kubewarden's published policy modules. Each module is pinned by
version and digest. Applied to the namespace you label, they admit Lolly Work's pods
and refuse the rest:

| Kubewarden checks | So that |
|---|---|
| No privileged container, no privilege escalation, every capability dropped | A pod cannot take more rights than it was given |
| User and group 1000, never root | A file a pod writes belongs to an ordinary user |
| A read-only root filesystem | A pod cannot change its own image |
| No host network, process list, IPC or ports | A pod stays inside its own network and process space |
| Only `configMap`, `emptyDir`, `secret` and `persistentVolumeClaim` volumes | A pod cannot mount a directory of the node |
| The runtime's default seccomp and AppArmor profiles, or the two reviewed Chromium profiles | The render worker's sandbox is the reviewed one |
| Only Lolly Work's two images | No other image runs in the namespace |
| A signature from Lolly Work's release workflow on each image | The image is the one the release built, and the pod runs the digest that was verified |

The full list, the settings and the files are in
[Admission policy with Kubewarden](admission-policy.md).

<!--i:eti-eye-->
## What an administrator sees

Lolly Work has no access to the Kubernetes API, so it cannot ask Kubewarden anything.
Your platform team asks instead. The preflight script sends each Lolly Work pod to the
cluster as a dry run, sends nine test pods that each break one rule, and writes down
what Kubewarden answered. When you give that record to the chart, Setup shows one line
to owners:

> **Pod admission, from Kubewarden: pass.** Reported by Kubewarden 1.39.0 for namespace
> lolly-work on 2026-11-24: 13 of 13 policies active and enforcing, 3 of 3 Lolly Work
> pods admitted, 9 of 9 test pods refused. This is the record your platform team made
> with the preflight, not a live reading.

The line gives Kubewarden's name, its version and the date because the answers are
Kubewarden's and they were true on that date. Lolly Work counts the answers again when
it reads the record, so a record that calls itself clean while a policy was pending is
shown with a warning. The line also warns when the record is more than 90 days old.
With no record, Setup shows no line.
[Show Kubewarden's answers to administrators](admission-policy.md#show-kubewarden-s-answers-to-administrators)
has the two commands.

<!--i:eti-clipboard-->
## Which Kubewarden version

The policy set is qualified against a named Kubewarden release, and the record of each
qualification is in [Admission policy with Kubewarden](admission-policy.md#qualification).
The current one is Kubewarden 1.39.0, released on 2026-11-16. Four things in
[that release](https://www.kubewarden.io/blog/2026/11/admission-controller-1.39-release/)
matter to a cluster that runs Lolly Work:

- **A security fix for mutual TLS.** In Kubewarden 1.32.0 to 1.38.0 with mutual TLS
  turned on, a Policy Server stopped reloading its certificates after the first change
  to the mounted Secret
  ([GHSA-g62h-p6qf-949g](https://github.com/kubewarden/kubewarden-controller/security/advisories/GHSA-g62h-p6qf-949g)).
  Upgrade if you use mutual TLS.
- **Kubernetes 1.31 is the oldest supported version.** It was 1.27.
- **The controller makes its own certificates and webhooks.** Argo CD no longer needs
  `ignoreDifferences` for them.
- **Left-over webhooks are removed.** Changing a policy between validating and mutating
  used to leave the old webhook behind, where it could refuse requests after the policy
  was gone. The release post gives the command for webhooks left by policies deleted
  before the upgrade.

Kubewarden states that its images and its `kwctl` tool are built to SLSA Build Level 3
from this release. To check what you install, follow
[Verifying Kubewarden](https://docs.kubewarden.io/admission-controller/1.39/en/tutorials/verifying-kubewarden.html).

<!--i:eti-eye-off-->
## What Lolly does not use

- **CEL compiled to WebAssembly.** Kubewarden 1.39 can compile a
  `ValidatingAdmissionPolicy` into its own small module, and marks the feature
  experimental. Lolly's two CEL rules stay on the published `cel-policy` module until
  that changes.
- **The audit scanner's reports.** Reading them from inside Lolly Work would need a
  ServiceAccount token, which the policy set refuses. The preflight record takes their
  place.
- **Runtime Enforcer, Network Enforcer and SBOMscanner.** They are separate Kubewarden
  projects and nothing in Lolly depends on them.
- **Kubewarden outside Kubernetes.** `kwctl` can run a policy on a workstation or in a
  pipeline with no cluster. Lolly's own tests do not do this yet; they check that the
  policies agree with the chart, and admission is qualified on a real cluster.

For running Kubewarden itself and rehearsing in audit mode first, see
[WebAssembly and Kubewarden choices](wasm-deployment.md#evaluate-kubewarden).
