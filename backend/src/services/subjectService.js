const { db, admin } = require('../config/firebase');
const { addSubjectsToTeacherProfile } = require('./userService');

function normalizeSubjectName(name) {
    return name.trim().toLowerCase();
}

function subjectCollection() {
    return db.collection('subjects');
}

async function findSubjectByName({ schoolId, yearId, normalizedName }) {
    let query = subjectCollection().where('schoolId', '==', schoolId).where('normalizedName', '==', normalizedName);

    if (yearId) {
        query = query.where('yearId', '==', yearId);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

function buildSubjectPayload({ schoolId, yearId, name, teacherId }) {
    const trimmedName = name.trim();
    return {
        schoolId,
        yearId: yearId || null,
        name: trimmedName,
        normalizedName: normalizeSubjectName(trimmedName),
        teacherIds: teacherId ? [teacherId] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

async function createSubject({ schoolId, yearId, name, teacherId }) {
    const trimmedName = name ? name.trim() : '';
    if (!trimmedName) {
        throw new Error('Subject name is required');
    }

    const normalizedName = normalizeSubjectName(trimmedName);
    const existing = await findSubjectByName({ schoolId, yearId, normalizedName });
    if (existing) {
        if (teacherId && !existing.teacherIds?.includes(teacherId)) {
            await subjectCollection()
                .doc(existing.id)
                .update({
                    teacherIds: admin.firestore.FieldValue.arrayUnion(teacherId),
                    updatedAt: new Date().toISOString()
                });
        }
        return await getSubjectById(existing.id);
    }

    const payload = buildSubjectPayload({ schoolId, yearId, name: trimmedName, teacherId });
    const docRef = await subjectCollection().doc();
    await docRef.set(payload);
    return { id: docRef.id, ...payload };
}

async function listSubjects({ schoolId, teacherId, yearId, includeTeacherAssignments } = {}) {
    let query = subjectCollection();

    if (schoolId) {
        query = query.where('schoolId', '==', schoolId);
    }

    if (yearId) {
        query = query.where('yearId', '==', yearId);
    }

    if (teacherId) {
        query = query.where('teacherIds', 'array-contains', teacherId);
    }

    const snapshot = await query.get();
    const subjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    if (includeTeacherAssignments) {
        const teacherAssignments = {};

        subjects.forEach(subject => {
            if (!Array.isArray(subject.teacherIds) || subject.teacherIds.length === 0) {
                return;
            }
            subject.teacherIds.forEach(id => {
                if (!teacherAssignments[id]) {
                    teacherAssignments[id] = new Set();
                }
                teacherAssignments[id].add(subject.id);
            });
        });

        for (const [teacherIdKey, subjectIdsSet] of Object.entries(teacherAssignments)) {
            try {
                await addSubjectsToTeacherProfile(teacherIdKey, Array.from(subjectIdsSet));
            } catch (error) {
                console.warn(`Failed to sync teacher assignments for ${teacherIdKey}:`, error.message);
            }
        }
    }

    return subjects;
}

async function getSubjectById(subjectId) {
    const doc = await subjectCollection().doc(subjectId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
}

async function addTeacherToSubject({ subjectId, teacherId }) {
    await subjectCollection().doc(subjectId).update({
        teacherIds: admin.firestore.FieldValue.arrayUnion(teacherId),
        updatedAt: new Date().toISOString()
    });

    return getSubjectById(subjectId);
}

module.exports = {
    createSubject,
    listSubjects,
    getSubjectById,
    addTeacherToSubject
};

