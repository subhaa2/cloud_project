// server.js
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { timeStamp } from "console";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// Keeps track of rooms and connected clients
// rooms = { roomId: { paths: [...], clients: Set([...]) } }
const rooms = {};

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const db =getFirestore();

const PORT = process.env.PORT || 8081;

wss.on("connection", async (socket, req) => {
  // Parse room ID from query (?room=A)
  const url = new URL(req.url, "http://dummy.com");
  const roomId = url.searchParams.get("room") || "default";

  // Check if roomId is valid
  if (!roomId){
    socket.close(4001, "Missing document ID");
    return;
  }

  // Check if roomId exist in Firestore first
  const docRef = db.collection("documents").doc(roomId);
  const doc_instance = await docRef.get();

  if (!doc_instance.exists){
    console.warn(`[DENIED] Unknown document ID: ${roomId}`);
    socket.close(4002, "Document does not exist");
    return;
  }
  else{
    console.log(`[Valid] Document Id ${roomId} exist in Firebase DB`);
  }

  // Initialize room if it doesn't exist in server
  if (!rooms[roomId]) {
    rooms[roomId] = { paths: [], clients: new Set() };

    // Load whiteboard strokes from Firestore
    const strokes_instance = await db.collection(`documents/${roomId}/whiteboard-strokes`).get();
    rooms[roomId].paths = strokes_instance.docs.map(doc => JSON.parse(doc.data().path));

    // Send init complete state to client
    socket.send(JSON.stringify({ type: "init_complete" }));
  }

  const room = rooms[roomId];
  room.clients.add(socket);

  console.log(`[CONNECT] Client joined room: ${roomId}`);

  // Send existing drawings to new client (only from its room)
  room.paths.forEach((path) => {
    socket.send(JSON.stringify({ type: "draw", path }));
  });

  socket.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "draw" && data.path) {
        // Save path to room
        room.paths.push(data.path);

        // Persist to Firestore
        await db.collection(`documents/${roomId}/whiteboard-strokes`).add({
          type: data.path.type,
          path: JSON.stringify(data.path),
          timestamp: new Date()
        });

      } else if (data.type === "clear") {
        // Clear room data
        room.paths.length = 0;

        // Clear Firestore strokes
        const strokesRef = db.collection(`documents/${roomId}/whiteboard-strokes`);
        const strokes_history = await strokesRef.get();
        const batch = db.batch();
        strokes_history.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
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
