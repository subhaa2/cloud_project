const express = require('express');
const app = express();
const http = require('http'); // 1. Import HTTP module
const { Server } = require('socket.io'); // 2. Import Socket.IO Server

const server = http.createServer(app); // 3. Create HTTP server from Express app
const port = 8080;
const admin = require('firebase-admin'); // 1. Import Admin SDK

// --- FIRESTORE INITIALIZATION ---
// NOTE: Explicitly setting the Project ID prevents the "Unable to detect a Project Id" error.
const PROJECT_ID = 'liquid-fulcrum-476414-v6';

try {
    admin.initializeApp({
        // The SDK knows to look up credentials based on the Service Account (ADC)
        credential: admin.credential.applicationDefault(), 
        databaseURL: `https://${PROJECT_ID}.firebaseio.com`, 
        projectId: PROJECT_ID // Explicitly set the Project ID for robustness
    });
} catch (error) {
    // If you see a "Could not load the default credentials" error, 
    // ensure you have run 'gcloud auth application-default login' in your console.
    console.error("Firebase Admin initialization failed. Ensure credentials are set.", error.message);
}

const db = admin.firestore();

// Export the db instance so flashcardDecks.js can use it
app.locals.db = db; 
// --------------------------------
// --------------------------------
// SOCKET.IO SETUP (Real-time Collaboration)
// Allows cross-origin connection for local development
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active sessions in memory (for simplicity and speed)
// Structure: { competitionId: { status, playerA: {userId, score, deckSize}, playerB: {userId, score, deckSize}, ... } }
const activeCompetitions = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Phase 2: Join Room
    socket.on('joinCompetition', (competitionId) => {
        socket.join(competitionId);
        console.log(`Socket ${socket.id} joined room ${competitionId}`);
        // Optionally send current state upon joining
        if (activeCompetitions[competitionId]) {
            socket.emit('progressUpdate', activeCompetitions[competitionId]);
        }
    });

    // Phase 2: Player Action - A card was answered
    socket.on('cardAnswered', async ({ competitionId, userId, result }) => {
        const comp = activeCompetitions[competitionId];

        if (!comp || comp.status !== 'ACTIVE') {
            console.warn(`Card answered for non-active or non-existent competition: ${competitionId}`);
            return;
        }

        let isPlayerA = comp.playerA.userId === userId;
        let playerKey = isPlayerA ? 'playerA' : 'playerB';

        // 1. Update score
        if (result === 'correct') {
            comp[playerKey].score += 1;
        }

        // Calculate progress percentage (A studies B's deck, B studies A's deck)
        // Player A's progress is based on Player B's deck size (A's score / B's deck size)
        // Player B's progress is based on Player A's deck size (B's score / A's deck size)
        comp.playerA.percent = Math.floor((comp.playerA.score / comp.playerA.deckSize) * 100);
        comp.playerB.percent = Math.floor((comp.playerB.score / comp.playerB.deckSize) * 100);

        // 2. Broadcast the update to the room
        io.to(competitionId).emit('progressUpdate', comp);

        // 3. Phase 3: Check Victory Condition
        let winner = null;
        if (comp.playerA.percent >= 100) {
            winner = comp.playerA.userId;
        } else if (comp.playerB.percent >= 100) {
            winner = comp.playerB.userId;
        }

        if (winner) {
            comp.status = 'FINISHED';
            
            // Update Firestore for persistence
            try {
                const compDocRef = db.collection('flashcardCompetitions').doc(competitionId);
                await compDocRef.update({
                    status: 'FINISHED',
                    winnerId: winner,
                    finalScoreA: comp.playerA.score,
                    finalScoreB: comp.playerB.score,
                    finishedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.error("Error updating competition status in Firestore:", e);
            }

            const winnerUsername = winner === comp.playerA.userId ? comp.playerA.username : comp.playerB.username;
            
            io.to(competitionId).emit('gameFinished', {
                winnerId: winner,
                winnerUsername: winnerUsername
            });

            // Clean up in-memory session after a delay
            setTimeout(() => {
                delete activeCompetitions[competitionId];
                console.log(`Competition ${competitionId} cleaned up.`);
            }, 60000); 
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Export the activeCompetitions object so the API routes can update it
app.locals.activeCompetitions = activeCompetitions;
// --------------------------------

// Import routes
const viewRoutes = require('./src/routes/views'); 
const apiRoutes = require('./src/routes/flashcardDecks'); // Import API routes

// Middleware Setup
app.use(express.static('public')); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/decks', apiRoutes); // Mount API routes

// View Routes
// By passing '/' as the path, all routes in viewRoutes (e.g., '/', '/newFlashcard')
// are now mapped directly from the application's root.
app.use('/', viewRoutes); 

// Start the server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});