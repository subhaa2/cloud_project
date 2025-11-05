const express = require('express');
const router = express.Router();
const {
    generateSignedUrl,
    getSchoolStoragePath,
    getStudentStoragePath
} = require('../controllers/storageController');

/**
 * GET /api/storage/school/:schoolId/:fileName
 * Generate signed URL for a school document
 */
router.get('/school/:schoolId/:fileName', async (req, res) => {
    try {
        const { schoolId, fileName } = req.params;
        const filePath = getSchoolStoragePath(schoolId, fileName);

        const signedUrl = await generateSignedUrl(filePath);

        res.json({
            success: true,
            signedUrl,
            expiresIn: '15 minutes'
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/storage/student/:studentId/:fileName
 * Generate signed URL for a student's copied document
 */
router.get('/student/:studentId/:fileName', async (req, res) => {
    try {
        const { studentId, fileName } = req.params;
        const filePath = getStudentStoragePath(studentId, fileName);

        const signedUrl = await generateSignedUrl(filePath);

        res.json({
            success: true,
            signedUrl,
            expiresIn: '15 minutes'
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/storage/copy
 * Trigger async copy operation via Cloud Function
 * Body: { sourcePath, destinationPath, studentId }
 */
router.post('/copy', async (req, res) => {
    try {
        const { sourcePath, destinationPath, studentId } = req.body;

        if (!sourcePath || !destinationPath || !studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sourcePath, destinationPath, studentId'
            });
        }

        // Get Cloud Function URL from environment variable
        const copyFunctionUrl = process.env.COPY_FUNCTION_URL;

        if (!copyFunctionUrl) {
            return res.status(500).json({
                success: false,
                error: 'Cloud Function URL not configured'
            });
        }

        // Make HTTP request to Cloud Function
        // Using built-in fetch (Node.js 18+)
        const response = await fetch(copyFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sourcePath,
                destinationPath,
                studentId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: result.error || 'Failed to trigger copy operation'
            });
        }

        res.json({
            success: true,
            message: 'Copy operation started',
            jobId: result.jobId || null
        });
    } catch (error) {
        console.error('Error triggering copy function:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

