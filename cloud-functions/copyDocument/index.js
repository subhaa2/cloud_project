/**
 * Cloud Function: Copy Document
 * 
 * This function handles asynchronous copying of files from School Storage
 * to Student Storage in Cloud Storage.
 * 
 * Trigger: HTTP request from Cloud Run backend
 */

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

// Get bucket name from environment variable
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || process.env.BUCKET_NAME;

/**
 * HTTP Cloud Function entry point
 * Expected request body:
 * {
 *   "sourcePath": "school-123/document.pdf",
 *   "destinationPath": "student-456/document.pdf",
 *   "studentId": "456"
 * }
 */
exports.copy_file_handler = async (req, res) => {
    // Set CORS headers for cross-origin requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { sourcePath, destinationPath, studentId } = req.body;

        // Validate required parameters
        if (!sourcePath || !destinationPath || !studentId) {
            return res.status(400).json({
                error: 'Missing required fields: sourcePath, destinationPath, studentId'
            });
        }

        if (!BUCKET_NAME) {
            return res.status(500).json({
                error: 'Bucket name not configured'
            });
        }

        const bucket = storage.bucket(BUCKET_NAME);
        const sourceFile = bucket.file(sourcePath);
        const destinationFile = bucket.file(destinationPath);

        // Check if source file exists
        const [sourceExists] = await sourceFile.exists();
        if (!sourceExists) {
            return res.status(404).json({
                error: `Source file not found: ${sourcePath}`
            });
        }

        // Perform the copy operation
        await sourceFile.copy(destinationFile);

        console.log(`Successfully copied ${sourcePath} to ${destinationPath}`);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'File copied successfully',
            sourcePath,
            destinationPath,
            studentId
        });

    } catch (error) {
        console.error('Error copying file:', error);
        res.status(500).json({
            error: 'Failed to copy file',
            message: error.message
        });
    }
};

