#!/usr/bin/env bash

# Builds and swaps the public Nginx container on the EC2 self-hosted runner.
# The previous container is retained until both the UI and proxied API pass.
set -Eeuo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-ai-repair-web}"
ROLLBACK_NAME="${CONTAINER_NAME}-rollback"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-ai-repair-backend}"
IMAGE_NAME="${IMAGE_NAME:-ai-repair-assistant-frontend}"
REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1/healthz}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1/api/v1/system/status}"

if ! docker inspect "${BACKEND_CONTAINER}" >/dev/null 2>&1; then
  echo "Required backend container is not running: ${BACKEND_CONTAINER}" >&2
  exit 1
fi

NETWORK_NAME="$(docker inspect "${BACKEND_CONTAINER}" \
  --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}')"

if [[ -z "${NETWORK_NAME}" ]]; then
  echo "Could not resolve the Docker network used by the backend." >&2
  exit 1
fi

echo "Building frontend candidate image..."
docker build --pull \
  --build-arg VITE_API_BASE_URL= \
  -t "${IMAGE_NAME}:candidate" \
  "${REPOSITORY_ROOT}"

restore_previous_frontend() {
  echo "The new frontend did not become healthy. Restoring the previous container." >&2
  docker logs --tail 120 "${CONTAINER_NAME}" 2>/dev/null || true
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

  if docker inspect "${ROLLBACK_NAME}" >/dev/null 2>&1; then
    docker rename "${ROLLBACK_NAME}" "${CONTAINER_NAME}"
    docker start "${CONTAINER_NAME}"
  fi

  exit 1
}

docker rm -f "${ROLLBACK_NAME}" >/dev/null 2>&1 || true
if docker inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  docker stop "${CONTAINER_NAME}" >/dev/null
  docker rename "${CONTAINER_NAME}" "${ROLLBACK_NAME}"
fi

if ! docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --network "${NETWORK_NAME}" \
  -p 80:80 \
  "${IMAGE_NAME}:candidate"; then
  restore_previous_frontend
fi

healthy=false
for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error "${WEB_HEALTH_URL}" >/dev/null \
    && curl --fail --silent --show-error "${API_HEALTH_URL}" >/dev/null; then
    healthy=true
    break
  fi

  if ! docker inspect -f '{{.State.Running}}' "${CONTAINER_NAME}" 2>/dev/null \
    | grep -q true; then
    break
  fi

  echo "Waiting for frontend health (${attempt}/60)..."
  sleep 2
done

if [[ "${healthy}" != true ]]; then
  restore_previous_frontend
fi

docker rm -f "${ROLLBACK_NAME}" >/dev/null 2>&1 || true
docker rm -f ai-repair-frontend >/dev/null 2>&1 || true
docker tag "${IMAGE_NAME}:candidate" "${IMAGE_NAME}:ec2"
docker image prune -f >/dev/null

echo "Frontend deployment completed successfully."
curl --fail --silent --show-error "${API_HEALTH_URL}"
echo
