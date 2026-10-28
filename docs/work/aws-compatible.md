# Run Work on AWS or MulgaDC Spinifex

Lolly Work runs on Amazon Web Services and on clouds that offer the same APIs, such as
[MulgaDC Spinifex](https://mulgadc.com), a private cloud you run on your own hardware, in
your own data centre or at the edge. The same AWS command line tool, Terraform or Packer
files and Kubernetes tools work on both. On Spinifex you point them at its endpoints instead
of Amazon's.

> **Review draft.** This guide records two test runs on a Spinifex sandbox with AWS CLI
> v2.38: a full run on 26 and 27 October 2026, and a re-run on the afternoon of 27 October
> with current Lolly Work, a load balancer and a render load test. MulgaDC then fixed most of
> the reported issues and updated the sandbox, and on 28 October each
> [known issue](#known-issues) was checked again in a new account. The four shapes were not
> run again. Re-test each workaround on your release. The steps are being reviewed with
> MulgaDC.

## Choose a shape

All four shapes passed the same acceptance on Spinifex in both runs: the first owner signs
in, members see the tool catalogue, a project is created, renders finish with their
evidence, and the instance comes back after a restart.

| Shape | What runs where | Choose it when |
|---|---|---|
| **One VM** | An EC2 virtual machine runs the [ready-made package](ready-made-package.md): Work, PostgreSQL, the web app and Caddy in Docker Compose | You want the fewest moving parts |
| **One VM with managed services** | The same VM, with the database on RDS PostgreSQL and files on S3 | You want database backups and file storage handled by the cloud |
| **Kubernetes** | The [Work chart](platform-deployment.md) on an EKS cluster, with RDS and S3 | You already run Kubernetes, or want render workers that scale |
| **Lolly appliance** (preview) | openSUSE Leap 16.1 Immutable with K3s, Work and its own PostgreSQL, imported as your own machine image | You want a host that updates itself in snapshots and rolls back |

Render output was byte-for-byte identical between the Kubernetes and appliance runs, and
between the two VM shapes, although each pair ran different Work builds.

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

Set the region explicitly in every tool and configuration file. On the sandbox, in both runs
and again on 28 October, a virtual machine's metadata service reported its availability zone
(`us-west-1-az2`) as its region, so SDKs that read the region from the machine picked the
wrong one. MulgaDC's fix is due in Spinifex v1.24.0.

Certificates on Spinifex services (the database, the registry) are signed by the
installation's own certificate authority. Inside a Spinifex virtual machine, download that
certificate from the metadata service:

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
   inside containers stall. On 28 October, a 150 MB download over HTTPS finished in 9 seconds
   on the virtual machine itself, stalled with nothing received inside a container at Docker's
   default, and finished in 14 seconds in a container on a network with an MTU of 1442.
   MulgaDC's fix (gateway MTU and TCP MSS clamping) was merged but did not yet apply on the
   sandbox.
   [Hosts on a network with an MTU below 1500](ready-made-package.md) has the setting.
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

Leave out `--publicly-accessible`. Spinifex refuses the flag, because the database endpoint is
a private address in the VPC. In the re-run the database was available about four minutes
after the request.

Work connects with full certificate verification. Put the Spinifex certificate authority
where the server container can read the file, and set the connection to verify the host name:

```text
DATABASE_URL=postgres://lollyadmin:<password>@<database endpoint>:5432/lolly?sslmode=verify-full
NODE_EXTRA_CA_CERTS=/app/spinifex-ca.pem
```

In the first run, Work applied all 64 migrations on the managed database over TLS 1.3.

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
v1.21, drop an object's content type and metadata. Work checks the store when it starts and
logs what it found. On the sandbox, before MulgaDC's update, the log read:

```text
[lolly-work] s3 blobs: the store drops content types and metadata; keeping them in .lolly-meta/ records beside each blob
```

Work then keeps that information in small records of its own, so uploaded images still
display: in the re-run, uploaded PNG and SVG files came back byte for byte with their own
content types. A store that keeps metadata logs `the store keeps content types and metadata`
instead. On 28 October the updated sandbox kept an object's content type and its own metadata,
so Work would no longer need the records there.
[Stores that drop object metadata](configuration.md#blobs) explains the records.

## Put a load balancer in front

An Application Load Balancer can end HTTPS for Work with a certificate from ACM. The re-run
put one in front of **One VM with managed services**.

1. **Certificate.** Import your certificate, its key and its chain into ACM. On the sandbox,
   `aws acm request-certificate --validation-method DNS` first stayed in `PENDING_VALIDATION`
   with an empty validation record, and on 28 October refused the request with `no tenant
   CA`, so import a certificate instead:

   ```bash
   aws acm import-certificate --certificate fileb://work.crt \
     --private-key fileb://work.key --certificate-chain fileb://chain.crt
   ```

2. **A plain HTTP port for the load balancer.** In the installation folder, add a site to the
   `Caddyfile` that serves Work over HTTP on its own port, publish that port in `compose.yaml`
   (`- 8080:8080` under the `caddy` service's `ports`), and allow port 8080 into the instance
   only from the load balancer's security group:

   ```text
   :8080 {
     reverse_proxy server:8787
   }
   ```

3. **Load balancer, target group and listener.** A single subnet was accepted on the sandbox.
   Check the target with Work's `/healthz`:

   ```bash
   aws elbv2 create-load-balancer --name lolly-work --type application \
     --scheme internet-facing --subnets "$SUBNET" --security-groups "$LB_SECURITY_GROUP"
   aws elbv2 create-target-group --name lolly-work --protocol HTTP --port 8080 \
     --vpc-id "$VPC" --target-type instance --health-check-path /healthz
   aws elbv2 register-targets --target-group-arn "$TARGET_GROUP" --targets Id="$INSTANCE",Port=8080
   aws elbv2 create-listener --load-balancer-arn "$LOAD_BALANCER" --protocol HTTPS --port 443 \
     --certificates CertificateArn="$CERTIFICATE" \
     --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP"
   ```

4. **The address.** Point your domain at the load balancer's DNS name, and use that domain as
   Work's domain when you write the installation folder.

In the re-run the listener served TLS 1.3 and HTTP/2 with the imported certificate, and the
target was healthy within seconds. Live collaboration worked through the load balancer: two
people joined one session over WebSocket, both with an HTTP/1.1 upgrade and over HTTP/2, an
edit reached the other seat in 173 ms (median of 20, measured from outside the cloud), and
the sockets stayed open through 90 idle seconds.

**Client addresses.** Spinifex's load balancer adds no `X-Forwarded-For` or
`X-Forwarded-Proto` header, and passes on an `X-Forwarded-For` header that the client sent.
A check on 28 October, through a new load balancer, found the same.
Work therefore sees every request arrive from the load balancer's address, and its
per-address [rate limits](configuration.md#ratelimit) apply to all users together: by
default 10 sign-in requests, refilled at one every five seconds, and 120 automation
requests, refilled at two a second, shared by everyone. Do not raise `trustedProxyHops` to
reach past the load balancer, because a client could then choose its own address. Until the
load balancer forwards client addresses, either size the `auth` and `automation` buckets for
your whole user base, knowing that a larger `auth` bucket also allows more password guesses,
or let people reach Caddy directly. On AWS, the load balancer adds the client's address to
`X-Forwarded-For`; with Caddy between the load balancer and Work, add the VPC range to
Caddy's `trusted_proxies` and set `trustedProxyHops` to `2`.

## Render capacity

The re-run sent 300 durable render jobs through the load balancer from outside the cloud:
one-page SVG and PNG renders of tools without hooks, on a 4 vCPU, 8 GiB instance running the
ready-made package with RDS and S3, and the server's own renderer (no Chromium worker). Each
job was submitted, polled until done and its output downloaded. The automation bucket was
raised for the test, because every request came from one address.

| Jobs at once | Renders per second | Time per job, median | Time per job, 95th percentile | Queue and render on the server, 95th percentile | Server CPU |
|---|---|---|---|---|---|
| 10 | 13.4 | 610 ms | 856 ms | 251 ms | about 1.2 cores |
| 25 | 17.9 | 1,249 ms | 1,783 ms | 1,025 ms | about 1.6 cores |

All 600 jobs succeeded. With the default buckets, the same 300 jobs from one address used up
the automation bucket within seconds and then ran at about 0.4 renders a second, limited by
the rate limit rather than the server.

## Kubernetes

1. **Create the cluster.** An EKS cluster on Spinifex is K3s underneath (K3s 1.32 on Alpine
   Linux in both runs). Create the cluster and a node group in the usual way, with two roles:
   one for the cluster and one for the nodes, which needs `AmazonEKSWorkerNodePolicy`,
   `AmazonEKS_CNI_Policy` and `AmazonEC2ContainerRegistryReadOnly`. The node group's role
   flag is `--node-role`:

   ```bash
   aws eks create-cluster --name lolly --kubernetes-version 1.32 \
     --role-arn "$CLUSTER_ROLE" --access-config authenticationMode=API \
     --resources-vpc-config subnetIds="$SUBNET",endpointPublicAccess=true
   aws eks create-nodegroup --cluster-name lolly --nodegroup-name lolly-nodes \
     --node-role "$NODE_ROLE" --subnets "$SUBNET"
   aws eks update-kubeconfig --name lolly
   ```

   In the first run the cluster was active in about 90 seconds and a two-node group in about
   90 more. `kubectl` authenticates through `aws eks get-token`, as on AWS.
2. **Let the nodes reach the database.** Allow port 5432 into the database's security group
   from the node group's security group. Without that rule the chart's migration Job times
   out.
3. **Choose where images come from.** Nodes with internet access pull Work's signed images
   from GitHub's registry by digest; nothing more is needed. To use your own ECR registry,
   copy each image together with its signature, then refer to it by the registry's internal
   name, `<account>.dkr.ecr.<region>.services.internal/<repository>@<digest>`:

   ```bash
   oras cp -r ghcr.io/lolly-tools/lolly-work-server@<digest> <repositoryUri>:<tag>
   cosign verify --certificate-oidc-issuer https://token.actions.githubusercontent.com \
     --certificate-identity-regexp '^https://github\.com/lolly-tools/lolly-work/\.github/workflows/release\.yml@refs/tags/v' \
     <repositoryUri>@<digest>
   ```

   `oras cp -r` copies the signature with the image, so `cosign verify` passes against your
   registry; `cosign copy` does not copy the current signature format, on AWS ECR either. On
   28 October the copy of the Work 1.1.2 server image took 10 seconds and verified. The
   internal name pulled from an EKS node on that date; the name in earlier releases,
   `.spinifex.internal`, no longer resolved. The `repositoryUri` that ECR returns is not
   reliable for the nodes: the address in it rotates between four gateway addresses, and on 28
   October the nodes still trusted one of them, while pulls through the other three failed
   certificate verification. MulgaDC's fix was merged but did not yet apply on the sandbox.
4. **Install the chart.** Follow [Install on Kubernetes](platform-deployment.md) with an
   external database. Mount the Spinifex certificate authority as described in the chart's
   [PostgreSQL certificate verification](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/POSTGRES-TLS.md),
   and add the `blobs` block from **One VM with managed services** to the instance
   configuration. Production mode needs a catalogue generation; see
   [what production mode needs from a pack](configuration.md#instance). In the re-run,
   production mode with the image's demo pack, `catalogPublicationGeneration: 1` and a
   catalogue signing key in `LW_CATALOG_SIGNING_KEY` was ready 35 seconds after
   `helm install` started.
5. **Check readiness.** `kubectl -n lolly get pods` should show Work ready. If Work is not
   ready, `/readyz` answers with `checks` that say which condition is holding readiness back.

## Lolly appliance (preview)

The [Lolly appliance](https://github.com/lolly-tools/lolly-work/tree/main/deploy/appliance)
is a disk image that boots into a working Work: openSUSE Leap 16.1 Immutable, K3s, Work in
production mode, its own PostgreSQL, HTTPS with the machine's own certificate and Cockpit for
the host. It is built on the Leap 16.1 release candidate. Spinifex does not offer
`ImportImage` or `ImportSnapshot`, so bring the image in through a volume and a snapshot:

1. **Get the x86_64 raw disk.** Build `lolly-appliance-<version>-x86_64.raw` with the
   appliance's `build.sh` on an x86_64 Linux host, or take the compressed raw disk from
   Work's CI build, and check it against `SHA256SUMS`.
2. **Write the disk onto a new 20 GiB volume** from any Linux instance in the same zone. On a
   new volume, `conv=sparse` skips the empty blocks; in the re-run that wrote the disk in under
   a minute, where writing every block ran at about 30 MB/s:

   ```bash
   zstd -dc lolly-appliance-<version>-x86_64.raw.zst | dd of=/dev/vdb bs=4M conv=sparse,fsync
   ```

3. **Configure the first boot.** The appliance reads a Combustion script (your SSH key and
   options such as the owner's email) from its own small partition labelled `ignition`. On the
   sandbox a configuration volume attached at launch was not seen, while this partition was.
   With mtools, on the written volume:

   ```bash
   mmd -i /dev/vdb3 ::combustion
   mcopy -i /dev/vdb3 script ::combustion/script
   ```

   [Configure the first boot](https://github.com/lolly-tools/lolly-work/tree/main/deploy/appliance#configure-the-first-boot)
   has an example script and the options.
4. **Snapshot, register and launch.** Detach the volume, snapshot the volume, and register the
   snapshot with `aws ec2 register-image --boot-mode uefi --architecture x86_64
   --root-device-name /dev/sda1` and the snapshot as the root device. Leave out
   `--ena-support`, which `register-image` refuses with a generic `InvalidParameterValue`. On
   28 October the sandbox accepted `--virtualization-type hvm` and a volume size, which it had
   refused before; you can also set the disk size when you launch, for example 40 GB on a
   `c6a.large`.
5. **Sign in.** `lolly-appliance owner-link` over SSH prints the owner's one-time setup link.
   Cockpit answers only from local networks, so reach port 9090 through an SSH tunnel.

In the re-run, root SSH answered 61 seconds after launch and Work's `/readyz` about 150
seconds after launch (138 seconds after the kernel started). After a reboot Work was ready 91
seconds after the kernel started. The machine used 1.5 GiB of its 3.8 GiB of memory. K3s set
its container network's MTU to 1392 by itself, so the appliance needs no MTU setting. The
first run built the same stack by hand from the plain Leap image and Work's
[K3s kit](https://github.com/lolly-tools/lolly-work/tree/main/deploy/suse); the appliance
now does those steps at first boot.

## Known issues

Each item was found on the sandbox, checked again in the re-run, and checked once more on 28
October after MulgaDC updated the sandbox. Re-test on your Spinifex release before you rely on
a workaround.

| Issue | What you see | Workaround | Report |
|---|---|---|---|
| Container MTU | Large downloads inside Docker containers stall | Set Docker's MTU to 1442 | [spinifex#1291](https://github.com/mulgadc/spinifex/issues/1291): fix merged, still seen on 28 October |
| ECR address not trusted by nodes | Pods fail to pull from three of the four addresses `repositoryUri` returns, with a certificate error | Use the `<account>.dkr.ecr.<region>.services.internal` name | [spinifex#1287](https://github.com/mulgadc/spinifex/issues/1287): fix merged, still seen on 28 October |
| Metadata reports the zone as the region | SDKs on a VM use the wrong region | Set the region explicitly | [spinifex#1286](https://github.com/mulgadc/spinifex/issues/1286): fix due in v1.24.0 |
| `register-image --ena-support` | A generic `InvalidParameterValue` | Leave the flag out | [spinifex#1322](https://github.com/mulgadc/spinifex/issues/1322) |
| Load balancer forwards no client address | Work sees every user at the load balancer's address, so rate limits are shared | Size the rate-limit buckets for all users, or skip the load balancer | [spinifex#1321](https://github.com/mulgadc/spinifex/issues/1321) |
| S3 drops stored headers such as `Cache-Control` | None in Work, which serves files itself | Not needed | [predastore#194](https://github.com/mulgadc/predastore/issues/194): fix due in the next release |
| Bucket CORS | Not needed by Work today | None | [predastore#193](https://github.com/mulgadc/predastore/issues/193) |

Fixed, and confirmed on the sandbox on 28 October:

| Issue | Now | Report |
|---|---|---|
| Image signatures could not be copied into ECR | `oras cp -r` copies them, and `cosign verify` passes against ECR | [spinifex#1288](https://github.com/mulgadc/spinifex/issues/1288) |
| Snapshots could not be deleted, and their volumes then counted as in use | A snapshot and then its volume delete normally | [spinifex#1292](https://github.com/mulgadc/spinifex/issues/1292) |
| Errors lost their detail | A refused `create-db-instance` says which value is wrong | [spinifex#1289](https://github.com/mulgadc/spinifex/issues/1289) |
| `GetUser` without a user name failed | It returns the calling user | [spinifex#1275](https://github.com/mulgadc/spinifex/issues/1275) |
| A dry-run `CopyImage` created an image | It answers `DryRunOperation` and creates nothing | [spinifex#1293](https://github.com/mulgadc/spinifex/issues/1293) |
| A missing EKS node group was reported as another error | `ResourceNotFoundException` | [spinifex#1290](https://github.com/mulgadc/spinifex/issues/1290) |
| S3 dropped content type and metadata | Both are kept | Fixed in Predastore v1.21 |

## Not tested yet

The Chromium render worker and render workers scaling under load, several Work replicas,
restoring the managed database from a backup, certificates issued by ACM, network load
balancers, GPU capacity, and the four shapes end to end on the sandbox as MulgaDC updated it
on 28 October.
