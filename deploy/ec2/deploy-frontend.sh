#!/usr/bin/env bash

# Builds and swaps the public Nginx container on the EC2 self-hosted runner.
# The previous container is retained until both the UI and proxied API pass.
set -Eeuo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-ai-repair-web}"
ROLLBACK_NAME="${CONTAINER_NAME}-rollback"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-ai-repair-backend}"
IMAGE_NAME="${IMAGE_NAME:-ai-repair-assistant-frontend}"
REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATEWAY_NETWORK="application-gateway"
GATEWAY_ALIAS="ai-repair-entry"
# Keep the original container until the gateway migration has been accepted.
KEEP_PREVIOUS_FRONTEND="${KEEP_PREVIOUS_FRONTEND:-false}"
if [[ "${KEEP_PREVIOUS_FRONTEND}" != true && "${KEEP_PREVIOUS_FRONTEND}" != false ]]; then
  echo "KEEP_PREVIOUS_FRONTEND must be true or false" >&2
  exit 1
fi
if docker inspect "${ROLLBACK_NAME}" >/dev/null 2>&1; then
  echo "Resolve the retained rollback container before another migration deployment." >&2
  exit 1
fi
WEB_HEALTH_URL="http://127.0.0.1/healthz"
API_HEALTH_URL="http://127.0.0.1/api/v1/system/status"

# The independent gateway task owns network creation and the host port.
docker network inspect "${GATEWAY_NETWORK}" >/dev/null

if ! docker inspect "${BACKEND_CONTAINER}" >/dev/null 2>&1; then
  echo "Required backend container is not running: ${BACKEND_CONTAINER}" >&2
  exit 1
fi

NETWORK_NAME="$(docker inspect "${BACKEND_CONTAINER}" \
  --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}')"
if [[ -n "${BACKEND_NETWORK:-}" ]]; then
  NETWORK_NAME="${BACKEND_NETWORK}"
fi
if [[ "${NETWORK_NAME}" == *$'\n'* || "${NETWORK_NAME}" == "${GATEWAY_NETWORK}" ]]; then
  echo 'Backend network is ambiguous; set BACKEND_NETWORK to the existing internal network.' >&2
  exit 1
fi
if [[ -z "${NETWORK_NAME}" ]]; then
  echo "Could not resolve the Docker network used by the backend." >&2
  exit 1
fi

# Verify an explicit selection belongs to the backend.
docker network inspect "${NETWORK_NAME}" --format '{{range .Containers}}{{println .Name}}{{end}}' | grep -Fx "${BACKEND_CONTAINER}" >/dev/null

# A different application must never share this gateway DNS alias.
for member in $(docker network inspect "${GATEWAY_NETWORK}" --format '{{range $id, $_ := .Containers}}{{println $id}}{{end}}'); do
  member_name="$(docker inspect "${member}" --format '{{.Name}}')"
  if [[ "${member_name}" != "/${CONTAINER_NAME}" ]] && docker inspect "${member}" \
    --format '{{with index .NetworkSettings.Networks "application-gateway"}}{{json .Aliases}}{{end}}' | grep -Fq '"ai-repair-entry"'; then
    echo "Gateway alias ai-repair-entry is already assigned to ${member_name}." >&2
    exit 1
  fi
done

echo "Building frontend candidate image..."
docker build --pull \
  --build-arg VITE_APP_BASE_PATH=/ai-repair/ \
  --build-arg VITE_API_BASE_URL= \
  -t "${IMAGE_NAME}:candidate" \
  "${REPOSITORY_ROOT}"

restore_previous_frontend() {
  echo "The new frontend did not become healthy. Restoring the previous container." >&2
  docker logs --tail 120 "${CONTAINER_NAME}" 2>/dev/null || true
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

  if docker inspect "${ROLLBACK_NAME}" >/dev/null 2>&1; then
    docker rename "${ROLLBACK_NAME}" "${CONTAINER_NAME}"
    if [[ "${PREVIOUS_GATEWAY:-false}" == true ]]; then
      docker network connect --alias "${GATEWAY_ALIAS}" "${GATEWAY_NETWORK}" "${CONTAINER_NAME}"
    fi
    docker start "${CONTAINER_NAME}"
  fi

  exit 1
}

docker rm -f "${ROLLBACK_NAME}" >/dev/null 2>&1 || true
if docker inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  if docker inspect "${CONTAINER_NAME}" --format '{{json .NetworkSettings.Networks}}' | grep -q '"application-gateway"'; then
    docker network disconnect "${GATEWAY_NETWORK}" "${CONTAINER_NAME}"
    PREVIOUS_GATEWAY=true
  fi
  docker stop "${CONTAINER_NAME}" >/dev/null
  docker rename "${CONTAINER_NAME}" "${ROLLBACK_NAME}"
fi

if ! docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --network "${NETWORK_NAME}" \
  "${IMAGE_NAME}:candidate"; then
  restore_previous_frontend
fi

if ! docker network connect --alias "${GATEWAY_ALIAS}" "${GATEWAY_NETWORK}" "${CONTAINER_NAME}"; then
  restore_previous_frontend
fi

healthy=false
for attempt in $(seq 1 60); do
  if docker exec "${CONTAINER_NAME}" wget -T 10 -q -O - "${WEB_HEALTH_URL}" >/dev/null \
    && docker exec "${CONTAINER_NAME}" wget -T 10 -q -O - "${API_HEALTH_URL}" >/dev/null; then
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

if [[ "${KEEP_PREVIOUS_FRONTEND}" != true ]]; then
  docker rm -f "${ROLLBACK_NAME}" >/dev/null 2>&1 || true
fi
docker rm -f ai-repair-frontend >/dev/null 2>&1 || true
docker tag "${IMAGE_NAME}:candidate" "${IMAGE_NAME}:ec2"
if [[ "${KEEP_PREVIOUS_FRONTEND}" != true ]]; then
  docker image prune -f >/dev/null
fi

echo "Frontend deployment completed successfully."
docker exec "${CONTAINER_NAME}" wget -T 10 -q -O - "${API_HEALTH_URL}"
echo
