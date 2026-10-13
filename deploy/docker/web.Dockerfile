# syntax=docker/dockerfile:1
# SPDX-License-Identifier: MPL-2.0
# Package an independently compiled and signed web frontend. The named context
# release-frontend carries only its artifact files, including the signed receipt.
# Supply the reviewed source SHA, profile and public pin as build arguments.
# No dependency installation, compiler or private signing material runs here.

FROM node:26-bookworm@sha256:f1233c415b41ffcf237c717b3dea92e9d4ea006e0e4c71edcb790605d74f5404 AS verify
WORKDIR /src
ARG LOLLY_PROFILE=lolly-start
ARG LOLLY_RELEASE_SOURCE
ARG VITE_CATALOG_PUBLIC_KEY_JWK
ENV LOLLY_PROFILE=${LOLLY_PROFILE}
ENV LOLLY_RELEASE_SOURCE=${LOLLY_RELEASE_SOURCE}
ENV VITE_CATALOG_PUBLIC_KEY_JWK=${VITE_CATALOG_PUBLIC_KEY_JWK}
COPY scripts/release-frontend-receipt.ts scripts/verify-release-catalog.ts scripts/webgpu-release-gate.ts ./scripts/
COPY engine/src/canonical-json.ts engine/src/catalog-integrity.ts engine/src/x509.ts engine/src/bytes.ts engine/src/der-read.ts ./engine/src/
COPY shells/web/src/main.ts ./shells/web/src/main.ts
COPY docs/supported-environments.md ./docs/supported-environments.md
COPY --from=release-frontend / /src/release-frontend/
RUN --network=none node scripts/webgpu-release-gate.ts --scope web \
    && node scripts/release-frontend-receipt.ts --verify web release-frontend \
    && node scripts/verify-release-catalog.ts --root release-frontend \
    && test -f release-frontend/.delivery-etags.conf

FROM ghcr.io/nginx/nginx-unprivileged:1.31-alpine@sha256:884e0b7f42f303641b0f4e78755aea647521dca0b89ca3be7992ad78b5c07434 AS runtime
USER 0
RUN --network=none rm -rf /usr/share/nginx/html && mkdir -p /usr/share/nginx/html
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker/security-headers.conf /etc/nginx/security-headers.conf
COPY deploy/docker/delivery-maps.conf /etc/nginx/delivery-maps.conf
COPY deploy/docker/delivery-headers.conf /etc/nginx/delivery-headers.conf
COPY --from=verify /src/release-frontend/.delivery-etags.conf /etc/nginx/delivery-etags.conf
COPY --from=verify /src/release-frontend /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
