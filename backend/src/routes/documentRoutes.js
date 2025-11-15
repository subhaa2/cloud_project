const express = require('express');
const router = express.Router();

const {
    createDocument,
    listDocuments,
    deleteDocument,
    getDocument,
    shareDocument,
    createAnnotation,
    listAnnotations,
    listSharedDocuments
} = require('../services/documentService');

const { bucket } = require('../config/storage');
const { db } = require('../config/firebase');

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
        const { schoolId, ownerId, subjectId, weekId, visibility, limit, sharedWith } = req.query;

        // Handle shared documents query
        if (sharedWith) {
            const documents = await listSharedDocuments(sharedWith);
            return res.json({
                success: true,
                documents
            });
        }

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

router.get('/:documentId', async (req, res) => {
    const { documentId } = req.params;
    try {
        const doc = await getDocument(documentId);
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        return res.json({
            success: true,
            document: doc
        });
    } catch (error) {
        console.error('Error getting document:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.patch('/:documentId', async (req, res) => {
    const { documentId } = req.params;
    const { content, lastModifiedBy } = req.body;

    try {
        const docRef = db.collection('documents').doc(documentId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const updateData = {
            updatedAt: Date.now()
        };

        if (content !== undefined) {
            updateData.content = content;
        }

        if (lastModifiedBy) {
            updateData.lastModifiedBy = lastModifiedBy;
            updateData.lastModified = Date.now();
        }

        await docRef.update(updateData);

        const updatedDoc = await docRef.get();
        return res.json({
            success: true,
            document: { id: updatedDoc.id, ...updatedDoc.data() }
        });
    } catch (error) {
        console.error('Error updating document:', error);
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

router.post('/:documentId/share', async (req, res) => {
    const { documentId } = req.params;
    const { userId } = req.body;

    try {
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const result = await shareDocument(documentId, userId);
        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error sharing document:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/:documentId/annotations', async (req, res) => {
    const { documentId } = req.params;
    const annotationData = req.body;

    try {
        const annotation = await createAnnotation(documentId, annotationData);
        return res.status(201).json({
            success: true,
            annotation
        });
    } catch (error) {
        console.error('Error creating annotation:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:documentId/annotations', async (req, res) => {
    const { documentId } = req.params;

    try {
        const annotations = await listAnnotations(documentId);
        return res.json({
            success: true,
            annotations
        });
    } catch (error) {
        console.error('Error listing annotations:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:documentId/view-url', async (req, res) => {
    const { documentId } = req.params;
    const { generateSignedUrl } = require('../controllers/storageController');

    try {
        const doc = await getDocument(documentId);
        if (!doc) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        if (!doc.storagePath) {
            return res.status(400).json({
                success: false,
                error: 'Document does not have a storage path'
            });
        }

        const signedUrl = await generateSignedUrl(doc.storagePath);

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

module.exports = router;

