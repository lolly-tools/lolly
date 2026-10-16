# WebAssembly deployment choices

Lolly's current production deployment uses OCI containers. WebAssembly is an
optional development track for cluster policies and selected application tools.
It does not change the installation requirements for a private Work instance.

For a Rancher platform team, begin with Kubewarden policy evaluation. For a
developer building a portable worker, begin with a small WIT component and a
runtime compatibility record. A home or YunoHost installation can keep its
ordinary application services; neither Kubernetes nor a Wasm controller is
required to use Lolly.

## Choose the role

| Role | Preferred approach | Current Lolly support |
|---|---|---|
| Kubernetes admission policy | Rancher-managed Kubewarden; signed OCI-distributed policies | Evaluation guidance. No controller or enforced policy is installed by Lolly. |
| Portable application tool | WebAssembly Component Model, WIT interfaces and a pinned WASI version | Planned component adaptation and parity tests. Existing browser Wasm files are not deployable WASI components. |
| Component hosting on Kubernetes | A qualified SpinKube installation or containerd/runwasi handler with explicit RuntimeClass and node selection | Platform reference; no Wasm RuntimeClass setting is implemented in the Work chart. |
| Component hosting on a small Linux machine | A bounded host worker with explicit capabilities | Planned; no additional orchestrator is required by this proposal. |

Kubewarden evaluates Kubernetes admission requests. It does not run the Work
server, PostgreSQL or browser render worker. Keep policy enforcement separate
from the application runtime decision.

## Standards and runtime compatibility

Checked on 2026-10-07, [WASI 0.3 is stable](https://wasi.dev/releases), with
async support described in the [0.3 release guide](https://wasi.dev/releases/wasi-p3).
Pin the exact interface and generated bindings versions. Retain WASI 0.2
compatibility where the selected toolchain requires it; a 0.x stable release
is not a completed WASI 1.0 standard. SQL, KV, TLS and telemetry interfaces
cannot be assumed to exist on every component host.

Record the runtime embedded in the selected shim. The released
[runwasi Wasmtime shim 0.6.1](https://github.com/containerd/runwasi/blob/containerd-shim-wasmtime/v0.6.1/Cargo.toml)
uses Wasmtime 36.0.10, while the current WASI release guidance identifies
Wasmtime 46 or newer for final 0.3 support. Upgrading a standalone Wasmtime
binary does not upgrade the shim. SpinKube has its own
[compatibility matrix](https://www.spinkube.dev/docs/install/compatibility-matrices/).
Use the actual controller, chart, Spin, shim and embedded runtime versions in
the deployment record.

A platform qualification record should include:

- SLES/Leap version, architecture, K3s/RKE2 and containerd versions.
- Controller/chart versions, runtime handler and embedded runtime versions.
- OCI artifact digest, signature identity, provenance, SBOM and WIT imports.
- Supported WASI interface versions and generated bindings.
- Explicit filesystem, network and environment capabilities.
- Measured memory, execution deadline, cancellation and concurrency limits.
- Tests for malformed input, tenant isolation, restart, drain and rollback.

SUSE image trust remains useful for host services and dependencies. A generic
Wasm component is not automatically an Application Collection artifact or a
Rancher-supported runtime. Verify the selected product's actual support matrix.

## Evaluate Kubewarden first

Use a separate rehearsal cluster or narrowly selected rehearsal namespaces.
Follow the platform team's reviewed Kubewarden installation; Lolly does not
install an admission webhook as a side effect of an application release.

Start with audit mode and curated image verification policies. Apply the
[Application Collection verification guide](https://docs.kubewarden.io/admission-controller/1.38/en/howtos/application-collection/01-verify-images.html)
for selected dependency images, and the
[secure supply chain guidance](https://docs.kubewarden.io/admission-controller/1.38/en/howtos/security-hardening/secure-supply-chain.html)
for policy and image provenance. Configure Lolly's own publisher identity
separately from the Application Collection publisher.

Before enforcement, demonstrate that a qualified release is accepted and an
unsigned, altered or wrongly attributed release is rejected. Test controller
and registry outages, namespace exclusions and a documented recovery route.
Measure admission latency. A broad fail-closed webhook must not block the
operator from restoring the policy service itself.

## Qualify a component host separately

For an existing cluster, inspect its runtime configuration without changing it:

```sh
kubectl --context REVIEWED_CONTEXT version
kubectl --context REVIEWED_CONTEXT get runtimeclasses
kubectl --context REVIEWED_CONTEXT get nodes -o wide
```

Then choose one pinned route using the official
[SpinKube installation guide](https://www.spinkube.dev/docs/install/installing-with-helm/)
or [runwasi quickstart](https://runwasi.dev/getting-started/quickstart.html).
K3s and RKE2 have their own containerd configuration procedures:
[K3s](https://docs.k3s.io/advanced#configuring-containerd) and
[RKE2](https://docs.rke2.io/advanced#configuring-containerd).
Keep the normal OCI handler as the default. Stage a separate runtime handler
and explicit node selection before an application canary; do not replace the
runtime of existing Work, database or render Pods.

Wasm still consumes host memory, CPU and storage. A Kubernetes worker may still
be a billable VM. Benchmark startup, throughput and resource use before claiming
better density or removing capacity from an existing deployment.

## First Lolly component candidate

The pure Rust Skera font subsetting tool is a useful first candidate for a
bounded byte-in/byte-out WIT wrapper. Its current browser build targets
`wasm32-unknown-unknown`; it is not a WASI component. The wrapper needs a
reproducible component build, valid and malformed font tests, output parity,
resource bounds and cross-runtime tests before publication.

Start without filesystem, network or environment access. Grant each capability
only when an interface and its limits are defined. Keep the current worker as
the rollback path. Node, native image codecs, PostgreSQL and Chromium retain
their qualified container deployments until their own adaptations are tested.

The implementation order is: compatibility record and reproducible component;
isolated Kubewarden audit; Skera parity; one bounded worker canary; then supported
Helm/runtime references, lifecycle observability and application update docs.
See [platform deployment](platform-deployment.md) for the current supported
installation and [cloud deployment](cloud-deployment.md) for data recovery and
cutover boundaries.
