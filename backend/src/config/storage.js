// Cloud Storage configuration
const { Storage } = require('@google-cloud/storage');

// Initialize Cloud Storage client
// This uses Application Default Credentials when running on Cloud Run
const storage = new Storage();

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

