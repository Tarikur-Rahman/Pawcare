FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build does not need Oracle connectivity. Server-rendered fetches are dynamic.
RUN npm run build
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S pawcare && adduser -S pawcare -G pawcare
COPY --from=builder --chown=pawcare:pawcare /app/.next/standalone ./
COPY --from=builder --chown=pawcare:pawcare /app/.next/static ./.next/static
COPY --from=builder --chown=pawcare:pawcare /app/public ./public
USER pawcare
EXPOSE 3000
CMD ["node","server.js"]
