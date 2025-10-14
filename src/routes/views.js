const express = require('express');
const router = express.Router();
const path = require('path');

// Get the project root directory path
// This assumes server.js is in the root and this file is in src/routes/
const projectRoot = path.join(__dirname, '..', '..');

// Route for the main page (Root Path '/')
router.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'main.html'));
});

// Route for the new flashcard creation page
router.get('/newFlashcard', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'new_flashcard.html'));
});

// NOTE: We are exporting the router object
module.exports = router;