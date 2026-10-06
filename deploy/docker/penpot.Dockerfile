# syntax=docker/dockerfile:1
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80
WORKDIR /app
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0
ENV NODE_ENV=production PORT=8791 LOLLY_PENPOT_BIND_HOST=0.0.0.0 \
    NODE_OPTIONS=--max-old-space-size=64
# No packages, content packs, Work environment or CA key material enter this image.
COPY services/penpot ./services/penpot
COPY LICENSE ./LICENSE
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node
EXPOSE 8791
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8791)+'/healthz',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "services/penpot/http.ts"]
