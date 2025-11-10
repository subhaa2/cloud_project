// server.js
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const paths = []; // store all drawing paths

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// Keep a list of connected clients
wss.on("connection", (socket) => {
    console.log(" New client connected");

    // Send all existing paths to the new clients
    paths.forEach((path) => socket.send(JSON.stringify({ type: "draw", path})));

    socket.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            // Save new strokes
            if (data.type == "draw") {
                paths.push(data.path);
            }

            // Clear all existing strokes
            if (data.type == "clear"){
                paths.length = 0;
            }

            // Broadcast to all others
            wss.clients.forEach((client) => {
                if (client !== socket && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (err) {
            console.error("Error parsing message:", err);
        }
    });

    socket.on("close", () => {
        console.log(" Client disconnected");
    });
});

//  Simple health check
app.get("/", (_, res) => res.send("WebSocket whiteboard server is running."));

server.listen(PORT,() => console.log(`Server running on port ${PORT}`));