const { db } = require('../config/firebase');

function normalizeName(name) {
    return name.trim().toLowerCase();
}

function createStoragePrefix(name) {
    return normalizeName(name)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `school-${Date.now()}`;
}

async function listSchools() {
    const snapshot = await db.collection('schools').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function findExistingByName(trimmedName, normalizedName) {
    const collection = db.collection('schools');

    const [exactSnapshot, normalizedSnapshot] = await Promise.all([
        collection.where('name', '==', trimmedName).limit(1).get(),
        collection.where('normalizedName', '==', normalizedName).limit(1).get()
    ]);

    if (!exactSnapshot.empty) {
        const doc = exactSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    if (!normalizedSnapshot.empty) {
        const doc = normalizedSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    const fallbackSnapshot = await collection.get();
    for (const doc of fallbackSnapshot.docs) {
        const data = doc.data() || {};
        if (data.name && normalizeName(data.name) === normalizedName) {
            return { id: doc.id, ...data };
        }
    }

    return null;
}

async function createSchool({ name, storageBucketPrefix }) {
    const trimmedName = name.trim();
    const normalizedName = normalizeName(trimmedName);

    const existing = await findExistingByName(trimmedName, normalizedName);
    if (existing) {
        const error = new Error('A school with this name already exists');
        error.code = 'ALREADY_EXISTS';
        throw error;
    }

    const schoolRef = db.collection('schools').doc();
    const payload = {
        name: trimmedName,
        normalizedName,
        storageBucketPrefix: storageBucketPrefix || createStoragePrefix(trimmedName),
        teacherIds: [],
        studentIds: [],
        createdAt: new Date().toISOString()
    };

    await schoolRef.set(payload);
    const snapshot = await schoolRef.get();
    return { id: schoolRef.id, ...snapshot.data() };
}

module.exports = {
    listSchools,
    createSchool
};

