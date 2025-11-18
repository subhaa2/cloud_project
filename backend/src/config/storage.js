// Cloud Storage configuration
const path = require('path');
const { Storage } = require('@google-cloud/storage');

// Initialize Cloud Storage client
// Uses service account file if available (local dev), otherwise uses Application Default Credentials (Cloud Run)
const storageConfig = {};
const serviceAccountPath = path.join(__dirname, '..', '..', 'service-account.json');
const fs = require('fs');

if (fs.existsSync(serviceAccountPath)) {
  // Local development: use service account file
  storageConfig.keyFilename = serviceAccountPath;
}

const storage = new Storage(storageConfig);

// Get bucket name from environment variable
// Set this in Cloud Run: gs://your-bucket-name
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'your-bucket-name';

// Get bucket instance
const bucket = storage.bucket(BUCKET_NAME);

module.exports = {
  storage,
  bucket,
  BUCKET_NAME
};