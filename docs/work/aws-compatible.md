# Run Work on AWS or MulgaDC Spinifex

Lolly Work runs on Amazon Web Services and on clouds that offer the same APIs, such as
[MulgaDC Spinifex](https://mulgadc.com), a private cloud you run on your own hardware, in
your own data centre or at the edge. The same AWS command line tool, Terraform or Packer
files and Kubernetes tools work on both. On Spinifex you point them at its endpoints instead
of Amazon's.

> **Review draft.** This guide records a full test run on a Spinifex sandbox on 26 and 27
> October 2026, with AWS CLI v2.38. The sandbox ran a Spinifex release older than v1.21, so
> some of the [known issues](#known-issues) may already be fixed in current releases. The
> steps are being reviewed with MulgaDC and re-run on a current release.

## Choose a shape

All four shapes passed the same acceptance on Spinifex: the first owner signs in, members
see the tool catalogue, a project is created, renders finish with their evidence, and the
instance comes back after a restart.

| Shape | What runs where | Choose it when |
|---|---|---|
| **One VM** | An EC2 virtual machine runs the [ready-made package](ready-made-package.md): Work, PostgreSQL, the web app and Caddy in Docker Compose | You want the fewest moving parts |
| **One VM with managed services** | The same VM, with the database on RDS PostgreSQL and files on S3 | You want database backups and file storage handled by the cloud |
| **Kubernetes** | The [Work chart](platform-deployment.md) on an EKS cluster, with RDS and S3 | You already run Kubernetes, or want render workers that scale |
| **Immutable appliance** (preview) | openSUSE Leap 16.1 Immutable with K3s and Work, as your own machine image | You want a host that updates itself in snapshots and rolls back |

Render output was byte-for-byte identical between the Kubernetes and appliance runs.

## Point the AWS tools at Spinifex

On AWS, skip this section: the tools find Amazon's endpoints themselves.

Spinifex serves its compute, identity, database, Kubernetes and registry APIs from one
endpoint and object storage (S3) from another. Add a profile to `~/.aws/config`, with your
own region and your Spinifex hostnames in place of the sandbox's:

```ini
[profile spinifex]
region = us-west-1
endpoint_url = https://api.spx3.com
services = spinifex-services
s3 =
  addressing_style = path

[services spinifex-services]
s3 =
  endpoint_url = https://s3.spx3.com
```

Keep the access key in `~/.aws/credentials` under the same profile name, then check both
endpoints:

```bash
export AWS_PROFILE=spinifex
aws sts get-caller-identity
aws s3 ls
```

Set the region explicitly in every tool and configuration file. On the sandbox, a virtual
machine's metadata service reported its availability zone (`us-west-1-az2`) as its region, so
SDKs that read the region from the machine picked the wrong one.

Certificates on Spinifex services (the database, the registry) are signed by the
installation's own certificate authority. Inside a Spinifex virtual machine, download it
from the metadata service:

```bash
curl -fsS http://169.254.169.254/spinifex/ca.pem -o spinifex-ca.pem
```

Compare its fingerprint with the one your Spinifex administrator publishes before you trust
the file.

## One VM

1. Launch a Debian 13 or Ubuntu 24.04 instance with at least 2 vCPUs, 4 GiB of memory and
   40 GB of disk. Allow TCP 80 and TCP and UDP 443 in its security group, and SSH only from
   your administrators' addresses.
2. Install Docker. **Before the first start, set Docker's MTU to the instance's.** Spinifex
   virtual machines use an MTU of 1442, and Docker's default of 1500 makes large downloads
   inside containers stall. [Hosts on a network with an MTU below 1500](ready-made-package.md)
   has the setting.
3. Follow [Install the ready-made package](ready-made-package.md) from **Write the
   installation folder** onwards.

## One VM with managed services

Start from **One VM**, then move the database and files out.

**Database.** Create a PostgreSQL 18 instance in the same network as the VM, and allow port
5432 from the VM's security group only:

```bash
aws rds create-db-instance --db-instance-identifier lolly-work \
  --engine postgres --engine-version 18 --db-instance-class db.t3.small \
  --allocated-storage 20 --master-username lollyadmin \
  --master-user-password "$DB_PASSWORD" \
  --vpc-security-group-ids "$DB_SECURITY_GROUP"
```

Leave out `--publicly-accessible`: Spinifex refuses it with a generic error.

Work connects with full certificate verification. Put the Spinifex certificate authority
where the server container can read it, and set the connection to verify the host name:

```text
DATABASE_URL=postgres://lollyadmin:<password>@<database endpoint>:5432/lolly?sslmode=verify-full
NODE_EXTRA_CA_CERTS=/app/spinifex-ca.pem
```

In the test run, Work applied all 64 migrations on the managed database over TLS 1.3.

**Files.** Create a bucket and a user that can reach that bucket only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject",
                 "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": "arn:aws:s3:::<bucket>/*" },
    { "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:ListBucketMultipartUploads", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::<bucket>" }
  ]
}
```

Give Work the bucket in `instance.json` and the user's key as the secret
`LW_BLOBS_S3_CREDENTIAL`, written `<access key id>:<secret access key>`:

```json
"blobs": {
  "driver": "s3",
  "s3": { "bucket": "<bucket>", "region": "us-west-1",
          "endpoint": "https://s3.spx3.com", "prefix": "lolly-work" }
}
```

On AWS, leave out `endpoint`. Some S3-compatible stores, including Spinifex releases before
v1.21, drop an object's content type and metadata. Work detects this when it starts and keeps
that information in small records of its own, so uploaded images still display;
[stores that drop object metadata](configuration.md#blobs) explains how.

## Kubernetes

1. **Create the cluster.** An EKS cluster on Spinifex is K3s underneath. Create it and a node
   group in the usual way, with two roles: one for the cluster and one for the nodes, which
   needs `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy` and
   `AmazonEC2ContainerRegistryReadOnly`. The node group's role flag is `--node-role`:

   ```bash
   aws eks create-cluster --name lolly --kubernetes-version 1.32 \
     --role-arn "$CLUSTER_ROLE" --access-config authenticationMode=API \
     --resources-vpc-config subnetIds="$SUBNET",endpointPublicAccess=true
   aws eks create-nodegroup --cluster-name lolly --nodegroup-name lolly-nodes \
     --node-role "$NODE_ROLE" --subnets "$SUBNET"
   aws eks update-kubeconfig --name lolly
   ```

   On the sandbox the cluster was active in about 90 seconds and a two-node group in about 90
   more. `kubectl` authenticates through `aws eks get-token`, as on AWS.
2. **Let the nodes reach the database.** Allow port 5432 into the database's security group
   from the node group's security group. Without that rule the chart's migration Job times
   out.
3. **Choose where images come from.** Nodes with internet access pull Work's signed images
   from GitHub's registry by digest; nothing more is needed. To use your own ECR registry,
   copy the images by digest and refer to them by the registry's internal name,
   `<account>.dkr.ecr.<region>.spinifex.internal/<repository>@<digest>`. The `repositoryUri`
   that ECR returns is not trusted by the nodes yet. Image signatures cannot be copied into
   ECR yet, so verify each image's signature at GitHub's registry before you copy the image.
4. **Install the chart.** Follow [Install on Kubernetes](platform-deployment.md) with an
   external database. Mount the Spinifex certificate authority as described in the chart's
   [PostgreSQL certificate verification](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/POSTGRES-TLS.md),
   and add the `blobs` block from **One VM with managed services** to the instance
   configuration. Production mode needs a catalogue generation; see
   [what production mode needs from a pack](configuration.md#instance).
5. **Check readiness.** `kubectl -n lolly get pods` should show Work ready. If it is not,
   `/readyz` answers with `checks` that say which condition is holding it back.

## Immutable appliance (preview)

A Lolly appliance image is in progress, and once released this section becomes one import
step. Until then, the test run proves each part:

1. **Bring in the image.** Spinifex does not offer `ImportImage` or `ImportSnapshot`. From any
   Linux instance, write the openSUSE Leap 16.1 Immutable raw image onto a new volume,
   snapshot the volume and register the snapshot:
   `aws ec2 register-image --boot-mode uefi --architecture x86_64` with the snapshot as the
   root device.
2. **Configure the first boot.** Leap Immutable reads Combustion or Ignition at first boot. On
   the sandbox, a configuration volume attached at launch was not seen, while the same
   configuration on a partition of the boot disk was. Put the `combustion/script` (SSH key,
   host name) on a partition labelled `ignition` on the boot volume before you take the snapshot.
3. **Install K3s.** Use Work's [K3s kit](https://github.com/lolly-tools/lolly-work/tree/main/deploy/suse),
   which handles transactional hosts: the first run stages the SELinux policy in a new
   snapshot and asks for a reboot, and the second run installs K3s.
4. **Deploy Work.** Place a `HelmChart` manifest for the Work chart in
   `/var/lib/rancher/k3s/server/manifests/`, and K3s installs the chart. On the sandbox, Work was
   ready 80 seconds after the manifest was written, and the whole node used about 1.2 GB of memory with
   SELinux enforcing.

## Known issues

Each item was found in the test run and reported to MulgaDC. Re-test on your Spinifex release
before you rely on a workaround.

| Issue | What you see | Workaround | Report |
|---|---|---|---|
| Container MTU | Large downloads inside Docker containers stall | Set Docker's MTU to 1442 | [spinifex#1291](https://github.com/mulgadc/spinifex/issues/1291) |
| ECR address not trusted by nodes | Pods fail to pull from ECR with a certificate error | Use the `<account>.dkr.ecr.<region>.spinifex.internal` name | [spinifex#1287](https://github.com/mulgadc/spinifex/issues/1287) |
| Image signatures cannot be copied into ECR | `cosign copy` fails | Verify at GitHub's registry, then copy by digest | [spinifex#1288](https://github.com/mulgadc/spinifex/issues/1288) |
| Metadata reports the zone as the region | SDKs on a VM use the wrong region | Set the region explicitly | [spinifex#1286](https://github.com/mulgadc/spinifex/issues/1286) |
| Database errors lose their detail | A refused `create-db-instance` gives a generic message | Leave out `--publicly-accessible` | [spinifex#1289](https://github.com/mulgadc/spinifex/issues/1289) |
| Snapshots cannot be deleted | Deleting a snapshot fails, and its volume then counts as in use | Avoid snapshots you will need to remove; ask your Spinifex administrator to clear them | [spinifex#1292](https://github.com/mulgadc/spinifex/issues/1292) |
| S3 drops content type and metadata | None in Work, which keeps its own records | Not needed; fixed in Predastore v1.21 | Fixed upstream |
| Bucket CORS | Not needed by Work today | None | [predastore#193](https://github.com/mulgadc/predastore/issues/193) |

MulgaDC fixed two further reports within hours of filing (`GetUser` without a user name, and
`CopyImage` honouring `--dry-run`); both are in Spinifex v1.23.0.

## Not tested yet

Spinifex load balancers with certificates in front of Work, render workers scaling under
load, several Work replicas, restoring the managed database from a backup, and GPU capacity.
