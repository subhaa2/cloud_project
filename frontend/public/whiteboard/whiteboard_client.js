// Whiteboard.jsx
import { useEffect, useRef } from "react";
import { fabric } from "fabric";

// Function to read the 'room' query parameter from the client's URL (e.g., ?room=A123)
function getRoomId() {
    // Uses the browser's global location object to read the URL query string.
    const searchParams = new URLSearchParams(window.location.search);
    // Returns the room ID, defaulting to 'default' if the parameter is not present.
    return searchParams.get('room') || 'default';
}

const ROOM_ID = getRoomId();

// Base URL of your WebSocket server - set by config.js
const BASE_URL = (window.WHITEBOARD_WS_URL || "ws://localhost:8081/") + "/";

// Construct the final WebSocket URL by appending the room ID as a query parameter
const WS_URL = `${BASE_URL}?room=${ROOM_ID}`;


export default function Whiteboard() {
    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    // Flag to prevent local 'object:added' event from firing when receiving a remote stroke.
    const isRemoteAdding = useRef(false);

    useEffect(() => {
        // Initialize Fabric.js
        const canvas = new fabric.Canvas("board", {
            isDrawingMode: true,
            backgroundColor: "#ffffff",
        });
        canvas.freeDrawingBrush.width = 3;
        canvas.freeDrawingBrush.color = "#000";
        canvasRef.current = canvas;

        // --- Setup WebSocket Connection ---
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => console.log(`Connected to server. Room: ${ROOM_ID}`);
        ws.onclose = () => console.log("Disconnected");
        ws.onerror = (err) => console.error("WS error: ", err);

        // Listen for remote updates
        ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === "draw" && data.push) {
                // 1. Temporarily set flag to ignore the next object:added event
                isRemoteAdding.current = true;

                fabric.util.enlivenObjects([data.push], (objects) => {
                    objects.forEach((obj) => canvas.add(obj));
                    canvas.renderAll();
                    isRemoteAdding.current = false;
                });
            } else if (data.type === "clear") {
                canvas.clear();
            }
        };

        // Listen for local drawing updates
        canvas.on('object:added', (e) => {
            // CHECK FLAG: Only send to server if the object was added LOCALLY
            if (isRemoteAdding.current) {
                return; // Ignore objects added remotely to prevent loop
            }

            // Only send paths/strokes (i.e., only objects created when isDrawingMode is true)
            if (e.target && e.target.path) {
                const object = e.target;
                const pushData = object.toJSON();

                // Send the drawing data to the server
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'draw', push: pushData }));
                }
            }
        });


        return () => {
            // Clean up resources
            canvas.dispose();
            ws.close();
        };
    }, []);

    return (
        <canvas
            id="board"
            width={900}
            height={600}
            style={{ border: "1px solid #ccc", borderRadius: "8px" }}
        />
    );
}