const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

const FALLBACK_USER_ID = 'default-user-server-side';

// Helper function to construct the DECK collection reference (The direct path)
// Path: /flashcardSets/{subjectId}/users/{userId}/decks
function getDeckCollectionRef(db, userId, subject) {
    // The path must alternate: Collection -> Document -> Collection -> Document...
    return db
        .collection('flashcardSets') // Collection (Root)
        .doc(subject)              // Document: The Subject ID
        .collection('users')       // Collection: 'users' (A fixed collection name)
        .doc(userId)               // Document: The User ID
        .collection('decks');      // Collection: 'decks'
}

// Path for the COMPETITIONS collection: /competitions (Global)
function getCompetitionCollectionRef(db) {
    // This collection is global and not user-specific
    return db.collection('flashcardCompetitions');
}

// Middleware to inject the db instance and userId
router.use((req, res, next) => {
    req.db = req.app.locals.db;
    req.activeCompetitions = req.app.locals.activeCompetitions; // Inject active competitions store

    const authenticatedUserId = req.header('x-user-id');

    req.userId = authenticatedUserId || FALLBACK_USER_ID;

    if (!req.db) {
        console.error("Firestore DB instance not found on request locals.");
        return res.status(500).json({ message: 'Database connection error.' });
    }


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
    const deckCollectionRef = getDeckCollectionRef(db, userId, subjectId);

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
    const subject = req.query.subjectId || 'uncategorized'; // Get subject from url, default to uncategorized


    try {

        // Use the direct path to the user's deck subcollection
        const deckCollectionRef = getDeckCollectionRef(db, userId, subject);

        const snapshot = await deckCollectionRef.get();

        if (snapshot.empty) {
            console.log(`No decks found for subject ${subject} or user: ${userId}`);
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
        console.error('Error details:', error.code, error.message, error.details);
        // Make sure to send a proper response even on error
        res.status(500).json({
            message: 'Internal server error during deck listing.',
            error: error.message || 'Unknown error'
        });
    }
});


// --- GET /api/decks/:deckId (Load a single deck) ---
router.get('/:deckId', async (req, res) => {
    const deckId = req.params.deckId;
    const db = req.db;
    const userId = req.userId;
    const subject = req.query.subjectId; // Get subject from url 

    try {
        // Use the direct path helper to get the collection reference
        const deckCollectionRef = getDeckCollectionRef(db, userId, subject);

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
router.delete('/:deckId', async (req, res) => {
    const deckId = req.params.deckId;
    const db = req.db;
    const userId = req.userId;
    const subject = req.query.subjectId; // Get subject from url z

    if (!subject) {
        return res.status(400).json({ message: 'Subject ID is required for deck deletion.' });
    }

    try {
        // Use the direct path helper
        const deckCollectionRef = getDeckCollectionRef(db, userId, subject);

        // Delete the specific document
        await deckCollectionRef.doc(deckId).delete();

        res.status(200).json({ message: `Deck ${deckId} successfully deleted for user ${userId}.` });
    } catch (error) {
        console.error(`Error deleting deck ${deckId} from Firestore for user ${userId} using Direct Path:`, error);
        res.status(500).json({ message: 'Internal server error during deck deletion.' });
    }
});


// ==========================================================
// COMPETITION API ROUTES
// ==========================================================

// --- GET /api/decks/competition/:competitionId (Phase 1/2: Load Competition State) ---
router.get('/competition/:competitionId', async (req, res) => {
    const db = req.db;
    const competitionId = req.params.competitionId;
    const activeCompetitions = req.activeCompetitions;

    // First, check the fast in-memory store
    if (activeCompetitions[competitionId]) {
        return res.status(200).json(activeCompetitions[competitionId]);
    }

    try {
        // Fallback to Firestore
        const compDoc = await db.collection('competitions').doc(competitionId).get();

        if (!compDoc.exists) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        const compData = compDoc.data();

        // If loaded from Firestore and active, initialize the in-memory state
        // This ensures the server can recover sessions after a restart
        if (compData.status === 'ACTIVE') {
            activeCompetitions[competitionId] = {
                id: competitionId,
                status: 'ACTIVE',
                // PlayerA's goal is B's deck size
                playerA: {
                    userId: compData.playerA.userId,
                    username: compData.playerA.username,
                    deckId: compData.playerA.deckId,
                    deckName: compData.playerA.deckName,
                    deckSize: compData.playerB.deckSize,
                    score: 0,
                    percent: 0
                },
                // PlayerB's goal is A's deck size
                playerB: {
                    userId: compData.playerB.userId,
                    username: compData.playerB.username,
                    deckId: compData.playerB.deckId,
                    deckName: compData.playerB.deckName,
                    deckSize: compData.playerA.deckSize,
                    score: 0,
                    percent: 0
                },
            };
            return res.status(200).json(activeCompetitions[competitionId]);
        }


        res.status(200).json(compData); // Return PENDING or FINISHED state

    } catch (error) {
        console.error(`Error loading competition ${competitionId} from Firestore:`, error);
        res.status(500).json({ message: 'Internal server error during competition load.' });
    }
});


// --- POST /api/decks/challenge (Phase 1: Challenge Initiation) ---
router.post('/challenge', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const activeCompetitions = req.activeCompetitions;
    const { deckId, deckName, deckSize } = req.body;

    if (!deckId) {
        return res.status(400).json({ message: 'Missing deckId for challenge.' });
    }

    try {
        // Create PENDING competition document in a public collection
        const competitionId = deckId;
        const compDocRef = db.collection('flashcardCompetitions').doc(competitionId);;


        const competitionData = {
            status: 'PENDING',
            playerA: { userId, deckId, deckName, deckSize, score: 0 },
            playerB: null, // To be filled by the challenger
            challengeLink: `/flashcardCompetition?competitionId=${competitionId}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await compDocRef.set(competitionData);

        // Add to in-memory store for real-time tracking (minimal initial state)
        activeCompetitions[competitionId] = {
            id: competitionId,
            status: 'PENDING',
            // deckSize here represents the *size of the deck they are studying*, which for player A is TBD (player B's deck size)
            playerA: { userId, deckId, deckName, score: 0, percent: 0, deckSize: null },
            playerB: null,
            // Store A's own deck size separately to set B's goal upon acceptance
            playerADeckSize: deckSize
        };

        // Respond with the link
        res.status(201).json({
            message: 'Challenge created.',
            competitionId,
            challengeLink: competitionData.challengeLink
        });

    } catch (error) {
        console.error("Error initiating challenge in Firestore:", error);
        res.status(500).json({ message: 'Internal server error during challenge creation.' });
    }
});

// --- POST /api/decks/accept/:competitionId (Phase 1: Acceptance) ---
router.post('/accept/:competitionId', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const activeCompetitions = req.activeCompetitions;
    const competitionId = req.params.competitionId;
    const { deckId: playerBDeckId, deckName: playerBDeckName, deckSize: playerBDeckSize, username: playerBUsername } = req.body;

    if (!playerBDeckId || !playerBUsername || typeof playerBDeckSize !== 'number') {
        console.error('Acceptance failed: Missing fields in body or body was empty.', {
            deckId: playerBDeckId,
            username: playerBUsername,
            deckSize: playerBDeckSize
        });
        return res.status(400).json({ message: 'Missing deck details or username for acceptance.' });
    }

    const compDocRef = db.collection('flashcardCompetitions').doc(competitionId);

    try {
        const doc = await compDocRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: 'Competition not found.' });
        }

        const compData = doc.data();

        if (compData.status !== 'PENDING') {
            return res.status(400).json({ message: `Competition is already ${compData.status}.` });
        }
        if (compData.playerA.userId === userId) {
            return res.status(400).json({ message: 'Cannot challenge yourself.' });
        }

        // Update Firestore
        const playerB = {
            userId,
            username: playerBUsername,
            deckId: playerBDeckId,
            deckName: playerBDeckName,
            deckSize: playerBDeckSize, // B's own deck size
            score: 0
        };

        await compDocRef.update({
            status: 'ACTIVE',
            playerB: playerB,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update in-memory session (Critical for Socket.IO state)
        const comp = activeCompetitions[competitionId];
        if (comp) {
            comp.status = 'ACTIVE';
            comp.playerB = {
                userId,
                username: playerBUsername,
                deckId: playerBDeckId,
                deckName: playerBDeckName,
                score: 0,
                percent: 0,
                deckSize: comp.playerADeckSize // B studies A's deck, set B's goal to A's deck size
            };

            // A studies B's deck, set A's goal to B's deck size
            comp.playerA.deckSize = playerBDeckSize;

            // Remove temporary variable
            delete comp.playerADeckSize;
        }

        res.status(200).json({
            message: 'Challenge accepted. Competition is now active.',
            competitionId,
            redirectUrl: `/flashcardCompetition?competitionId=${competitionId}`
        });

    } catch (error) {
        console.error(`Error accepting challenge ${competitionId}:`, error);
        res.status(500).json({ message: 'Internal server error during challenge acceptance.' });
    }
});

// --- GET /api/decks//:userId/:deckId (Load a single deck from opponent) ---
router.get('/:userId/:deckId', async (req, res) => {
    const deckId = req.params.deckId;
    const db = req.db;
    const userId = req.params.userId;
    const subject = req.query.subjectId; // Get subject from url 


    try {
        // Get decks from specific user (opponent)
        const deckCollectionRef = db.collection('flashcardSets').doc(subject).collection('users').doc(userId).collection('decks');

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

module.exports = router;