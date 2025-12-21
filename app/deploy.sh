#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
APP_BACKEND="toolkit"
REMOTE_BACKEND="dokku@hubuntu.imranhira.com:${APP_BACKEND}"

APP_FRONTEND="toolkit-ui"
REMOTE_FRONTEND="dokku@hubuntu.imranhira.com:${APP_FRONTEND}"

# Inferred API URL (Adjust if your Dokku configuration differs)
API_URL="https://${APP_BACKEND}.naurinjahan.com/api"

BRANCH="main"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# --- 1. Build Wasp Project ---
echo "Building Wasp project..."
wasp build

# --- 2. Deploy Backend ---
echo "Deploying Backend (${APP_BACKEND})..."
cd .wasp/build

# Clean up any previous git repo to avoid conflicts
rm -rf .git
git init -q
git add -A
git commit -qm "deploy backend ${TIMESTAMP}"

git remote add dokku "${REMOTE_BACKEND}"
git push -f dokku "${BRANCH}"

# Return to root
cd ../.. 

# --- 3. Build Frontend ---
echo "Building Frontend (${APP_FRONTEND})..."
cd .wasp/build/web-app

# Set API URL for the build
export REACT_APP_API_URL="${API_URL}"
echo "Using API URL: ${REACT_APP_API_URL}"

# Install dependencies and build static assets
npm install
npm run build

# --- 4. Prepare Frontend Docker ---
echo "Dockerizing Frontend..."

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

# --- 5. Deploy Frontend ---
echo "Deploying Frontend..."
rm -rf .git
git init -q
# Force add build folder because it is likely ignored by .gitignore
git add -f build
git add Dockerfile nginx.conf
git commit -qm "deploy frontend ${TIMESTAMP}"

git remote add dokku "${REMOTE_FRONTEND}"
git push -f dokku "${BRANCH}"

echo "Deployment Complete! 🚀"
