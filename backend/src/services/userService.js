const { db, admin } = require('../config/firebase');

async function findUserByEmailAndRole(email, role) {
    const snapshot = await db
        .collection('users')
        .where('email', '==', email)
        .where('role', '==', role)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

async function addUserToSchoolArray(schoolId, field, userId) {
    if (!schoolId) {
        return;
    }

    const schoolRef = db.collection('schools').doc(schoolId);
    await schoolRef.set(
        {
            [field]: admin.firestore.FieldValue.arrayUnion(userId)
        },
        { merge: true }
    );
}

async function createUserDocument(payload, options = {}) {
    const now = new Date().toISOString();
    const { appendToSchoolField } = options;

    const userRef = db.collection('users').doc();
    await userRef.set({
        ...payload,
        createdAt: now,
        updatedAt: now
    });

    if (appendToSchoolField) {
        await addUserToSchoolArray(payload.schoolId, appendToSchoolField, userRef.id);
    }

    const snapshot = await userRef.get();
    return { id: userRef.id, ...snapshot.data() };
}

async function createTeacherUser({ email, schoolId, teachingYears, teachingSubjects }) {
    return createUserDocument(
        {
            email,
            role: 'teacher',
            schoolId,
            teachingYears,
            teachingSubjects
        },
        { appendToSchoolField: 'teacherIds' }
    );
}

async function createStudentUser({ email, schoolId, yearLevel }) {
    const payload = {
        email,
        role: 'student',
        schoolId
    };

    if (yearLevel) {
        payload.yearLevel = yearLevel;
    }

    return createUserDocument(payload, { appendToSchoolField: 'studentIds' });
}

async function findUserForLogin({ email, role, schoolId }) {
    const snapshot = await db
        .collection('users')
        .where('email', '==', email)
        .where('role', '==', role)
        .where('schoolId', '==', schoolId)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

async function addSubjectsToTeacherProfile(teacherId, subjectIds = []) {
    if (!teacherId || !Array.isArray(subjectIds) || subjectIds.length === 0) {
        return;
    }

    const teacherRef = db.collection('users').doc(teacherId);
    const teacherDoc = await teacherRef.get();
    if (!teacherDoc.exists) {
        return;
    }

    await teacherRef.set(
        {
            teachingSubjectIds: admin.firestore.FieldValue.arrayUnion(...subjectIds)
        },
        { merge: true }
    );
}

module.exports = {
    findUserByEmailAndRole,
    createTeacherUser,
    createStudentUser,
    findUserForLogin,
    addSubjectsToTeacherProfile
};

