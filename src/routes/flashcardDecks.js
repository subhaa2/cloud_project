const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const FALLBACK_USER_ID = 'default-user-server-side';

// Helper function to construct the DECK collection reference (The direct path)
// Path: /flashcardSets/{userId}/decks
function getDeckCollectionRef(db, userId) {
    // This creates a direct reference to the subcollection of decks for the specific user.
    return db
        .collection('flashcardSets')
        .doc(userId) // Anchor the path directly with the user's ID
        .collection('decks'); // The collection of decks for this user
}

// Middleware to inject the db instance and userId
router.use((req, res, next) => {
    req.db = req.app.locals.db;

    const authenticatedUserId = req.header('x-user-id');

    req.userId = authenticatedUserId || FALLBACK_USER_ID;

    if (!req.db) {
        console.error("Firestore DB instance not found on request locals.");
        return res.status(500).json({ message: 'Database connection error.' });
    }

    console.log(`API call processing for User ID: ${req.userId}`);

    next();
});

// --- POST /api/decks (Create or Update) ---
router.post('/', async (req, res) => {
    const { id, name, subject, cards } = req.body;
    const db = req.db;
    const userId = req.userId;

    if (!cards) {
        return res.status(400).json({ message: 'Missing cards array in request body.' });
    }

    await db.collection('flashcardSets').doc(userId).set({}, { merge: true });

    const subjectId = subject || 'uncategorized';
    // Use the direct path helper
    const deckCollectionRef = getDeckCollectionRef(db, userId);

    const deckData = {
        name: name || 'Untitled Deck',
        subject: subjectId, // Subject is still stored as metadata
        cards: cards,
        userId: userId, // Keep this for future Collection Group queries if needed
    };

    try {
        if (id) {
            await deckCollectionRef.doc(id).set(deckData, { merge: true });
            res.status(200).json({ status: 'updated', deckId: id });
        } else {
            const newDocRef = await deckCollectionRef.add(deckData);
            res.status(201).json({ status: 'created', deckId: newDocRef.id });
        }
    } catch (error) {
        console.error(`Error saving deck ${id || 'new'} to Firestore:`, error);
        res.status(500).json({ message: 'Internal server error during deck save.' });
    }
});


// --- GET /api/decks (List all decks) ---
router.get('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;


    try {

        // Use the direct path to the user's deck subcollection
        const deckCollectionRef = getDeckCollectionRef(db, userId);

        const allDecksQuery = deckCollectionRef.orderBy('name', 'desc');

        const snapshot = await allDecksQuery.get();

        if (snapshot.empty) {
            console.log(`No decks found for user: ${userId}`);
            return res.status(200).json([]); // Return empty array if no decks are found
        }


        const decks = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                subject: data.subject,
                cardCount: data.cards ? data.cards.length : 0,
            };
        });

        res.status(200).json(decks);

    } catch (error) {
        console.error(`Error listing all decks from Firestore for user ${userId} using Direct Path:`, error);
        res.status(500).json({ message: 'Internal server error during deck listing.' });
    }
});


// --- GET /api/decks/:deckId (Load a single deck) ---
// *** FIX: Changed to direct path query. ***
router.get('/:deckId', async (req, res) => {
    const deckId = req.params.deckId;
    const db = req.db;
    const userId = req.userId;


    try {
        // Use the direct path helper to get the collection reference
        const deckCollectionRef = getDeckCollectionRef(db, userId);

        // Get the specific document reference
        const doc = await deckCollectionRef.doc(deckId).get();

        if (!doc.exists) {
            return res.status(404).json({ message: `Deck with ID ${deckId} not found for user ${userId}.` });
        }

        const deckContent = doc.data();

        res.status(200).json({
            id: doc.id,
            name: deckContent.name,
            subject: deckContent.subject,
            cards: deckContent.cards || [],
        });

    } catch (error) {
        console.error(`Error loading deck ${deckId} from Firestore for user ${userId} using Direct Path:`, error);
        res.status(500).json({ message: 'Internal server error during deck load.' });
    }
});


// --- DELETE /api/decks/:deckId ---
// *** FIX: Changed to direct path deletion. ***
router.delete('/:deckId', async (req, res) => {
    const deckId = req.params.deckId;
    const db = req.db;
    const userId = req.userId;


    try {
        // Use the direct path helper
        const deckCollectionRef = getDeckCollectionRef(db, userId);

        // Delete the specific document
        await deckCollectionRef.doc(deckId).delete();

        res.status(200).json({ message: `Deck ${deckId} successfully deleted for user ${userId}.` });
    } catch (error) {
        console.error(`Error deleting deck ${deckId} from Firestore for user ${userId} using Direct Path:`, error);
        res.status(500).json({ message: 'Internal server error during deck deletion.' });
    }
});

module.exports = router;