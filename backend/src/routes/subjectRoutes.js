const express = require('express');
const router = express.Router();

const {
    createSubject,
    listSubjects,
    getSubjectById,
    addTeacherToSubject
} = require('../services/subjectService');

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

router.get('/', async (req, res) => {
    try {
        const { schoolId, teacherId, yearId } = req.query;
        const subjects = await listSubjects({
            schoolId,
            teacherId,
            yearId,
            includeTeacherAssignments: !teacherId
        });

        return res.json({
            success: true,
            subjects
        });
    } catch (error) {
        console.error('Error listing subjects:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch subjects'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { schoolId, yearId, name, teacherId } = req.body;

        if (!isNonEmptyString(schoolId) || !isNonEmptyString(name)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: schoolId, name'
            });
        }

        const subject = await createSubject({
            schoolId,
            yearId: isNonEmptyString(yearId) ? yearId : null,
            name,
            teacherId: isNonEmptyString(teacherId) ? teacherId : null
        });

        return res.status(201).json({
            success: true,
            subject
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to create subject'
        });
    }
});

router.post('/:subjectId/teachers', async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { teacherId } = req.body;

        if (!isNonEmptyString(subjectId) || !isNonEmptyString(teacherId)) {
            return res.status(400).json({
                success: false,
                error: 'subjectId and teacherId are required'
            });
        }

        const subject = await getSubjectById(subjectId);
        if (!subject) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }

        const updated = await addTeacherToSubject({ subjectId, teacherId });
        return res.json({
            success: true,
            subject: updated
        });
    } catch (error) {
        console.error('Error adding teacher to subject:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update subject'
        });
    }
});

module.exports = router;

