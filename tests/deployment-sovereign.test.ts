// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const chart = new URL('../deploy/helm/profiles/sovereign/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, chart), 'utf8');

test('sovereign static server is the qualified public VM route contract', () => {
  assert.equal(
    read('files/public.nginx.conf'),
    readFileSync(new URL('../deploy/docker/public.nginx.conf', import.meta.url), 'utf8')
  );
});

test('sovereign profile stays explicitly separate from the default public chart', () => {
  const defaults = readFileSync(new URL('../deploy/helm/values.yaml', import.meta.url), 'utf8');
  assert.doesNotMatch(defaults, /sovereign|hostNetwork|lolly-private/);
  const profile = read('values.yaml');
  assert.match(profile, /hostNetworkAcknowledged: false/);
  assert.match(profile, /proxyAddresses: \[\]/);
  assert.match(profile, /existingClaim: ""/);
  assert.match(profile, /digest: ""/);
  assert.doesNotMatch(profile, /10\.4\.|80\.47\.|87\.58\./);
});

test('private routes preserve relay ownership and cookie custody', () => {
  const source = read('files/private.caddy');
  assert.match(source, /\.Values\.private\.relay/);
  assert.match(source, /\.Values\.private\.server/);
  assert.match(source, /@live_relay path \/live\/\*/);
  assert.match(source, /header_up -Cookie/);
  assert.match(source, /header_up -Authorization/);
  assert.match(source, /max_size 65MiB/);
  assert.match(source, /@file_parts/);
  assert.match(source, /@session_writes/);
  assert.doesNotMatch(source, /reverse_proxy https:\/\/lolly\.tools|live-relay:8790|server:8787/);
});

test('public and private live routes have separate process owners', () => {
  const publicSource = read('files/public.caddy');
  const liveBlock = publicSource.match(
    /@live path[^\n]+\n\s*handle @live \{([\s\S]*?)\n\s*\}/
  )?.[1];
  assert.ok(liveBlock);
  // The request_body block precedes the proxy; inspect the complete next route.
  const liveRoute = publicSource.slice(
    publicSource.indexOf('@live path'),
    publicSource.indexOf('# Unknown API')
  );
  assert.match(liveRoute, /"name" "mcp"/);
  assert.doesNotMatch(liveRoute, /\.Values\.private/);
  assert.match(read('files/private.caddy'), /\.Values\.private\.relay/);
  const server = readFileSync(new URL('../services/mcp/src/http.ts', import.meta.url), 'utf8');
  assert.match(server, /const relay = createLiveRelay\(\)/);
  assert.match(server, /relay\.mount\(server\)/);
});
