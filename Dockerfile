# Build the React bundle in a deterministic Node environment.
FROM node:22-alpine AS build

WORKDIR /app

# Vite replaces this value while building the browser bundle. It is intentionally
# limited to the public API URL and must never contain server-side secrets.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Copy dependency manifests first so Docker can reuse the npm cache when only
# application source files change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# The demo deployment exposes the frontend directly on port 4173. `serve` is a
# small static server with SPA fallback, so React routes work after page refresh.
FROM node:22-alpine AS runtime

WORKDIR /app
RUN npm install --global serve@14.2.5
COPY --from=build /app/dist ./dist

EXPOSE 4173

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:4173/pre-departure || exit 1

CMD ["serve", "--single", "dist", "--listen", "4173"]
