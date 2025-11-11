// server.js
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";

// Keeps track of rooms and connected clients
// rooms = { roomId: { paths: [...], clients: Set([...]) } }
const rooms = {};

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

wss.on("connection", (socket, req) => {
  // Parse room ID from query (?room=A)
  const url = new URL(req.url, "http://dummy.com");
  const roomId = url.searchParams.get("room") || "default";

  // Initialize room if it doesn't exist
  if (!rooms[roomId]) {
    rooms[roomId] = { paths: [], clients: new Set() };
  }
  const room = rooms[roomId];
  room.clients.add(socket);

  console.log(`[CONNECT] Client joined room: ${roomId}`);

  // Send existing drawings to new client (only from its room)
  room.paths.forEach((path) => {
    socket.send(JSON.stringify({ type: "draw", push: path }));
  });

  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "draw" && data.push) {
        // Save path to room
        room.paths.push(data.push);
      } else if (data.type === "clear") {
        // Clear room data
        room.paths.length = 0;
      }

      // Broadcast to all *other* clients in same room
      for (const client of room.clients) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }

    } catch (err) {
      console.error(`[ERROR] Failed to parse message: ${err}`);
    }
  });

  socket.on("close", () => {
    room.clients.delete(socket);
    if (room.clients.size === 0) {
      delete rooms[roomId];
      console.log(`[ROOM CLEANUP] Deleted empty room: ${roomId}`);
    }
    console.log(`[DISCONNECT] Client left room: ${roomId}`);
  });
});

app.get("/", (_, res) => res.send("✅ Whiteboard WebSocket server is running."));

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
