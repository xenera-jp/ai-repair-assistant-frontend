# /ai-repair/ deployment

The public URL prefix is `/ai-repair/`. The independently maintained gateway
must strip that prefix and forward to `http://ai-repair-entry:80` on the existing
external Docker network `application-gateway`. It must canonicalize `/ai-repair`
to `/ai-repair/`. No public gateway is defined or created by this repository.

## Confirmed repository deployment entry point

`.github/workflows/deploy-ec2.yml` calls `deploy/ec2/deploy-frontend.sh` on the
frontend self-hosted runner. The backend workflow calls its own
`deploy/ec2/deploy-backend.sh`. These scripts build local Docker images and use
`docker run`; they do not deploy the frontend service in the EC2 Compose sample.
Previously the frontend script published `80:80`, while the backend repository's
`deploy/ec2/compose.yaml` sample published `4173:4173`, inconsistent with the
current frontend image's Nginx listener on port 80. Neither local file proves
what configuration is currently running on EC2.

The frontend script now keeps the existing backend network, adds only the
configured gateway alias `ai-repair-entry` on `application-gateway`, and publishes
no host ports. It refuses a conflicting alias. The previous frontend is detached
from the gateway network before replacement and reattached on rollback if it
previously used that network. Health checks run inside the frontend container
against `/healthz` and `/api/v1/system/status`, without relying on host port 80.
If the backend belongs to multiple networks, set `BACKEND_NETWORK` explicitly to
its existing internal network. Backend/database network memberships are unchanged.
Docker also assigns its normal container identifiers; no generic gateway alias
such as `frontend` or `web` is configured by this script.

The EC2 Compose sample has also been corrected: frontend connects to the default
internal network and external gateway network, has no published ports, and uses
port 80 in the image. Its backend has the internal `ai-repair-backend` alias for
Nginx resolution. Do not switch an existing script deployment to Compose without
first reconciling actual container names, image tags, volumes and configuration.
Compose adds its own automatic service/container DNS names as usual.

## Build and local development

- `npm run dev`: root deployment at `http://localhost:5173/`, API proxy to port 8080.
- `npm run build`: defaults to `/ai-repair/` for JS, CSS, favicon and PDF worker.
- Set `VITE_APP_BASE_PATH=/` for a root production build, or `/ai-repair/` when
  testing prefixed development. The value must start and end with `/`.
- Configuration is supplied by shell variables. Vite does not load environment
  files (`envDir: false`), including `.env.local`. Existing local overrides must
  be supplied explicitly as process environment variables instead.
- `VITE_API_BASE_URL` is optional: an origin or base path **before** `/api`, e.g.
  `http://localhost:8080` or `/ai-repair/`. Empty means the configured application
  base. Do not set it to `/api`. Docker accepts both variables as build arguments;
  these are compile-time public settings, not runtime container settings.

Navigation, ordinary/new-tab links, invalid-route fallback and History API URLs
use the same Vite base. API requests, PDF viewing/links, recording content,
SSE and remote audio downloads share the same URL resolver. It does not prefix
an already prefixed URL twice. Backend endpoints stay at `/api/...`.
The internal Nginx continues to receive `/assets/...`, `/api/...` and page routes;
its API proxy, unbuffered PDF Range handling, 25m uploads and 300s read/send
timeouts are unchanged.

## Deployment handoff (not executed locally)

1. Confirm the live deployment method and current frontend/backend container
   networks on EC2. Confirm the gateway task has provisioned `application-gateway`
   and routes `/ai-repair/` to `ai-repair-entry:80` with prefix removal. Only the
   gateway should own host port 80. Check for other legacy port-80 containers.
2. Rebuild **only the frontend image** with `VITE_APP_BASE_PATH=/ai-repair/` and
   empty `VITE_API_BASE_URL`. The normal frontend deployment script supplies both.
   No backend, MySQL or Qdrant image rebuild is needed for this change.
3. After the shared network exists, run `./deploy/ec2/deploy-frontend.sh` in the
   frontend checkout on the runner, setting `BACKEND_NETWORK` only if required.
   This is a handoff instruction, not authorization to push or trigger Actions.
   The script retains and restores the old container on failed health checks;
   an old configuration may restore its old host-port mapping on rollback, so
   coordinate the initial port-80 migration with the gateway owner.
4. If the live system instead uses Compose, use the corrected EC2 sample only
   after checking it against the actual deployment file. Supply the rebuilt
   frontend image tag and recreate the frontend, retaining the internal network.
   Apply the backend network alias if missing; this can require container
   recreation but does not require a backend image rebuild. Do not run both
   deployment methods concurrently.
5. From outside, verify direct access and refresh of
   `/ai-repair/pre-departure`, navigation/back/forward and new-tab links; verify
   `/ai-repair/assets/...` and `/ai-repair/api/v1/system/status`. Check a real PDF
   Range request returns 206, recording upload/playback/SSE/download works, and
   no unprefixed browser requests or duplicate prefixes occur. Confirm frontend
   has no host port binding and only this app uses `ai-repair-entry`.

Unconfirmed: live EC2 files, container state, gateway configuration, DNS/network
reachability and external end-to-end behavior. No EC2 operations were performed.

## Local verification for this change

- Production TypeScript/Vite build passed; generated HTML references
  `/ai-repair/assets/...` and `/ai-repair/favicon.svg`. Existing bundle-size warning remains.
- `node --test test/*.test.mjs`: 29 passed, including four subpath regression tests.
  History behavior is checked with a simulated browser History API, not a real browser.
- Vite HTTP smoke checks passed for `/` and `/ai-repair/`: deep-link HTML,
  favicon serving and API proxy rewrite. No real backend calls were required.
- Source-scoped oxlint passed with three existing warnings. The default broad
  lint command also scans historical generated `.tmp` bundles and emits large
  amounts of unrelated warnings; these generated files were not modified.
- Both deployment scripts passed `bash -n`; Compose rendered successfully with
  interpolation and environment-file resolution disabled and a blank explicit
  env file. Assertions checked no frontend port binding, the external network,
  configured alias and backend isolation from the gateway network.
- Git diff whitespace checks passed. Docker engine was unavailable, so no image
  build, live Nginx/Range/upload test or container network smoke test was run.

## First gateway migration and backend port follow-up

Run the frontend script with `KEEP_PREVIOUS_FRONTEND=true` for the first migration. It retains the stopped original rollback container, including its original image and host port bindings. Suspend automatic deployments and do not redeploy or prune images until gateway acceptance. On failure, stop the gateway, remove the new frontend, rename the retained original container to `ai-repair-web` and start it. Remove the retained rollback container only after the migration rollback window ends. See the gateway README for coordinated steps.

The prefix change alone needs only a frontend rebuild. The separate backend port change now removes host 8080 and runs health checks inside the backend container. Rebuild and deploy the updated backend Dockerfile (which includes curl) for this to take effect; internal API paths remain unchanged.
