# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM deps AS development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM deps AS migration
ENV NODE_ENV=production
COPY prisma ./prisma
RUN npx prisma generate --schema prisma/schema
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema && node prisma/seed.mjs"]

FROM deps AS builder
ENV NODE_ENV=production
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG AUTH_SECRET=build-only-placeholder
ENV DATABASE_URL=${DATABASE_URL}
ENV AUTH_SECRET=${AUTH_SECRET}
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
