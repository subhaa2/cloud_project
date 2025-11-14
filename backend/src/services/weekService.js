const { db } = require('../config/firebase');

function weekCollection() {
    return db.collection('weeks');
}

function buildWeekPayload({ schoolId, subjectId, yearId, name, order, teacherId }) {
    return {
        schoolId,
        subjectId,
        yearId: yearId || null,
        name: name.trim(),
        order: typeof order === 'number' ? order : null,
        teacherId: teacherId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

async function createWeek({ schoolId, subjectId, yearId, name, order, teacherId }) {
    if (!name || !name.trim()) {
        throw new Error('Week name is required');
    }

    if (!subjectId) {
        throw new Error('subjectId is required');
    }

    const payload = buildWeekPayload({ schoolId, subjectId, yearId, name, order, teacherId });
    const docRef = await weekCollection().doc();
    await docRef.set(payload);
    return { id: docRef.id, ...payload };
}

async function listWeeks({ subjectId, teacherId } = {}) {
    let query = weekCollection();

    // subjectId is required - always filter by it
    if (!subjectId) {
        throw new Error('subjectId is required to list weeks');
    }

    query = query.where('subjectId', '==', subjectId);

    // Only add teacherId filter if provided (optional)
    if (teacherId) {
        query = query.where('teacherId', '==', teacherId);
    }

    const snapshot = await query.get();

    const weeks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return weeks.sort((a, b) => {
        if (typeof a.order === 'number' && typeof b.order === 'number') {
            return a.order - b.order;
        }
        if (typeof a.order === 'number') return -1;
        if (typeof b.order === 'number') return 1;
        return (a.name || '').localeCompare(b.name || '');
    });
}

module.exports = {
    createWeek,
    listWeeks
};

