const express = require('express');
const router = express.Router();

const { listSchools, createSchool, getSchoolById } = require('../services/schoolService');

router.get('/', async (req, res) => {
    try {
        const schools = await listSchools();
        return res.json({
            success: true,
            schools
        });
    } catch (error) {
        console.error('Error fetching schools:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch schools'
        });
    }
});

router.get('/:schoolId', async (req, res) => {
    try {
        const { schoolId } = req.params;
        const school = await getSchoolById(schoolId);
        if (!school) {
            return res.status(404).json({
                success: false,
                error: 'School not found'
            });
        }

        return res.json({
            success: true,
            school
        });
    } catch (error) {
        console.error('Error fetching school:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch school'
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, storageBucketPrefix } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'School name is required'
            });
        }

        try {
            const school = await createSchool({
                name,
                storageBucketPrefix
            });

            return res.status(201).json({
                success: true,
                school
            });
        } catch (error) {
            if (error.code === 'ALREADY_EXISTS') {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error creating school:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create school'
        });
    }
});

module.exports = router;

