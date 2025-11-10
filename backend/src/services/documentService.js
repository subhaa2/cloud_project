const { db } = require('../config/firebase');

function baseQuery({ schoolId, ownerId, subjectId, weekId }) {
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
    uploadedAt
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
        createdAt: Date.now()
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

module.exports = {
    createDocument,
    listDocuments,
    deleteDocument,
    getDocument
};

