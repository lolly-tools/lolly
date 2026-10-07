# Public Lolly Helm chart

This chart deploys the static web shell and optional MCP and credential authority
services. It runs on Kubernetes, including K3s and RKE2. The default configuration
keeps two replicas per enabled service. Cluster nodes, ingress, certificates and
image publication are supplied by the operator.

MCP and CA use the [standalone drain runtime](../../services/shared/README.md).
Qualify their image digests before using the chart's `/readyz` readiness probes;
legacy images do not implement this endpoint. The 330-second termination allowance
does not prove unfinished work or accounting has completed. For planned updates,
configure separate runtime Secret references for the loopback operator control
and require a settled receipt before replacing a writer. Do not expose that
control port through a Service or ingress.

Use `profiles/lean.yaml` for one pod per enabled service with CPU, memory and
ephemeral storage budgets. MCP and the credential authority remain opt-in. With
all three enabled, the profile requests 100 millicores, 224 MiB memory and 224 MiB
ephemeral storage. These reservations exclude cluster services, ingress and any
browser or external service. They are scheduling settings, not measured capacity.
A single pod has no replica redundancy. Measure your workload before cutover.

```bash
helm lint deploy/helm -f deploy/helm/profiles/lean.yaml
helm template lolly deploy/helm \
  -f deploy/helm/profiles/lean.yaml -f instance-values.yaml
helm upgrade --install lolly deploy/helm \
  -f deploy/helm/profiles/lean.yaml -f instance-values.yaml
```

Each component accepts `image.repository`, `image.tag` and `image.digest`. An
empty digest preserves the tag setting, which defaults to the chart's app
version. A digest must be `sha256:` followed by 64 lowercase hexadecimal
characters and takes precedence over a tag. Use the digest of the complete
Lolly application image you built and pushed. A SUSE base image alone does not
contain the Lolly application.

```yaml
imagePullSecrets:
  - name: application-registry
web:
  image:
    repository: registry.example.com/team/lolly-web
    digest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

`imagePullSecrets` applies to every enabled component. Provision the named Secret
in the release namespace using your registry credentials. Keep credentials out
of values files and Git. SUSE Application Collection images are pulled from
`dp.apps.rancher.io`; consult its authentication and image instructions before
using those images in custom Lolly builds or separately installed dependencies.

Each component's `tmp.sizeLimit` bounds its disk-backed `/tmp` volume. The web
component also has `cache.sizeLimit` for `/var/cache/nginx`. An empty string keeps
the original unbounded volume behavior. Set positive integer quantities such as
`64Mi` or `1Gi`; negative, zero, fractional and CPU-style quantities are refused.
Pair volume limits with container `resources.requests.ephemeral-storage` and
`resources.limits.ephemeral-storage`, since writable files and logs also consume
node disk. The lean profile includes those settings.

The chart preserves non-root execution, a read-only root filesystem, dropped
capabilities and disabled service account token mounts. CA secrets and MCP
provider configuration still use their existing values and Secret references.
The chart does not deploy Lolly Work, a database, the agent relay, Penpot or model
download services, and has not qualified complete public route parity for
lolly.tools. These components and their authentication, rate limits, backups and
recovery must be qualified before a production migration. See the
[deployment guide](https://lolly.tools/info/operate/deployment.html).
