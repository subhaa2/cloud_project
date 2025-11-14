const express = require('express');
const router = express.Router();
const { getUserById, getUsersBySchool } = require('../services/userService');

router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        return res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error getting user:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/school/:schoolId', async (req, res) => {
    const { schoolId } = req.params;
    try {
        const users = await getUsersBySchool(schoolId);
        return res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error('Error getting users by school:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

