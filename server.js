const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const port = 8080;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Parse JSON bodies
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

const paths = []; // Store all drawing paths for whiteboard

// WebSocket connection handling
wss.on('connection', (socket) => {
    console.log('✅ New client connected');

    // Send all existing paths to the new client
    paths.forEach((path) => {
        if (socket.readyState === 1) { // WebSocket.OPEN
            socket.send(JSON.stringify({ type: 'draw', path }));
        }
    });

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Save new strokes
            if (data.type === 'draw') {
                paths.push(data.path);
            }

            // Clear all existing strokes
            if (data.type === 'clear') {
                paths.length = 0;
            }

            // Broadcast to all other clients
            wss.clients.forEach((client) => {
                if (client !== socket && client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    });

    socket.on('close', () => {
        console.log('❌ Client disconnected');
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server ready on ws://localhost:${port}`);
});