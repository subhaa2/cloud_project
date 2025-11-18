// API Configuration
// Automatically detects environment and sets the appropriate API base URL
(function () {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Check if running locally (development)
    const isLocal = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname === '[::1]';

    // Set API base URL based on environment
    // IMPORTANT: For production, you MUST deploy your backend and update the URL below
    // Example: 'https://your-backend-service-xxxxx.run.app' (Cloud Run)
    //          or 'https://api.yourdomain.com' (custom domain)
    const PRODUCTION_API_URL = 'https://backend-45652651073.us-central1.run.app';  // Cloud Run backend URL

    window.API_BASE_URL = isLocal
        ? 'http://localhost:5000'  // Local development
        : PRODUCTION_API_URL;  // Production

    // Warn if production URL hasn't been updated
    if (!isLocal && PRODUCTION_API_URL.includes('your-backend-url')) {
        console.error('⚠️ PRODUCTION API URL NOT CONFIGURED!');
        console.error('Please update PRODUCTION_API_URL in js/config.js with your deployed backend URL');
    }

    // Real-time service URLs
    // Flashcard server
    const FLASHCARD_API_URL = isLocal
        ? 'http://localhost:5080'
        : 'https://flashcard-server-45652651073.us-central1.run.app';

    // Whiteboard server (WebSocket)
    const WHITEBOARD_WS_URL = isLocal
        ? 'ws://localhost:8081'
        : 'wss://whiteboard-server-ogvenjts3a-uc.a.run.app';

    // Export to window for global access
    window.FLASHCARD_API_URL = FLASHCARD_API_URL;
    window.WHITEBOARD_WS_URL = WHITEBOARD_WS_URL;
})();

