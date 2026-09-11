// SPDX-License-Identifier: MPL-2.0
/**
 * The pinned Lolly CA root certificate - the trust anchor for Content
 * Credentials identity (see docs/content-credentials-identity.md).
 *
 * This is PUBLIC data (a certificate, not a key) and belongs in the open
 * repo the same way a browser ships its root store. The matching private
 * key lives only in the CA service's environment (CA_ROOT_KEY_PEM) and is
 * never committed anywhere.
 *
 * Empty string = no anchor configured yet: the verifier and export signer
 * degrade to today's ephemeral self-signed behaviour. Generate the real
 * root with `node services/ca/scripts/gen-root.mjs` and paste the cert PEM
 * here (and only the cert).
 */
export const CA_ROOT_PEM: string = `-----BEGIN CERTIFICATE-----
MIIBfzCCASWgAwIBAgIJYuNtbizhTpDxMAoGCCqGSM49BAMCMCMxDjAMBgNVBAoM
BUxvbGx5MREwDwYDVQQDDAhMb2xseSBDQTAeFw0yNjA3MDMwODAzMzRaFw0zNjA2
MzAwODAzMzRaMCMxDjAMBgNVBAoMBUxvbGx5MREwDwYDVQQDDAhMb2xseSBDQTBZ
MBMGByqGSM49AgEGCCqGSM49AwEHA0IABO+aVLOX36sW5bli3KPftPeLWTM52Ve1
JOM5tR4xm28Y4QyVL8jMDr0i9lYMhZSbihOab7pByPxFWHQlIhOCZKyjQjBAMA8G
A1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMB0GA1UdDgQWBBSd10s7BWWS
eiTqJtI/6lNG0waHLjAKBggqhkjOPQQDAgNIADBFAiBrFbwvtUema/wVSG4hcJ/U
Kg4yp6mk8T65OID5F5a6aQIhAO8Y82p4j6izN7HXL0dh8GZmMjy2flcHjX1/0+zL
0Ap7
-----END CERTIFICATE-----
`;
