# Server-only image: no Electron runtime, artwork, audio or signing material.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm install --global pnpm@12.10.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY scripts/simulation-revision.mjs ./scripts/simulation-revision.mjs
RUN node scripts/simulation-revision.mjs && pnpm exec tsc -p apps/server/tsconfig.json
# Install only the relay's runtime dependency, at the version resolved by the lockfile.
RUN mkdir /runtime && node --input-type=module -e "import fs from 'node:fs';import{createRequire}from'node:module';const r=createRequire(import.meta.url);fs.writeFileSync('/runtime/package.json',JSON.stringify({private:true,type:'module',dependencies:{ws:r('ws/package.json').version}}))" \
 && cd /runtime && npm install --omit=dev --ignore-scripts --no-audit --no-fund
FROM node:22-bookworm-slim
ARG ABROZ_BUILD_VERSION=unknown
ENV NODE_ENV=production PORT=8080 ABROZ_BUILD_VERSION=$ABROZ_BUILD_VERSION
WORKDIR /app
COPY --from=build --chown=node:node /runtime/package.json ./package.json
COPY --from=build --chown=node:node /runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist-server ./dist-server
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","dist-server/apps/server/src/index.js"]
