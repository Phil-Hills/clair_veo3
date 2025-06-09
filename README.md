# Clair Veo3

A full-stack application to generate MP4 videos using Google's Veo 3 model via Vertex AI.

## Setup
1. Install Node.js, VS Code, gcloud CLI, and Firebase CLI.
2. Set up a Google Cloud project (`clairos-agent-core`) and enable Vertex AI, Cloud Build, and Cloud Run APIs.
3. Place `credentials.json` in `backend/credentials`.
4. Run `npm install` in `backend` and `frontend` directories.

## Deployment
1. Backend: Deploy to Cloud Run with `gcloud builds submit --config backend/cloudbuild.yaml`.
2. Frontend: Deploy to Firebase Hosting with `gcloud builds submit --config frontend/cloudbuild.yaml`.
3. Update `frontend/src/services/aiService.ts` with the Cloud Run URL.

## Usage
- Access at the Firebase Hosting URL (e.g., `https://clairos-agent-core.web.app`).
- Enter a prompt, optional image, and parameters to generate a video.
