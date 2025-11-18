const { bucket } = require('../config/storage');

/**
 * Generate a signed URL for accessing a file in Cloud Storage
 * This ensures secure, temporary access to files
 * 
 * @param {string} filePath - Path to the file in the bucket (e.g., 'school-123/document.pdf')
 * @param {number} expirationMinutes - How long the URL should be valid (default: 15 minutes)
 * @returns {Promise<string>} - Signed URL
 */
async function generateSignedUrl(filePath, expirationMinutes = 15) {
    try {
        const file = bucket.file(filePath);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Generate signed URL valid for specified duration
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expirationMinutes * 60 * 1000,
        });

        return url;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw error;
    }
}

/**
 * Generate a signed URL for uploading a file to Cloud Storage
 * Enables clients to upload directly without exposing credentials
 *
 * @param {string} filePath - Path to the file to create/update
 * @param {string} contentType - MIME type for the upload
 * @param {number} expirationMinutes - URL validity duration
 * @returns {Promise<string>} - Signed URL for PUT upload
 */
async function generateUploadSignedUrl(filePath, contentType, expirationMinutes = 15) {
    try {
        const file = bucket.file(filePath);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + expirationMinutes * 60 * 1000,
            contentType
        });

        return url;
    } catch (error) {
        console.error('Error generating upload signed URL:', error);
        throw error;
    }
}

/**
 * Get file path for school storage
 * @param {string} schoolId - School identifier
 * @param {string} fileName - Name of the file
 */
function getSchoolStoragePath(schoolId, fileName) {
    return `school-${schoolId}/${fileName}`;
}

/**
 * Get file path for student storage
 * @param {string} studentId - Student identifier
 * @param {string} fileName - Name of the file
 */
function getStudentStoragePath(studentId, fileName) {
    return `student-${studentId}/${fileName}`;
}

/**
 * Copy a file from source path to destination path in Cloud Storage
 * @param {string} sourcePath - Source file path in bucket
 * @param {string} destinationPath - Destination file path in bucket
 * @returns {Promise<void>}
 */
async function copyFile(sourcePath, destinationPath) {
    try {
        const sourceFile = bucket.file(sourcePath);
        const destinationFile = bucket.file(destinationPath);

        // Check if source file exists
        const [exists] = await sourceFile.exists();
        if (!exists) {
            throw new Error(`Source file not found: ${sourcePath}`);
        }

        // Copy the file
        await sourceFile.copy(destinationFile);
    } catch (error) {
        console.error('Error copying file:', error);
        throw error;
    }
}

module.exports = {
    generateSignedUrl,
    generateUploadSignedUrl,
    getSchoolStoragePath,
    getStudentStoragePath,
    copyFile
};

