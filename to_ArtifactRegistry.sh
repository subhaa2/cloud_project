#!/bin/bash

# Build and push all containers to Artifact Registry (Docker)
# ** run the script in bash with --> './to_ArtifactRegistry.sh'

set -e

PROJECT_ID="cloud-pls-run"
REGION="us-central1"
REPO_NAME="cloud-project-repo"

AR="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

echo ""
echo "=== Building & Pushing All Containers to Artifact Registry ==="
echo "Registry: $AR"
echo "==============================================================="

echo "Authenticating with Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

declare -A SERVICES=(
  ["backend-server"]="backend"
  ["flashcards-server"]="realtime/flashcards"
  ["whiteboard-server"]="realtime/whiteboard"
  ["frontend-client"]="frontend"
)

for SERVICE in "${!SERVICES[@]}"; do
  FOLDER=${SERVICES[$SERVICE]}
  IMAGE="${AR}/${SERVICE}:latest"

  echo ""
  echo ">>> Building $SERVICE from ./$FOLDER"
  docker build -t $IMAGE $FOLDER

  echo ">>> Pushing $SERVICE..."
  docker push $IMAGE

  echo ">>> $SERVICE pushed successfully."
done

echo ""
echo "=== All Images Successfully Built and Pushed ==="
