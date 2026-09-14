# ---------- Stage 1: Install dependencies & build ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (better layer caching — only re-runs if package*.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies now that the build is done, keep only prod deps
RUN npm prune --omit=dev


# ---------- Stage 2: Lean production image ----------
FROM node:22-alpine AS production

# Run as a non-root user (security best practice)
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run the app — no source, no dev deps, no build tools
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

USER nestjs

# main.ts falls back to 4000 if PORT is unset — keep this in sync with that default
EXPOSE 4000

CMD ["node", "dist/main"]