const express = require('express');
const router = express.Router();
const {
    generateSignedUrl,
    generateUploadSignedUrl,
    getSchoolStoragePath,
    getStudentStoragePath,
    copyFile
} = require('../controllers/storageController');
const { BUCKET_NAME } = require('../config/storage');
const { getSchoolById } = require('../services/schoolService');
const { getSubjectById } = require('../services/subjectService');
const { createDocument, getDocument } = require('../services/documentService');

function slugify(value) {
    if (!value) {
        return '';
    }
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildSegment(prefix, value, fallback) {
    const slug = slugify(value);
    if (slug) {
        return prefix ? `${prefix}-${slug}` : slug;
    }
    return fallback || null;
}

async function triggerCopyOperation({ sourcePath, destinationPath, studentId }) {
    const copyFunctionUrl = process.env.COPY_FUNCTION_URL;

    if (!copyFunctionUrl) {
        const error = new Error('Cloud Function URL not configured');
        error.status = 500;
        throw error;
    }

    const response = await fetch(copyFunctionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sourcePath,
            destinationPath,
            studentId
        })
    });

    const result = await response.json();

    if (!response.ok) {
        const error = new Error(result.error || 'Failed to trigger copy operation');
        error.status = response.status;
        throw error;
    }

    return result;
}

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
 * POST /api/storage/upload-url
 * Generate a signed URL for direct uploads to Cloud Storage
 * Body: { ownerId, schoolId, subjectId, weekId, fileName, contentType }
 */
router.post('/upload-url', async (req, res) => {
    try {
        const {
            fileName,
            contentType,
            schoolId,
            ownerId,
            ownerName,
            subjectId,
            subjectName,
            weekId,
            weekName,
            yearId,
            yearLabel
        } = req.body;

        if (!fileName || !contentType || !ownerId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fileName, contentType, ownerId'
            });
        }

        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');

        let schoolSegment = null;
        let resolvedYearLabel = yearLabel || null;
        if (schoolId) {
            try {
                const school = await getSchoolById(schoolId);
                if (school) {
                    const prefixCandidate = school.storageBucketPrefix || school.name || schoolId;
                    schoolSegment = buildSegment(null, prefixCandidate, `school-${schoolId}`);
                    if (!resolvedYearLabel && yearId) {
                        const match = Array.isArray(school.years)
                            ? school.years.find(year => year.id === yearId)
                            : null;
                        if (match) {
                            resolvedYearLabel = match.label || match.name || match.id;
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch school ${schoolId} for storage path:`, error.message);
            }
        }

        if (!schoolSegment) {
            schoolSegment = schoolId ? `school-${slugify(schoolId)}` : 'schools';
        }

        let subjectSegment = null;
        const subjectNameCandidate = subjectName;
        if (subjectNameCandidate) {
            subjectSegment = buildSegment('subject', subjectNameCandidate);
        } else if (subjectId) {
            try {
                const subject = await getSubjectById(subjectId);
                if (subject?.name) {
                    subjectSegment = buildSegment('subject', subject.name);
                }
            } catch (error) {
                console.warn(`Failed to fetch subject ${subjectId} for storage path:`, error.message);
            }
            if (!subjectSegment) {
                subjectSegment = buildSegment('subject', subjectId);
            }
        }

        const yearSegment = resolvedYearLabel
            ? buildSegment('year', resolvedYearLabel)
            : yearId
                ? buildSegment('year', yearId)
                : null;

        const weekSegment = weekName
            ? buildSegment('week', weekName)
            : weekId
                ? buildSegment('week', weekId)
                : null;

        const ownerLabel = ownerName || ownerId;
        const ownerSegment = ownerLabel
            ? buildSegment(null, ownerLabel, ownerId ? `teacher-${ownerId}` : null)
            : ownerId
                ? `teacher-${ownerId}`
                : null;

        const pathParts = [
            schoolSegment,
            yearSegment,
            subjectSegment,
            weekSegment,
            ownerSegment,
            sanitizedFileName
        ].filter(Boolean);

        const storagePath = pathParts.join('/');

        const uploadUrl = await generateUploadSignedUrl(storagePath, contentType);

        return res.json({
            success: true,
            storagePath,
            uploadUrl,
            bucket: BUCKET_NAME
        });
    } catch (error) {
        console.error('Error generating upload URL:', error);
        return res.status(500).json({
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

        const result = await triggerCopyOperation({ sourcePath, destinationPath, studentId });

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

/**
 * POST /api/storage/copy-to-student
 * Copy a school document to a student's personal storage and create metadata
 */
router.post('/copy-to-student', async (req, res) => {
    try {
        const {
            documentId,
            studentId,
            studentName,
            subjectName,
            weekName
        } = req.body;

        if (!documentId || !studentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: documentId, studentId'
            });
        }

        const document = await getDocument(documentId);

        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        if (!document.storagePath) {
            return res.status(400).json({
                success: false,
                error: 'Document does not have an associated storage path'
            });
        }

        const fileNameFromPath = document.storagePath.split('/').pop() || document.title || documentId;
        const sanitizedFileName = fileNameFromPath.replace(/[^a-zA-Z0-9._-]+/g, '-');

        const studentSegment = buildSegment(null, studentName || studentId, `student-${studentId}`);
        const subjectSegment =
            buildSegment('subject', subjectName) ||
            (document.subjectId ? buildSegment('subject', document.subjectId) : null);
        const weekSegment =
            buildSegment('week', weekName) || (document.weekId ? buildSegment('week', document.weekId) : null);

        const destinationPath = [
            'students',
            studentSegment,
            subjectSegment,
            weekSegment,
            sanitizedFileName
        ].filter(Boolean).join('/');

        // Copy the file directly using Cloud Storage SDK
        await copyFile(document.storagePath, destinationPath);

        const copiedDocument = await createDocument({
            title: document.title,
            type: document.type,
            storagePath: destinationPath,
            ownerId: studentId,
            schoolId: document.schoolId || null,
            subjectId: document.subjectId || null,
            weekId: document.weekId || null,
            size: document.size || null,
            uploadedAt: new Date().toISOString(),
            visibility: 'personal'
        });

        res.json({
            success: true,
            storagePath: destinationPath,
            document: copiedDocument
        });
    } catch (error) {
        const status = error.status || 500;
        console.error('Error copying document to student storage:', error);
        res.status(status).json({
            success: false,
            error: error.message || 'Failed to copy document to student storage'
        });
    }
});

/**
 * POST /api/storage/view-url
 * Generate a signed URL for viewing a file by storage path
 * Body: { storagePath }
 */
router.post('/view-url', async (req, res) => {
    try {
        const { storagePath } = req.body;

        if (!storagePath) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: storagePath'
            });
        }

        const signedUrl = await generateSignedUrl(storagePath);

        return res.json({
            success: true,
            signedUrl,
            expiresIn: '15 minutes'
        });
    } catch (error) {
        console.error('Error generating view URL:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/storage/upload-word-content
 * Generate a signed URL for uploading Word document HTML content
 * Body: { documentId, contentType }
 */
router.post('/upload-word-content', async (req, res) => {
    try {
        const { documentId, contentType = 'text/html' } = req.body;

        if (!documentId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: documentId'
            });
        }

        // Use a simple, direct path for Word content
        const fileName = `word-content-${documentId}.html`;
        const storagePath = `word-edits/${documentId}/${fileName}`;

        const uploadUrl = await generateUploadSignedUrl(storagePath, contentType);

        return res.json({
            success: true,
            storagePath,
            uploadUrl,
            bucket: BUCKET_NAME
        });
    } catch (error) {
        console.error('Error generating Word content upload URL:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

