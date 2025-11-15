const express = require('express');
const router = express.Router();

const { createWeek, listWeeks } = require('../services/weekService');

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

router.get('/', async (req, res) => {
    try {
        const { subjectId, teacherId } = req.query;
        if (!isNonEmptyString(subjectId)) {
            return res.status(400).json({
                success: false,
                error: 'subjectId is required'
            });
        }

        const weeks = await listWeeks({
            subjectId,
            teacherId: isNonEmptyString(teacherId) ? teacherId : null
        });

        return res.json({
            success: true,
            weeks
        });
    } catch (error) {
        console.error('Error listing weeks:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch weeks'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { schoolId, subjectId, yearId, name, order, teacherId } = req.body;

        if (!isNonEmptyString(subjectId) || !isNonEmptyString(name)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: subjectId, name'
            });
        }

        const week = await createWeek({
            schoolId: isNonEmptyString(schoolId) ? schoolId : null,
            subjectId,
            yearId: isNonEmptyString(yearId) ? yearId : null,
            name,
            order: typeof order === 'number' ? order : null,
            teacherId: isNonEmptyString(teacherId) ? teacherId : null
        });

        return res.status(201).json({
            success: true,
            week
        });
    } catch (error) {
        console.error('Error creating week:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to create week'
        });
    }
});

module.exports = router;

