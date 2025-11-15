#!/bin/bash

# Build and push all containers to Artifact Registry (Docker)

# to run the script in bash with './to_ArtifactRegistry.sh'

# Exit immediately if a command exits with a non-zero status
set -e

## 1. CONFIGURATION ##
PROJECT_ID="cloud-pls-run"
REGION="us-central1"
REPO_NAME="cloud-project-repo"

AR_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

echo "--- Starting Container Build and Push ---"
echo "Target Artifact Registry: ${AR_PATH}"
echo "-----------------------------------------"

## 2. AUTHENTICATION ##
echo "Authenticating Docker with Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

## 3. BUILD AND PUSH: BACKEND SERVER ##
echo "Building and pushing backend-server..."
docker build -t ${AR_PATH}/backend-server:latest ./backend
docker push ${AR_PATH}/backend-server:latest
echo "backend-server pushed successfully."

## 4. BUILD AND PUSH: FLASHCARDS SERVER ##
echo "Building and pushing flashcards-server..."
docker build -t ${AR_PATH}/flashcards-server:latest ./realtime/flashcards
docker push ${AR_PATH}/flashcards-server:latest
echo "flashcards-server pushed successfully."

## 5. BUILD AND PUSH: WHITEBOARD SERVER ##
echo "Building and pushing whiteboard-server..."
docker build -t ${AR_PATH}/whiteboard-server:latest ./realtime/whiteboard
docker push ${AR_PATH}/whiteboard-server:latest
echo "whiteboard-server pushed successfully."

## 6. BUILD AND PUSH: FRONTEND CLIENT (Nginx) ##
echo "Building and pushing frontend-client..."
docker build -t ${AR_PATH}/frontend-client:latest ./frontend
docker push ${AR_PATH}/frontend-client:latest
echo "frontend-client pushed successfully."

echo "--- All containers successfully built and pushed! ---"