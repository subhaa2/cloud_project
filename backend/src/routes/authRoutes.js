const express = require('express');
const router = express.Router();

const {
    findUserByEmailAndRole,
    createTeacherUser,
    createStudentUser,
    findUserForLogin
} = require('../services/userService');
const { createSubject } = require('../services/subjectService');

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

            const assignmentKeys = new Set();
            const subjectAssignments = [];
            teachingYears.forEach(yearId => {
                teachingSubjects.forEach(subjectName => {
                    const trimmed = subjectName.trim();
                    if (!trimmed) {
                        return;
                    }
                    const key = `${yearId}::${trimmed.toLowerCase()}`;
                    if (assignmentKeys.has(key)) {
                        return;
                    }
                    assignmentKeys.add(key);
                    subjectAssignments.push({
                        yearId,
                        subjectName: trimmed
                    });
                });
            });

            const user = await createTeacherUser({
                email,
                schoolId,
                teachingYears,
                teachingSubjects
            });

            const createdSubjects = [];
            for (const assignment of subjectAssignments) {
                if (!assignment.subjectName) {
                    continue;
                }
                try {
                    const subject = await createSubject({
                        schoolId,
                        yearId: assignment.yearId,
                        name: assignment.subjectName,
                        teacherId: user.id
                    });
                    createdSubjects.push(subject);
                } catch (creationError) {
                    console.warn('Failed to ensure subject during teacher signup:', creationError.message);
                }
            }

            return res.status(201).json({
                success: true,
                user,
                subjects: createdSubjects
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

