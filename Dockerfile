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

# Nginx serves the SPA and proxies same-origin /api requests to Spring Boot.
# Keeping both behind port 80 avoids browser CORS issues and makes PDF range
# requests behave consistently in react-pdf.
FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
