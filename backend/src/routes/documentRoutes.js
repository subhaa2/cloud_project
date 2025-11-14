const express = require('express');
const router = express.Router();

const {
    createDocument,
    listDocuments,
    deleteDocument,
    getDocument
} = require('../services/documentService');

const { bucket } = require('../config/storage');

router.post('/', async (req, res) => {
    try {
        const {
            title,
            type,
            storagePath,
            ownerId,
            schoolId,
            subjectId,
            weekId,
            size,
            uploadedAt,
            visibility
        } = req.body;

        if (!title || !storagePath || !ownerId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: title, storagePath, ownerId'
            });
        }

        const document = await createDocument({
            title,
            type,
            storagePath,
            ownerId,
            schoolId,
            subjectId,
            weekId,
            size,
            uploadedAt,
            visibility
        });

        return res.status(201).json({
            success: true,
            document
        });
    } catch (error) {
        console.error('Error creating document:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const { schoolId, ownerId, subjectId, weekId, visibility, limit } = req.query;
        const documents = await listDocuments({
            schoolId,
            ownerId,
            subjectId,
            weekId,
            visibility,
            limit: limit ? Number(limit) : undefined
        });

        return res.json({
            success: true,
            documents
        });
    } catch (error) {
        console.error('Error listing documents:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/:documentId', async (req, res) => {
    const { documentId } = req.params;
    try {
        const doc = await getDocument(documentId);
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        if (doc.storagePath) {
            await bucket.file(doc.storagePath).delete({ ignoreNotFound: true });
        }

        await deleteDocument(documentId);

        return res.json({
            success: true
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

