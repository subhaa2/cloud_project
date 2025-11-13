const express = require('express');
const router = express.Router();

const {
    findUserByEmailAndRole,
    createTeacherUser,
    createStudentUser,
    findUserForLogin
} = require('../services/userService');

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function validateArrayField(value) {
    return Array.isArray(value) && value.length > 0;
}

router.post('/signup', async (req, res) => {
    try {
        const { role, email, schoolId } = req.body;

        if (!isNonEmptyString(role) || !isNonEmptyString(email) || !isNonEmptyString(schoolId)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: role, email, schoolId'
            });
        }

        const normalizedRole = role.toLowerCase();

        if (!['teacher', 'student'].includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role. Expected "teacher" or "student"'
            });
        }

        const existingUser = await findUserByEmailAndRole(email, normalizedRole);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User with the same email and role already exists'
            });
        }

        if (normalizedRole === 'teacher') {
            const { teachingYears, teachingSubjects } = req.body;

            if (!validateArrayField(teachingYears) || !validateArrayField(teachingSubjects)) {
                return res.status(400).json({
                    success: false,
                    error: 'Teacher signup requires non-empty teachingYears and teachingSubjects arrays'
                });
            }

            const user = await createTeacherUser({
                email,
                schoolId,
                teachingYears,
                teachingSubjects
            });

            return res.status(201).json({
                success: true,
                user
            });
        }

        const { yearLevel } = req.body;
        const user = await createStudentUser({
            email,
            schoolId,
            yearLevel: isNonEmptyString(yearLevel) ? yearLevel : undefined
        });

        return res.status(201).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error handling signup:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to complete signup'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { role, email, schoolId } = req.body;

        if (!isNonEmptyString(role) || !isNonEmptyString(email) || !isNonEmptyString(schoolId)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: role, email, schoolId'
            });
        }

        const normalizedRole = role.toLowerCase();

        if (!['teacher', 'student'].includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role. Expected "teacher" or "student"'
            });
        }

        const user = await findUserForLogin({
            email,
            role: normalizedRole,
            schoolId
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'No matching account found. Please check your details or sign up first.'
            });
        }

        return res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to complete login'
        });
    }
});

module.exports = router;

