# Deploy Lolly with your platform team

Lolly Work runs on a conformant Kubernetes cluster with PostgreSQL, your
organization's identity provider and independently recoverable assets. SUSE
Linux Enterprise Server or openSUSE Leap, K3s/RKE2 with Rancher, SUSE BCI images
and Application Collection dependencies are preferred options. An existing
cluster, an external database and another qualified OCI application image remain
supported; a particular cloud API or Collection subscription is not required.

## Choose the guide for your job

| Audience | Start here | Result |
|---|---|---|
| Reader evaluating a deployment | [Deployment shapes](deployment.md) and [installation](install.md#7b-production) | A selected instance boundary, identity and deployment route |
| IT platform operator | [Platform-team workflow](https://github.com/lolly-tools/lolly-work/blob/main/deploy/suse/PLATFORM-TEAMS.md) | Exact host/cluster selection, readiness, storage, Helm installation and recovery acceptance |
| Developer releasing Lolly | [BCI and Podman builds](https://github.com/lolly-tools/lolly-work/blob/main/deploy/suse/PLATFORM-TEAMS.md#developers-build-and-release-with-suse-images) and [application updates](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/APP-UPDATES.md) | Qualified immutable application/shell/pack/worker artifacts and an observed release |

For an existing Rancher-managed K3s/RKE2 cluster, keep your cluster lifecycle and
install the ordinary Work Helm chart with existing Secrets. For a new SLES/Leap
host, the shared Python readiness check can run directly or through your
existing Ansible/Salt tooling. The pinned K3s operator path then stages and
qualifies a new UpCloud/evroc host; it does not adopt an existing instance.
RKE2 host installation follows the platform team's reviewed Rancher or official
RKE2 process. The Work chart is common to both.

From a reviewed source checkout on the exact new host, save the initial gate
receipt privately. This checks the host and never installs a runtime:

```sh
umask 077
sudo python3 -I deploy/suse/host-readiness.py \
  --profile k3s --expect-host lolly-rehearsal > /private/host-readiness.json
```

The [Ansible adapter](https://github.com/lolly-tools/lolly-work/tree/main/deploy/ansible)
and [Salt state](https://github.com/lolly-tools/lolly-work/tree/main/deploy/salt)
run the same gate through your existing fleet configuration. Continue through
the platform-team workflow's provider/network review, pinned K3s installation,
Helm values review and real collaboration/restore acceptance. Existing clusters
use the production Helm guide and their normal cluster lifecycle.

## Cloud and on-premises choices

The repository includes tested OpenTofu/Terraform foundations for
[UpCloud](https://github.com/lolly-tools/lolly-work/blob/main/deploy/upcloud/README.md) and [evroc](https://github.com/lolly-tools/lolly-work/blob/main/deploy/evroc/README.md).
On-premises, OVHcloud, Hetzner, other neocloud/sovereign providers and hyperscaler
public clouds can supply the same VM or Kubernetes interfaces. Those targets
still need their own qualified host image, network, CSI/storage, quotas and
restore evidence; shared interfaces do not establish provider-specific testing.

Keep public shell/MCP/CA services in separate namespaces and credentials from
the private Work instance. Work uses PostgreSQL for durable collaboration, jobs
and optional uploaded-asset bytes. Application Collection PostgreSQL is an
independently managed optional dependency; public admission Redis is a separate
public-service choice. Avoid introducing Redis into Work's PostgreSQL job path.

The [platform-team support table](https://github.com/lolly-tools/lolly-work/blob/main/deploy/suse/PLATFORM-TEAMS.md#support-and-remaining-qualification)
separates implemented automation, actual qualification and reference-only
steps. Rootless Podman image builds are documented; a complete Podman/Quadlet
runtime remains planned until startup, labels, secret handling and recovery are
tested. K3s/RKE2 use their own containerd and do not need a second Podman runtime.

Use the [cloud deployment guide](cloud-deployment.md) for durable-data boundaries,
database migration, public documentation routing and cutover preparation. Keep
the same sign-in, invited collaboration, asset, agent and independent recovery
checks on every deployment target.

For optional Wasm policy or worker hosting, use [WebAssembly and Kubewarden
choices](wasm-deployment.md). These are separately qualified development tracks;
they do not add a controller or runtime requirement to a private installation.
