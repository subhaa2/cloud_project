const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();

// Use Cloud Run’s injected PORT
const port = process.env.PORT || 8080;

// Import the view routes
const viewRoutes = require('./frontend/src/routes/views');

// Middleware Setup
app.use(express.static(path.join(__dirname, 'frontend', 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View Routes
app.use('/', viewRoutes);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server (runs on same port)
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
    console.log('✅ New client connected');

    socket.on('close', () => {
        console.log('❌ Client disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server ready on ws://localhost:${port}`);
});
