# One image for both processes: `web` (next start) and `worker` (npm run worker).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts && npx prisma generate

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 app
COPY --from=build /app /app
USER app
EXPOSE 3000
# Override CMD with `npm run worker` for the worker container.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
