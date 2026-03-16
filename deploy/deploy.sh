#!/bin/bash
# Naada — Cloud Run Deployment Script

set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-challenge-489019}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE_NAME="naada"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}:latest"
GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Naada — Cloud Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

if [ -z "$GOOGLE_API_KEY" ]; then
    echo -e "${RED}Error: GOOGLE_API_KEY is not set.${NC}"
    echo "Get your key from: https://aistudio.google.com/apikey"
    echo "Usage: GOOGLE_API_KEY=your-key ./deploy.sh"
    exit 1
fi

echo -e "${YELLOW}Project:${NC} $PROJECT_ID"
echo -e "${YELLOW}Region:${NC} $REGION"
echo -e "${YELLOW}Service:${NC} $SERVICE_NAME"
echo -e "${YELLOW}Image:${NC} $IMAGE_NAME"

echo -e "\n${GREEN}[1/6] Setting project...${NC}"
gcloud config set project "$PROJECT_ID"

echo -e "\n${GREEN}[2/6] Enabling APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --quiet

echo -e "\n${GREEN}[3/6] Creating Artifact Registry repo (if needed)...${NC}"
gcloud artifacts repositories create "$SERVICE_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --quiet 2>/dev/null || echo "Repository already exists, skipping."

echo -e "\n${GREEN}[4/6] Building container...${NC}"
cd "$(dirname "$0")/.."
gcloud builds submit --tag "$IMAGE_NAME" --timeout=600

echo -e "\n${GREEN}[5/6] Deploying to Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --platform managed \
    --region "$REGION" \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --set-env-vars "GOOGLE_API_KEY=${GOOGLE_API_KEY},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}" \
    --allow-unauthenticated \
    --session-affinity \
    --quiet

echo -e "\n${GREEN}[6/6] Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --format 'value(status.url)')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}URL:${NC} $SERVICE_URL"
echo -e "${YELLOW}Health:${NC} ${SERVICE_URL}/health"
echo -e "\nOpen ${SERVICE_URL} in your browser."
