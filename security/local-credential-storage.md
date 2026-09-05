# Local credential storage

Operational credentials do not live in the public Lolly checkout. On a developer device,
the default store is the sibling `lolly-private/lolly/` directory. Set
`LOLLY_PRIVATE_DIR` to an absolute directory to use a different private store.

The directory must be owned by the current user with mode `0700`; credential files must
be regular, non-symlink files owned by that user with mode `0600`. The reviewed loaders
refuse broader permissions or symlinks. Do not add a symlink from this repository back to
the private files: it would make their contents readable through the public checkout again.

The CA variable names and documentation-only examples remain in
`services/ca/.env.example`. The MCP deployment names remain in
`services/mcp/deploy/deploy.env.example`. Neither example contains values.

Local commands:

```bash
npm run ca:dev
npm run sign:credentials:catalog
npm run sign:signature-logos
services/mcp/deploy/deploy.sh
```

The CA commands use the private loader. The MCP deploy script reads `mcp-deploy.env` from
the same directory; `LOLLY_MCP_DEPLOY_ENV_FILE` can select another private regular file.
Hosted deployments continue to use their platform secret manager, not this device store.

Files discovered by an explicit checkout scan that do not have a dedicated loader are kept
under the private store's `checkout/` subtree with their checkout-relative organization
intact. They must be supplied explicitly to the command or provider that owns them; never
restore or symlink them into this public working tree for convenience.

After any accidental plaintext exposure, rotate or revoke the affected service credentials
before considering the incident closed. Moving a value prevents further checkout exposure;
it does not invalidate copies that may already exist in process history, editors, or backups.

Verification:

```bash
npm run doctor
npm run secrets:scan
```

`doctor` must report no plaintext credential files in the public checkout. The history scan
must remain redacted and clean.
