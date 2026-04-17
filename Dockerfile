# nextaibuilder — Root Dockerfile (API only, for GHCR publish via deploy.yml)
# FIR-84
#
# This is the Dockerfile referenced by .github/workflows/deploy.yml.
# The primary development Dockerfiles live in docker/:
#   docker/Dockerfile.api      — used by ci-cd.yml
#   docker/Dockerfile.frontend — used by ci-cd.yml
#
# This file mirrors docker/Dockerfile.api for compatibility with
# tools that expect a Dockerfile at the repository root.

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy manifests first to maximise layer cache hits
COPY apps/api/package.json apps/api/package-lock.json ./

# Install all deps (devDependencies required for tsc)
RUN npm ci

# Copy source files and compile
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src

RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy manifests for production install
COPY apps/api/package.json apps/api/package-lock.json ./

# Production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /build/dist ./dist

# Run as non-root for security
RUN addgroup -S nab && adduser -S nab -G nab
USER nab

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
