#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# Ensure SSH Agent is active and keys are added (prevents multiple passphrase prompts)
if [ -z "${SSH_AUTH_SOCK:-}" ]; then
    eval "$(ssh-agent -s)"
    trap 'kill $SSH_AGENT_PID' EXIT
fi
# Check if keys are loaded, if not, add them (prompts once)
ssh-add -l >/dev/null 2>&1 || ssh-add

APP_BACKEND="toolkit"
REMOTE_BACKEND="dokku@hubuntu.imranhira.com:${APP_BACKEND}"

APP_FRONTEND="toolkit-ui"
REMOTE_FRONTEND="dokku@hubuntu.imranhira.com:${APP_FRONTEND}"

# Inferred API URL (Adjust if your Dokku configuration differs)
API_URL="https://toolkit-api.naurinjahan.com"

BRANCH="main"
TIMESTAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
WASP_BUILD_DIR=".wasp/out"

echo "========================================="
echo "Starting Pre-Deployment Build & Validation"
echo "========================================="

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

cd "${WASP_BUILD_DIR}"

# Clean up any previous git repo to avoid conflicts
rm -rf .git
git init -q
git add -A
git commit -qm "deploy backend ${TIMESTAMP} [${TAG_NAME}]"

git remote add dokku "${REMOTE_BACKEND}"
git push -f dokku "${BRANCH}"

# Set release tag as Dokku environment variable
ssh dokku@hubuntu.imranhira.com config:set "${APP_BACKEND}" RELEASE_TAG="${TAG_NAME}"

echo "✓ Backend deployed successfully"

# Return to root
cd ../..

# --- 6. Deploy Frontend ---
echo "→ Deploying Frontend (${APP_FRONTEND})..."
cd "${WASP_BUILD_DIR}/web-app"

# Create custom nginx config for SPA routing
cat <<EOF > nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Create Dockerfile for Nginx
cat <<EOF > Dockerfile
FROM nginx:alpine
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

# Set release tag as Dokku environment variable
ssh dokku@hubuntu.imranhira.com config:set "${APP_FRONTEND}" RELEASE_TAG="${TAG_NAME}"

echo "✓ Frontend deployed successfully"

# Return to project root
cd ../../..

# --- 7. Tag Release in Main Repository ---
echo "→ Tagging release in main repository..."
git tag -a "${TAG_NAME}" -m "Deployment: ${TIMESTAMP}"
git push origin "${TAG_NAME}"
echo "✓ Created and pushed tag: ${TAG_NAME}"

echo "========================================="
echo "🚀 Deployment Complete!"
echo "========================================="
echo "Release Tag: ${TAG_NAME}"
echo ""
echo "Check deployment version:"
echo "  ssh dokku@hubuntu.imranhira.com config:get ${APP_BACKEND} RELEASE_TAG"
echo "  ssh dokku@hubuntu.imranhira.com config:get ${APP_FRONTEND} RELEASE_TAG"
