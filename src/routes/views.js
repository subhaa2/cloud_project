const express = require('express');
const router = express.Router();
const path = require('path');

// Get the project root directory path
// This assumes server.js is in the root and this file is in src/routes/
const projectRoot = path.join(__dirname, '..', '..');

// Route for the main page (Root Path '/')
router.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'login.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'login.html'));
});

// Flashcards and Decks Routes
router.get('/allDecks', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'flashcards', 'all_decks.html'));
});

router.get('/newFlashcard', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'flashcards', 'new_flashcard.html'));
});

router.get('/flashcardLearn', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'flashcards', 'flashcard_learn.html'));
});

// Real-Time Flashcard Competition View
router.get('/flashcardCompetition', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'flashcards', 'flashcard_competition.html'));
});

// NOTE: We are exporting the router object
module.exports = router;