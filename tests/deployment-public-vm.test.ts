// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const nginx = read('deploy/docker/public.nginx.conf');
const caddy = read('deploy/docker/public.caddy');
const compose = read('deploy/docker/public.compose.yml');
const vercel = JSON.parse(read('vercel.json')) as {
  rewrites: { source: string; destination: string }[];
};

test('public VM preserves every fixed static alias in the public route contract', () => {
  for (const { source, destination } of vercel.rewrites) {
    if (
      !destination.startsWith('/view/') &&
      ![
        '/design',
        '/docs',
        '/agents.md',
        '/llms.txt',
        '/llms-full.txt',
        '/openapi.json',
        '/.well-known/lolly.json',
        '/robots.txt',
      ].includes(source)
    )
      continue;
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const location = nginx.match(new RegExp(`location = ${escaped} \\{([^}]+)\\}`));
    assert.ok(location, `Missing fixed alias ${source}`);
    assert.ok(location[1]?.includes(`try_files ${destination} =404;`), source);
  }
  assert.match(nginx, /location = \/t\/layout-studio \{ return 308 \/design\$is_args\$args; \}/);
  assert.match(
    nginx,
    /location = \/sitemap\.xml \{ return 308 \/info\/sitemap\.xml\$is_args\$args; \}/
  );
});

