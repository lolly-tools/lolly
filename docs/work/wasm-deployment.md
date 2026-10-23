# WebAssembly and Kubewarden choices

You do not need WebAssembly to run Lolly Work. Every supported install uses ordinary
OCI containers, and a home or YunoHost server needs neither Kubernetes nor a Wasm
controller. This page is for two readers who want to go further: a Rancher platform team
evaluating Kubewarden admission policies, and a developer preparing a host for
WebAssembly components.

## What exists today

| Role | Approach to use | What Lolly provides now |
|---|---|---|
| Kubernetes admission policy | Rancher-managed Kubewarden, with signed policies distributed as OCI artifacts | Evaluation guidance. Lolly installs no controller and enforces no policy |
| Portable application tool | The WebAssembly Component Model, WIT interfaces and a pinned WASI version | Not built. The browser Wasm files Lolly ships today are not deployable WASI components |
| Component hosting on Kubernetes | A qualified SpinKube install, or a containerd and runwasi handler with an explicit RuntimeClass and node selection | A platform reference only; the Work chart has no Wasm RuntimeClass setting |
| Component hosting on a small Linux machine | A bounded host worker with explicit capabilities | Not built |

Kubewarden evaluates Kubernetes admission requests. It does not run the Work server,
PostgreSQL or the browser render worker, so keep the policy decision separate from the
application runtime decision.

## Evaluate Kubewarden

Use a separate rehearsal cluster, or narrowly chosen rehearsal namespaces, and follow
your platform team's reviewed Kubewarden installation. A Lolly application release never
installs an admission webhook as a side effect.

Start in audit mode, with curated image verification policies:

- the [Application Collection verification guide](https://docs.kubewarden.io/admission-controller/1.38/en/howtos/application-collection/01-verify-images.html)
  for selected dependency images;
- the [secure supply chain guidance](https://docs.kubewarden.io/admission-controller/1.38/en/howtos/security-hardening/secure-supply-chain.html)
  for policy and image provenance;
- Lolly's own publisher identity, configured separately from the Application Collection
  publisher.

Before you enforce anything, show that a qualified release is accepted and that an
unsigned, altered or wrongly attributed release is rejected. Test controller and
registry outages, namespace exclusions and a written recovery route, and measure the
admission latency. A broad webhook that fails closed must not stop the operator from
restoring the policy service itself.

## Prepare a component host

For an existing cluster, read its runtime configuration first, without changing
anything:

```sh
kubectl --context REVIEWED_CONTEXT version
kubectl --context REVIEWED_CONTEXT get runtimeclasses
kubectl --context REVIEWED_CONTEXT get nodes -o wide
```

Then choose one pinned route, using the official
[SpinKube installation guide](https://www.spinkube.dev/docs/install/installing-with-helm/)
or the [runwasi quickstart](https://runwasi.dev/getting-started/quickstart.html). K3s and
RKE2 each configure containerd their own way:
[K3s](https://docs.k3s.io/advanced#configuring-containerd) and
[RKE2](https://docs.rke2.io/advanced#configuring-containerd). Keep the normal OCI handler
as the default. Stage a separate runtime handler and explicit node selection before any
application canary, and do not replace the runtime of existing Work, database or render
pods.

Wasm still uses host memory, CPU and storage, and a Kubernetes worker may still be a
billable VM. Benchmark start-up, throughput and resource use before you claim better
density or remove capacity from an existing deployment.

## Record what you qualified

Standards and runtimes move quickly, so pin versions and write them down. As of
2026-10-07, [WASI 0.3 is stable](https://wasi.dev/releases), with async support described
in the [0.3 release guide](https://wasi.dev/releases/wasi-p3). Keep WASI 0.2 compatibility
where your toolchain still uses that version: a stable 0.x release is not a finished
WASI 1.0. Do not
assume SQL, key-value, TLS or telemetry interfaces exist on every component host.

Record the runtime inside the shim you choose, too. The released
[runwasi Wasmtime shim 0.6.1](https://github.com/containerd/runwasi/blob/containerd-shim-wasmtime/v0.6.1/Cargo.toml)
uses Wasmtime 36.0.10, while the current WASI guidance names Wasmtime 46 or newer for
final 0.3 support, and upgrading a standalone Wasmtime binary does not upgrade the shim.
SpinKube has its own
[compatibility matrix](https://www.spinkube.dev/docs/install/compatibility-matrices/).

A platform qualification record should list:

- the SLES or Leap version, architecture, K3s or RKE2 version and containerd version;
- controller and chart versions, the runtime handler and the embedded runtime version;
- the OCI artifact digest, signature identity, provenance, SBOM and WIT imports;
- the supported WASI interface versions and generated bindings;
- explicit filesystem, network and environment capabilities;
- measured memory, execution deadline, cancellation and concurrency limits;
- tests for malformed input, tenant isolation, restart, drain and rollback.

SUSE image trust stays useful for host services and dependencies, but a generic Wasm
component is not automatically an Application Collection artifact or a Rancher-supported
runtime. Check the actual support matrix of the product you choose.

## A first component, when one is built

No Lolly WASI component exists yet. The pure Rust Skera font subsetter is the most likely
first candidate: a bounded wrapper with bytes in and bytes out. Its current browser build
targets `wasm32-unknown-unknown` and is not a WASI component, so a wrapper would need a
reproducible component build, valid and malformed font tests, output parity, resource
limits and tests across runtimes before publication. It would start with no filesystem,
network or environment access, and the current worker would stay as the way back. Node,
native image codecs, PostgreSQL and Chromium keep their qualified container deployments.

For today's supported installation, see [Install on Kubernetes](platform-deployment.md);
for data recovery, see [Run Lolly Work on UpCloud or Evroc](cloud-deployment.md#move-a-postgresql-database).
