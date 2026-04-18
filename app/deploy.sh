#!/usr/bin/env bash
set -euo pipefail

# --- Args ---
USE_TUNNEL=false
for arg in "$@"; do
  case $arg in
    --tunnel) USE_TUNNEL=true ;;
  esac
done

# --- Configuration ---
# Ensure SSH Agent is active and keys are added (prevents multiple passphrase prompts)
if [ -z "${SSH_AUTH_SOCK:-}" ]; then
    eval "$(ssh-agent -s)"
    trap 'kill $SSH_AGENT_PID' EXIT
fi
# Check if keys are loaded, if not, add them (prompts once)
ssh-add -l >/dev/null 2>&1 || ssh-add

APP_BACKEND="toolkit"
APP_FRONTEND="toolkit-ui"

if [ "$USE_TUNNEL" = true ]; then
  DOKKU_HOST="ssh.imranhira.com"
  echo "🌐 Tunnel mode: deploying via ${DOKKU_HOST}"
else
  DOKKU_HOST="hubuntu.imranhira.com"
  echo "🏠 Local mode: deploying via ${DOKKU_HOST}"
fi

REMOTE_BACKEND="dokku@${DOKKU_HOST}:${APP_BACKEND}"
REMOTE_FRONTEND="dokku@${DOKKU_HOST}:${APP_FRONTEND}"

# Inferred API URL (Adjust if your Dokku configuration differs)
API_URL="https://toolkit-api.naurinjahan.com"

BRANCH="main"
# Use Amsterdam time for release tags (Europe/Amsterdam)
TIMESTAMP=$(TZ="Europe/Amsterdam" date +%Y-%m-%dT%H-%M-%S)
WASP_BUILD_DIR=".wasp/out"

echo "========================================="
echo "Starting Pre-Deployment Build & Validation"
echo "========================================="

# --- 0. Guardrails: ensure SMTP is enabled for production deploys ---
echo "✓ Validating emailSender provider..."
EMAIL_PROVIDER="$(
  awk '
    BEGIN { inBlock=0; provider="" }
    /^[[:space:]]*emailSender[[:space:]]*:[[:space:]]*\{/ { inBlock=1; next }
    inBlock && /^[[:space:]]*provider[[:space:]]*:/ {
      # Take the token after ":" and strip spaces, commas, and comments.
      line=$0
      sub(/#.*/, "", line)
      # Match // end-of-line comments (single \/ pairs; avoid \\ which breaks BSD awk)
      sub(/\/\/.*$/, "", line)
      sub(/.*provider[[:space:]]*:[[:space:]]*/, "", line)
      sub(/[[:space:]]*,[[:space:]]*$/, "", line)
      gsub(/[[:space:]]+/, "", line)
      provider=line
    }
    inBlock && /^[[:space:]]*\}[[:space:]]*,?[[:space:]]*$/ { inBlock=0 }
    END { print provider }
  ' main.wasp
)"

if [ "${EMAIL_PROVIDER:-}" != "SMTP" ]; then
  echo "❌ Refusing to deploy: emailSender.provider must be SMTP for production."
  echo "   Found: '${EMAIL_PROVIDER:-<missing>}' in app/main.wasp"
  echo "   Fix it by setting:"
  echo "     emailSender: { provider: SMTP, ... }"
  exit 1
fi

# --- 1. Build Wasp Project ---
echo "✓ Building Wasp project..."
wasp build

# --- 2. Validate Backend Build ---
echo "✓ Validating backend build..."
if [ ! -d "${WASP_BUILD_DIR}" ]; then
    echo "❌ Backend build failed: ${WASP_BUILD_DIR} directory not found"
    exit 1
fi

# --- 3. Build Frontend (Wasp 0.21+: vite build from project root) ---
echo "✓ Building Frontend..."

export REACT_APP_API_URL="${API_URL}"
export WASP_SERVER_URL="${API_URL}"
echo "  Using API URL: ${REACT_APP_API_URL}"

npx vite build

# --- 4. Validate Frontend Build ---
echo "✓ Validating frontend build..."
if [ ! -d "${WASP_BUILD_DIR}/web-app/build" ]; then
    echo "❌ Frontend build failed: ${WASP_BUILD_DIR}/web-app/build directory not found"
    exit 1
fi

echo "========================================="
echo "✓ All Builds Successful! Starting Deployment..."
echo "========================================="

# Generate release tag name early so we can use it in deployments
TAG_NAME="release-${TIMESTAMP}"

# --- 5. Deploy Backend ---
echo "→ Deploying Backend (${APP_BACKEND})..."

