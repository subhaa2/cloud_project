const { v4: uuidv4 } = require('uuid');
const { dynamoDB, s3 } = require('../config/aws');

class MaterialService {
    async uploadMaterial(fileBuffer, fileName, metadata) {
        const materialId = uuidv4();
        const s3Key = `schools/${metadata.schoolId}/materials/${materialId}/${fileName}`;

        // Upload to S3
        const s3Params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: metadata.fileType
        };

        await s3.upload(s3Params).promise();

        // Save metadata to DynamoDB
        const material = {
            materialId,
            schoolId: metadata.schoolId,
            classId: metadata.classId,
            subject: metadata.subject,
            title: metadata.title,
            s3Key,
            uploadedBy: metadata.uploadedBy,
            fileType: metadata.fileType,
            fileName,
            createdAt: new Date().toISOString()
        };

        await dynamoDB.put({
            TableName: 'Materials',
            Item: material
        }).promise();

        return material;
    }

    async getMaterialsBySchool(schoolId, classId = null) {
        // Query DynamoDB using GSI
        // Return materials
    }

    async getMaterialById(materialId) {
        // Get from DynamoDB
        // Return material
    }

    async getDownloadUrl(s3Key) {
        // Generate signed URL from S3
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: s3Key,
            Expires: 3600 // 1 hour
        };
        return s3.getSignedUrl('getObject', params);
    }

    async deleteMaterial(materialId) {
        // Get material from DynamoDB
        // Delete from S3
        // Delete from DynamoDB
    }
}

module.exports = new MaterialService();