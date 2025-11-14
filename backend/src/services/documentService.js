const { db } = require('../config/firebase');

function baseQuery({ schoolId, ownerId, subjectId, weekId, visibility }) {
    let ref = db.collection('documents');

    if (schoolId) {
        ref = ref.where('schoolId', '==', schoolId);
    }

    if (ownerId) {
        ref = ref.where('ownerId', '==', ownerId);
    }

    if (subjectId) {
        ref = ref.where('subjectId', '==', subjectId);
    }

    if (weekId) {
        ref = ref.where('weekId', '==', weekId);
    }

    if (visibility) {
        ref = ref.where('visibility', '==', visibility);
    }

    return ref;
}

async function createDocument({
    title,
    type,
    storagePath,
    ownerId,
    schoolId,
    subjectId,
    weekId,
    size,
    uploadedAt,
    visibility = 'school'
}) {
    const doc = {
        title,
        type,
        storagePath,
        ownerId,
        schoolId: schoolId || null,
        subjectId: subjectId || null,
        weekId: weekId || null,
        size: size || null,
        uploadedAt: uploadedAt || Date.now(),
        createdAt: Date.now(),
        visibility: visibility || 'school'
    };

    const docRef = await db.collection('documents').add(doc);
    const snapshot = await docRef.get();
    return { id: docRef.id, ...snapshot.data() };
}

async function listDocuments(filter = {}) {
    let query = baseQuery(filter);

    if (filter.limit) {
        query = query.limit(filter.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function listSharedDocuments(userId) {
    // Get documents where user is in sharedWith array
    const snapshot = await db.collection('documents')
        .where('sharedWith', 'array-contains', userId)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function deleteDocument(documentId) {
    await db.collection('documents').doc(documentId).delete();
}

async function getDocument(documentId) {
    const doc = await db.collection('documents').doc(documentId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
}

async function shareDocument(documentId, userId) {
    const docRef = db.collection('documents').doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error('Document not found');
    }

    // Verify user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
        throw new Error('User not found');
    }

    // Add to sharedWith array
    const currentData = doc.data();
    const sharedWith = currentData.sharedWith || [];

    if (!sharedWith.includes(userId)) {
        sharedWith.push(userId);
        await docRef.update({
            sharedWith: sharedWith,
            updatedAt: Date.now()
        });
    }

    return { success: true, userId };
}

async function createAnnotation(documentId, annotationData) {
    const annotationRef = db.collection('documents')
        .doc(documentId)
        .collection('annotations')
        .doc();

    const annotation = {
        ...annotationData,
        createdAt: Date.now(),
        documentId: documentId
    };

    await annotationRef.set(annotation);
    const snapshot = await annotationRef.get();
    return { id: annotationRef.id, ...snapshot.data() };
}

async function listAnnotations(documentId) {
    const snapshot = await db.collection('documents')
        .doc(documentId)
        .collection('annotations')
        .orderBy('createdAt', 'desc')
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

module.exports = {
    createDocument,
    listDocuments,
    deleteDocument,
    getDocument,
    shareDocument,
    createAnnotation,
    listAnnotations,
    listSharedDocuments
};