# Patch generated Dockerfile: add --legacy-peer-deps to avoid peer dependency conflicts
sed -i.bak 's/RUN npm install && cd \(.*\) && npm install/RUN npm install --legacy-peer-deps \&\& cd \1 \&\& npm install --legacy-peer-deps/' "${WASP_BUILD_DIR}/Dockerfile"
rm -f "${WASP_BUILD_DIR}/Dockerfile.bak"
# Bake RELEASE_TAG into image so we don't need config:set after push (avoids second rollout)
sed -i.bak2 "/^WORKDIR \/app\/.wasp\/out\/server$/a\\
ENV RELEASE_TAG=${TAG_NAME}
" "${WASP_BUILD_DIR}/Dockerfile"
rm -f "${WASP_BUILD_DIR}/Dockerfile.bak2"

cd "${WASP_BUILD_DIR}"

# Clean up any previous git repo to avoid conflicts
rm -rf .git
git init -q
git add -A
git commit -qm "deploy backend ${TIMESTAMP} [${TAG_NAME}]"

git remote add dokku "${REMOTE_BACKEND}"
git push -f dokku "${BRANCH}"

echo "✓ Backend deployed successfully (RELEASE_TAG baked into image)"

# Return to root
cd ../..

# --- 6. Deploy Frontend ---
echo "→ Deploying Frontend (${APP_FRONTEND})..."
cd "${WASP_BUILD_DIR}/web-app"

# Create custom nginx config for SPA routing + cache-busting strategy.
#
# Caching strategy (applies to all current and future Wasp frontend assets):
#   - /assets/*          -> content-hashed by Vite (e.g. index-BiJCTKor.js).
#                           Safe to cache forever + immutable.
#   - index.html         -> entry point, NOT hashed. Must never be cached by
#                           clients so new deployments are picked up immediately
#                           (critical for Capacitor WebView in hosted mode).
#   - /locales/*.json    -> i18n translations (future). Short TTL + revalidate
#                           so translation updates propagate without app rollout.
#   - service worker(s)  -> must never be cached by clients.
#   - everything else    -> unhashed public files (favicon, og images, etc.).
#                           Short TTL + must-revalidate so replacements are
#                           picked up quickly while still saving bandwidth.
cat <<EOF > nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip for text assets (nginx:alpine default already covers most,
    # but being explicit keeps this portable across base image changes).
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        application/xml+rss
        image/svg+xml;

    # 1) Content-hashed assets emitted by Vite (filenames change on every
    #    content change) -> cache forever, immutable.
    location ^~ /assets/ {
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files \$uri =404;
    }

    # 2) i18n locale JSONs (future-proof; served even before i18n lands).
    #    Short TTL + must-revalidate so new translations are picked up without
    #    a mobile APK rollout.
    location ^~ /locales/ {
        add_header Cache-Control "public, max-age=300, must-revalidate" always;
        try_files \$uri =404;
    }

    # 3) Service workers must never be cached by clients, otherwise an old SW
    #    can pin users to a stale frontend forever.
    location = /sw.js                { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; }
    location = /service-worker.js    { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; }
    location = /workbox-sw.js        { add_header Cache-Control "no-store, no-cache, must-revalidate" always; try_files \$uri =404; }

    # 4) SPA entry point. Never cache so clients always fetch the current
    #    index.html, which in turn references the latest hashed /assets/*.
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        expires off;
        try_files \$uri =404;
    }

    # 5) Everything else (favicon, og images, manifest, robots.txt, other
    #    unhashed files from public/). Short TTL + revalidate.
    location / {
        add_header Cache-Control "public, max-age=300, must-revalidate" always;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Create Dockerfile for Nginx (RELEASE_TAG baked in to avoid config:set second rollout)
cat <<EOF > Dockerfile
FROM nginx:alpine
ENV RELEASE_TAG=${TAG_NAME}
COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

rm -rf .git
git init -q
# Force add build folder because it is likely ignored by .gitignore
git add -f build
git add Dockerfile nginx.conf
git commit -qm "deploy frontend ${TIMESTAMP} [${TAG_NAME}]"

git remote add dokku "${REMOTE_FRONTEND}"
git push -f dokku "${BRANCH}"

echo "✓ Frontend deployed successfully (RELEASE_TAG baked into image)"

# Return to project root
cd ../../..

# --- 7. Tag Release in Main Repository ---
echo "→ Tagging release in main repository..."
git tag -a "${TAG_NAME}" -m "Deployment: ${TIMESTAMP}"
git push origin "${TAG_NAME}" || echo "Warning: Failed to push tag. Ensure you have network connectivity to origin."
echo "✓ Created and pushed tag: ${TAG_NAME}"

echo "========================================="
echo "🚀 Deployment Complete!"
echo "========================================="
echo "Release Tag: ${TAG_NAME}"
echo ""
echo "Release tag ${TAG_NAME} is baked into both images (single rollout per app)."
echo ""
echo "To verify baked-in release tag on the server (run from your machine):"
echo "  Backend:  ssh dokku@${DOKKU_HOST} run toolkit sh -c 'printenv RELEASE_TAG'"
echo "  Frontend: ssh dokku@${DOKKU_HOST} run toolkit-ui sh -c 'printenv RELEASE_TAG'"
