const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const port = 8080;

// Import the new view routes file
const viewRoutes = require('./frontend/src/routes/views');

// Middleware Setup
app.use(express.static(path.join(__dirname, 'frontend', 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View Routes
// By passing '/' as the path, all routes in viewRoutes (e.g., '/', '/newFlashcard')
// are now mapped directly from the application's root.
app.use('/', viewRoutes);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// WebSocket connection handling
wss.on('connection', (socket) => {
    console.log('✅ New client connected');

    socket.on('close', () => {
        console.log('❌ Client disconnected');
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server ready on ws://localhost:${port}`);
});