test('public VM refuses missing reserved static files and hides operator metadata', () => {
  for (const prefix of ['info', 'catalog', 'icons', 't', 'view']) {
    const location = nginx.match(new RegExp(`location /${prefix}/ \\{([^}]+)\\}`));
    assert.ok(location?.[1]?.includes('=404;'), prefix);
    assert.ok(!location?.[1]?.includes('/index.html;'), prefix);
  }
  assert.match(nginx, /location ~ \(\^\|\/\)\\\. \{ return 404; \}/);
  assert.match(nginx, /location \/docs\/ \{ return 404; \}/);
  assert.match(nginx, /location \/\.well-known\/ \{ return 404; \}/);
  assert.match(caddy, /@reserved path \/api \/api\/\* \/live \/live\/\* \/tool \/tool\/\*/);
  assert.match(caddy, /handle @reserved \{\s+respond "Not found" 404/);
});

test('public VM uses bounded public services with no private mounts or access opt-ins', () => {
  const services = compose.split(/^ {2}(?=\w+:)/m).slice(1);
  assert.equal(services.length, 4);
  for (const block of services) {
    assert.match(block, /image: \$\{LOLLY_PUBLIC_\w+_IMAGE:\?Set the qualified/);
    assert.match(block, /ports: \["127\.0\.0\.1:\d+:\d+"\]/);
    assert.match(block, /read_only: true/);
    assert.match(block, /cap_drop: \[ALL\]/);
    assert.match(block, /no-new-privileges:true/);
    assert.match(block, /mem_limit: [1-9]\d*m/);
    assert.match(block, /cpus: "[01]\.\d+"/);
    assert.match(block, /pids_limit: [1-9]\d*/);
    assert.match(block, /tmpfs: \["\/tmp:size=[1-9]\d*m,mode=1777"\]/);
  }
  assert.match(compose, /LOLLY_MCP_ALLOW_ANONYMOUS: \$\{LOLLY_PUBLIC_MCP_ALLOW_ANONYMOUS:-0\}/);
  assert.match(compose, /LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT: "0"/);
  assert.match(compose, /CA_ALLOW_IN_MEMORY_RATE_LIMIT: "0"/);
  assert.match(compose, /CA_DEV_FAKE_PROVIDER: "0"/);
  assert.match(compose, /LOLLY_MCP_PRIVATE_FILES: "0"/);
  assert.match(compose, /LOLLY_MCP_PUBLIC_ORIGIN: https:\/\/\$\{LOLLY_PUBLIC_HOST:/);
  assert.match(compose, /LOLLY_MCP_TRUSTED_PROXIES: \$\{LOLLY_PUBLIC_PROXY_PEER:\?/);
  assert.doesNotMatch(compose, /brands\/suse|LW_|postgres|\bVERCEL\b|docker\.sock/);
  assert.match(compose, /target: \/usr\/share\/nginx\/html\/models\s+read_only: true/);
  assert.match(compose, /create_host_path: false/);
});

test('public web image relay setting is optional and public content remains the default', () => {
  const dockerfile = read('deploy/docker/web.Dockerfile');
  assert.match(dockerfile, /^ARG VITE_LIVE_RELAY=$/m);
  assert.match(dockerfile, /^ENV VITE_LIVE_RELAY=\$\{VITE_LIVE_RELAY\}$/m);
  assert.match(dockerfile, /^ARG LOLLY_PROFILE=lolly-start$/m);
  assert.match(dockerfile, /id=LOLLY_CATALOG_SIGNING_KEY[^\n]*required=true/);
  assert.match(dockerfile, /id=VITE_CATALOG_PUBLIC_KEY_JWK[^\n]*required=true/);
});

test('browser image is optional, lockfile-scoped and retains sandbox/auth defaults', () => {
  const source = read('deploy/docker/mcp-browser.Dockerfile');
  assert.match(source, /FROM node:26-bookworm-slim@sha256:[a-f0-9]{64}/);
  assert.match(source, /ARG LOLLY_PROFILE=lolly-start/);
  assert.match(
    source,
    /env -u PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD node services\/mcp\/scripts\/install-browser.ts --force/
  );
  assert.match(source, /COPY --from=build \/opt\/lolly-browsers \/opt\/lolly-browsers/);
  assert.match(source, /install-browser.ts --with-deps/);
  assert.match(source, /USER node/);
  assert.match(source, /ENV XDG_CONFIG_HOME=\/tmp\/config/);
  assert.match(source, /ENV XDG_CACHE_HOME=\/tmp\/cache/);
  assert.doesNotMatch(
    source,
    /LOLLY_BROWSER_NO_SANDBOX=1|LOLLY_MCP_ALLOW_ANONYMOUS=1|LOLLY_MCP_TOKEN=/
  );
  assert.match(compose, /LOLLY_BROWSER_NO_SANDBOX: \$\{LOLLY_PUBLIC_BROWSER_NO_SANDBOX:-0\}/);
  assert.match(compose, /LOLLY_WEB_BASE: \$\{LOLLY_PUBLIC_WEB_BASE:-\}/);
  assert.match(compose, /LOLLY_BROWSER_MAX_CONCURRENCY: "1"/);
});

/**
 * One job's block from a workflow, by its id under `jobs:`. The block ends where the
 * next two-space key or two-space comment begins. This file runs in a sparse
 * checkout with no dependencies installed, so it reads the YAML as text.
 */
function workflowJob(workflow: string, id: string): string {
  const start = workflow.indexOf(`\n  ${id}:\n`);
  assert.ok(start >= 0, `no ${id} job`);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}(?:#|[a-z0-9-]+:\n)/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('native image publication is opt-in and follows source, catalog and sandbox qualification', () => {
  const workflow = read('.github/workflows/deployment-suse.yml');
  const web = workflowJob(workflow, 'web-image');
  const services = workflowJob(workflow, 'service-images');
  for (const job of [web, services]) {
    assert.match(job, /github.event_name == 'workflow_dispatch' && inputs.build_images == true/);
    assert.match(job, /needs: \[chart, public-vm, [a-z-]+\]/);
    assert.match(job, /test "\$GITHUB_SHA" = "\$EXPECTED_SOURCE"/);
    assert.match(job, /submodules: false/);
    assert.match(job, /--read-only --cap-drop ALL --security-opt no-new-privileges:true/);
    assert.doesNotMatch(job, /seccomp=unconfined|--privileged|SYS_ADMIN|LOLLY_BROWSER_NO_SANDBOX=1/);
  }
  // Only the web image is signed, so only its job sees the signing key.
  assert.match(web, /secrets.LOLLY_CATALOG_SIGNING_KEY/);
  assert.match(web, /--secret id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY/);
  assert.match(web, /verify-release-catalog.ts/);
  assert.ok(web.indexOf('verify-release-catalog.ts') < web.indexOf('docker push "$remote"'));
  assert.doesNotMatch(services, /LOLLY_CATALOG_SIGNING_KEY|VITE_CATALOG_PUBLIC_KEY_JWK/);
  assert.match(services, /--env LOLLY_BROWSER_NO_SANDBOX=0/);
  assert.match(
    services,
    /--security-opt "seccomp=\$GITHUB_WORKSPACE\/deploy\/docker\/seccomp\/public-browser-sandbox.json"/
  );
  assert.ok(services.indexOf('public-image-probe.ts') < services.indexOf('docker push "$remote"'));
  // The probe's web shell is this run's unsigned build of the same source, checked
  // before use and never pushed.
  const fixture = workflowJob(workflow, 'probe-web-shell');
  assert.match(fixture, /run: pnpm run build:web\n/);
  assert.match(fixture, /release: false/);
  assert.match(fixture, /retention-days: 1/);
  assert.doesNotMatch(fixture, /LOLLY_CATALOG_SIGNING_KEY|VITE_CATALOG_PUBLIC_KEY_JWK|packages: write|docker push/);
  assert.match(services, /receipt.source !== process.env.EXPECTED_SOURCE \|\| receipt.runId !== process.env.GITHUB_RUN_ID \|\| receipt.release !== false/);
  assert.match(services, /src=\$RUNNER_TEMP\/lolly-probe-web,dst=\/qualification-web,readonly/);
  const diagnosis = services.slice(
    services.indexOf('- name: Retain bounded unqualified'),
    services.indexOf('- name: Publish only qualified')
  );
  assert.match(diagnosis, /failure\(\) && steps\.native_probe\.outcome == 'failure'/);
  assert.match(diagnosis, /qualified: false, promotionAllowed: false/);
  assert.match(diagnosis, /retention-days: 1/);
  assert.doesNotMatch(diagnosis, /docker push|REGISTRY_TOKEN|CA_ROOT_KEY/);
  // The offline transport judges each image by its own qualifying job.
  const archive = workflowJob(workflow, 'archive-qualified-images');
  assert.match(archive, /outcome\("Opt-in native public service images \(MCP, CA, Penpot\)"\)!=="success"/);
  assert.match(archive, /outcome\("Opt-in native public web image \(gated on the WebGPU table\)"\)==="success"/);
  assert.match(archive, /--name public-candidate-service-receipts/);
  assert.match(archive, /if \[\[ "\$web_qualified" == true \]\]; then\n\s+gh run download [^\n]+--name public-candidate-web-receipts/);
});

test('Compose browser overlay requires a verified seccomp file and preserves isolation', () => {
  const overlay = read('deploy/docker/public-browser.compose.yml');
  assert.match(overlay, /seccomp=\$\{LOLLY_PUBLIC_BROWSER_SECCOMP_FILE:\?Set the verified/);
  assert.doesNotMatch(overlay, /no-new-privileges/);
  assert.match(compose, /no-new-privileges:true/);
  assert.doesNotMatch(overlay, /unconfined|privileged:|cap_add|no-sandbox/);
  assert.doesNotMatch(compose, /seccomp=/);
  const probe = read('deploy/docker/public-image-probe.ts');
  assert.match(probe, /page.goto\('chrome:\/\/sandbox'\)/);
  assert.match(probe, /Layer 1 Sandbox/);
  assert.match(probe, /Seccomp-BPF sandbox supports TSYNC/);
  assert.match(probe, /for \(const format of \['svg', 'png', 'pdf'\]\)/);
});
