# Public service drain

The standalone MCP and certificate servers reject new work during a drain while
waiting for accepted handler Promises and admission writes to finish. Disconnecting
a client does not release its handler count. Browser jobs remain visible as active
or queued, and MCP flushes remaining process CPU usage once after accepted work
finishes. The Redis Lua scripts, key formats, counters and expiry behavior remain
unchanged.

This control is for infrastructure operators. Document agent invitations do not
grant access. The private Work server and its document MCP are separate processes;
draining these public servers does not drain private workspace collaboration.

## Enable the private control listener

Give each process a fresh, separate `LOLLY_OPERATOR_DRAIN_TOKEN` through a managed
Secret reference or a protected runtime environment file. Generate at least 32
random bytes; the value must use 32–256 ASCII letters, digits, `_` or `-`. It must
not reuse an application, signing or Redis admission credential. Do not put it in
Helm values, command arguments, a build image or logs.

With the token configured, the server listens on **127.0.0.1:8792 only**. Set
`LOLLY_OPERATOR_DRAIN_PORT` to another port from 1024–65535 when processes share a
network namespace. Configuring a port without a token or failing to bind the
requested listener stops startup. Without a token the control listener is absent;
SIGTERM still starts the same drain.

Keep the control port out of Services, ingress, port forwarding and public proxy
routes. Kubernetes administrators with access to execute commands in the owning
Pod already hold the required infrastructure authority. A sidecar in that Pod
shares its network boundary and must be equally trusted.

Use the chart's `extraEnv` Secret references or an existing service Secret; preserve
all existing keys. Pin a newly qualified image containing this runtime before
changing readiness to `/readyz`. Existing images do not implement that probe.

## Begin and observe

The control API accepts authenticated `POST /begin` and `GET /status`, with no body
or query string. `/begin` is one-way and idempotent. There is no resume or reset
endpoint. Authentication uses fixed-length hashes and Node's constant-time
comparison. The public HTTP listener exposes neither control route.

Run commands inside the **exact owning container**, after verifying its Deployment,
ReplicaSet, Pod UID and image digest. For lolly.ing or lolly.tools, first read the
current private production handoff and run its mandatory target preflight
immediately before beginning a drain. Serialize resource changes with other
operators; a namespace or host name containing `candidate` is not permission to
replace production.

This generic example reads the token inside the container, never in an argument:

```sh
kubectl --context <reviewed-context> -n <public-namespace> \
  exec <owning-pod> -c <mcp-or-ca-container> -- node --input-type=module -e '
const port = process.env.LOLLY_OPERATOR_DRAIN_PORT || "8792";
const response = await fetch(`http://127.0.0.1:${port}/begin`, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.LOLLY_OPERATOR_DRAIN_TOKEN}` },
  signal: AbortSignal.timeout(5000)
});
if (!response.ok) throw new Error("Operator drain request refused");
console.log(JSON.stringify(await response.json()));
'
```

For observation, use the same bounded command with `/status` and method `GET`.
The returned JSON contains counts and timestamps, never credentials, caller
identities or document content. Public `/readyz` becomes 503 immediately; `/healthz`
and the CA's existing configuration health route remain available. New ordinary
requests and new public relay WebSocket upgrades receive 503. Existing relay
connections are closed only after accepted HTTP work and accounting finish.

Proceed only when `settled` is true: accepted handlers, active/queued jobs and
pending writes are all zero, final accounting has finished, and all handler,
diagnostic and failed-or-ambiguous write counts are zero. `workFinished` alone is
insufficient. A Redis timeout or lost acknowledgement can follow a committed
write; its sticky diagnostic blocks a successful drain even when the response
handler historically swallows that error. Preserve the fence and reconcile the
durable counters rather than retrying an ambiguous increment.

## Shutdown and counter migration

SIGTERM/SIGINT starts the drain and waits up to 300 seconds, then closes the relay,
browser and listeners only after a settled result. A timeout or failed accounting
does not clear counts or report successful completion. The charts allow 330 seconds
before Kubernetes may forcibly terminate a Pod. This allowance is not proof that
every request finishes: provider calls can outlast it. Operators must observe a
settled result before a planned replacement or accounting-store transfer.

The process diagnostics are not durable across a forced kill or restart. Retain
the reviewed receipt and writer fence outside the process; a new healthy Pod is
not evidence that an old Pod's ambiguous writes were resolved. Service admission
may be reopened only after that reconciliation. A successful drain covers this
process, not historical preview deployments or other producers using the same
Redis credentials. Fence every producer before taking the final migration
snapshot. Preserve counter high-water values and absolute expiry times; never
reset the current day's budget or extend rate windows during a transfer.

Legacy images have no observable drain and cannot provide this proof. A separately
reviewed first transition may close the current UTC day's public metered budget
without reducing counters or resetting expiry, fence and stop every old writer,
then migrate the final source counters and expiries. This deliberately keeps those
public metered paths closed until the next UTC day. It is conservative admission
protection, **not** an exact retrospective usage or graceful-completion claim.
Pod network transmission does not bound logical response bytes charged before a
client disconnect. Private Work collaboration and static public content should
remain available and must pass their own acceptance checks.
