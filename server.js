const express = require('express');
const app = express();
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
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});