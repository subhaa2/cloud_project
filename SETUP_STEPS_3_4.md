d# Steps 3 & 4: Cloud Storage & Cloud Function Setup

This document provides step-by-step instructions for implementing Steps 3 and 4 of your Google Cloud setup.

## Step 3: Set up Cloud Storage (Secure File Handling)

### Prerequisites
- Google Cloud Project created
- `gcloud` CLI installed and authenticated
- Project ID set: `gcloud config set project YOUR-PROJECT-ID`

### 3.1 Create Cloud Storage Bucket

```bash
# Replace YOUR-BUCKET-NAME with a unique name (globally unique)
# Replace REGION with your preferred region (e.g., us-central1)
gsutil mb -c standard -l REGION gs://YOUR-BUCKET-NAME
```

**Example:**
```bash
gsutil mb -c standard -l us-central1 gs://my-school-storage-12345
```

### 3.2 Configure Bucket Permissions

The bucket should be private (not public). By default, it's private. Only your Cloud Run service and Cloud Function (with proper IAM roles) will be able to access it.

### 3.3 Set Environment Variables for Backend

When deploying to Cloud Run, you'll need to set these environment variables:

```bash
GCS_BUCKET_NAME=your-bucket-name
COPY_FUNCTION_URL=https://YOUR-REGION-YOUR-PROJECT-ID.cloudfunctions.net/copyDocumentFunction
```

### 3.4 Directory Structure in Bucket

Your bucket will use prefixes for isolation:
- `school-{schoolId}/` - For teacher-uploaded materials
- `student-{studentId}/` - For student-copied documents

**Example paths:**
- `gs://your-bucket/school-123/lesson1.pdf`
- `gs://your-bucket/student-456/lesson1.pdf`

### 3.5 Test the Backend Locally

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create a `.env` file:
```env
GCS_BUCKET_NAME=your-bucket-name
PORT=5000
```

3. Set up Application Default Credentials:
```bash
gcloud auth application-default login
```

4. Run the server:
```bash
npm start
```

5. Test the signed URL endpoint:
```bash
# First, upload a test file to your bucket:
gsutil cp test.pdf gs://your-bucket/school-123/test.pdf

# Then test the API:
curl http://localhost:5000/api/storage/school/123/test.pdf
```

---

## Step 4: Create Cloud Function (Asynchronous Copy)

### 4.1 Deploy the Cloud Function

Navigate to the Cloud Function directory and deploy:

```bash
cd cloud-functions/copyDocument

# Deploy the function
gcloud functions deploy copyDocumentFunction \
  --gen2 \
  --runtime nodejs18 \
  --region us-central1 \
  --entry-point copy_file_handler \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars BUCKET_NAME=your-bucket-name \
  --memory 256MB \
  --timeout 60s
```

**Note:** 
- Replace `us-central1` with your region
- Replace `your-bucket-name` with your actual bucket name
- The `--allow-unauthenticated` flag allows your Cloud Run service to call it. For production, consider using authentication.

### 4.2 Get the Function URL

After deployment, you'll get a URL like:
```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/copyDocumentFunction
```

Set this as the `COPY_FUNCTION_URL` environment variable in your Cloud Run service.

### 4.3 Test the Cloud Function

You can test the function directly:

```bash
curl -X POST https://YOUR-FUNCTION-URL \
  -H "Content-Type: application/json" \
  -d '{
    "sourcePath": "school-123/document.pdf",
    "destinationPath": "student-456/document.pdf",
    "studentId": "456"
  }'
```

---

## Deploy Backend to Cloud Run (Complete Setup)

### Build and Push Docker Image

```bash
# From project root
cd backend

# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/my-api-service:latest
```

### Deploy to Cloud Run

```bash
gcloud run deploy my-api-service  --image gcr.io/cloud-project-storage-2025/my-api-service:latest --platform managed --region us-central1 --min-instances=0 --max-instances=10 --cpu=1 --memory=512Mi --allow-unauthenticated --set-env-vars GCS_BUCKET_NAME=cloud-storage-bucket-2025 --set-env-vars COPY_FUNCTION_URL=https://us-central1-cloud-project-storage-2025.cloudfunctions.net/copyDocumentFunction 
```

**Key Configuration:**
- `--min-instances=0` - **Critical for cost savings!** Scales to zero when idle
- `--cpu=1 --memory=512Mi` - Right-sized for free tier
- Environment variables are set for bucket name and Cloud Function URL

---


