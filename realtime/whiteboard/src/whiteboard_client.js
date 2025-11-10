// Whiteboard.jsx
import { useEffect, useRef } from "react";
import { fabric } from "fabric";

// Remember to update URL
// url = "ws://localhost:8080";
url = "ws://localhost:4001";

export default function Whiteboard(){
    const canvasRef = useRef(null);
    const wsRef = useRef(null);

    useEffect(() => {
        // Initialize Fabric.js
        const canvas = new fabric.Canvas("board", {
            isDrawingMode: true,
            backgroundColor: "#ffffff",
        });
        canvas.freeDrawingBrush.width = 3;
        canvas.freeDrawingBrush.color = "#000";
        canvasRef.current = canvas;

        // Connect to WebSocket backend
        const ws = new WebSocket(url);
        wsRef.current = ws;
        
        ws.onopen = () => console.log("Connected to server");
        ws.onclose = () => console.log("Disconnected");
        ws.onerror = () => console.error("WS error: ", err);

        // Listen for remote updates
        ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === "draw") {
                fabric.util.enlivenObjects([data.push], (objs) => {
                    objs.forEach((o) => canvas.add(0));
                    canvas.renderAll();
                });
            } else if (data.type === "clear") {
                canvas.clear();
            }
        };

        return () => {
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