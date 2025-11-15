const API_BASE_URL = 'http://localhost:5000';
const FIREBASE_PROJECT_ID = 'liquid-fulcrum-476414-v6';

// Initialize Firebase
let db = null;
let firestoreAvailable = false;

try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp({
            apiKey: "AIzaSyCVadQBCU4KKd4XMimdHC9cMHKQU8UHhrI",
            authDomain: "liquid-fulcrum-476414-v6.firebaseapp.com",
            projectId: "liquid-fulcrum-476414-v6",
            storageBucket: "liquid-fulcrum-476414-v6.firebasestorage.app",
            messagingSenderId: "1047913048872",
            appId: "1:1047913048872:web:467a8f9640bb2fe242fe1d",
            measurementId: "G-CVCHVJGD85"
        });
        db = firebase.firestore();
        firestoreAvailable = true;
        console.log('Firebase initialized successfully for real-time collaboration');
    } else if (typeof firebase !== 'undefined') {
        db = firebase.firestore();
        firestoreAvailable = true;
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
    console.warn('Real-time collaboration will be limited. Using backend API only.');
}

// Get document ID from URL
const urlParams = new URLSearchParams(window.location.search);
const documentId = urlParams.get('docId');

if (!documentId) {
    alert('No document ID provided. Redirecting...');
    window.location.href = 'student-dashboard.html';
}

const sessionUser = JSON.parse(localStorage.getItem('sessionUser') || 'null');
if (!sessionUser) {
    alert('Please log in first.');
    window.location.href = 'index.html';
}

let quill;
let fabricCanvas;
let docRef;
let presenceRef;
let cursorsRef;
let annotationsRef;
let unsubscribe;
let presenceUnsubscribe;
let cursorsUnsubscribe;
let annotationsUnsubscribe;
let saveTimeout;
let annotationSaveTimeout;
let cursorUpdateTimeout;
let currentDocument = null;
let activeUsers = new Map();
let userCursors = new Map();
let currentTool = 'select';
let isApplyingRemoteChange = false;
let lastKnownContent = null;

// Generate a unique session ID for this browser tab
const sessionId = `${sessionUser.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Initialize Quill editor
const toolbarOptions = [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'image'],
    ['clean']
];

quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
        toolbar: toolbarOptions
    },
    readOnly: false
});

// Initialize Fabric.js canvas for annotations
function initializeFabricCanvas() {
    const canvasEl = document.getElementById('annotationCanvas');
    if (!canvasEl || typeof fabric === 'undefined') {
        console.warn('Fabric.js not available or canvas element not found');
        return;
    }

    const wrapper = document.querySelector('.editor-wrapper');
    if (!wrapper) return;

    // Wait a bit for layout to settle
    setTimeout(() => {
        // Set canvas size to match wrapper
        const width = wrapper.offsetWidth || 1200;
        const height = wrapper.offsetHeight || 800;

        fabricCanvas = new fabric.Canvas('annotationCanvas', {
            width: width,
            height: height,
            isDrawingMode: false,
            selection: true,
            preserveObjectStacking: true
        });

        // Make sure canvas is interactive
        fabricCanvas.upperCanvasEl.style.pointerEvents = 'auto';
        fabricCanvas.lowerCanvasEl.style.pointerEvents = 'auto';

        // Handle canvas changes
        fabricCanvas.on('path:created', () => {
            if (!isApplyingRemoteChange) {
                saveAnnotations();
            }
        });

        fabricCanvas.on('object:added', () => {
            if (!isApplyingRemoteChange) {
                saveAnnotations();
            }
        });

        fabricCanvas.on('object:modified', () => {
            if (!isApplyingRemoteChange) {
                saveAnnotations();
            }
        });

        fabricCanvas.on('object:removed', () => {
            if (!isApplyingRemoteChange) {
                saveAnnotations();
            }
        });

        // Handle text editing
        fabricCanvas.on('text:editing:entered', () => {
            console.log('Text editing started');
        });

        fabricCanvas.on('text:editing:exited', () => {
            if (!isApplyingRemoteChange) {
                saveAnnotations();
            }
        });

        // Handle selection
        fabricCanvas.on('selection:created', (e) => {
            if (currentTool === 'select') {
                // Allow selection
            }
        });

        console.log('Fabric.js canvas initialized', { width, height });
    }, 100);
}

// Tool functions for annotation toolbar
window.setTool = function (tool) {
    currentTool = tool;

    // Update button states
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    if (tool === 'select') {
        document.getElementById('selectTool')?.classList.add('active');
        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = true;
            fabricCanvas.defaultCursor = 'default';
        }
    } else if (tool === 'pen') {
        document.getElementById('penTool')?.classList.add('active');
        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = true;
            fabricCanvas.freeDrawingBrush.width = parseInt(document.getElementById('strokeWidth').value) || 3;
            fabricCanvas.freeDrawingBrush.color = document.getElementById('strokeColor').value || '#000000';
        }
    } else if (tool === 'text') {
        document.getElementById('textTool')?.classList.add('active');
        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = false;
            fabricCanvas.defaultCursor = 'crosshair';
            // Remove any existing text handler first
            fabricCanvas.off('mouse:down', addTextAtPosition);
            // Add the handler
            fabricCanvas.on('mouse:down', addTextAtPosition);
        }
    } else if (tool === 'rectangle') {
        document.getElementById('rectTool')?.classList.add('active');
        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = false;
            addRectangle();
        }
    } else if (tool === 'circle') {
        document.getElementById('circleTool')?.classList.add('active');
        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = false;
            addCircle();
        }
    } else if (tool === 'arrow') {
        document.getElementById('arrowTool')?.classList.add('active');
        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = false;
            addArrow();
        }
    }
};

function addTextAtPosition(options) {
    if (currentTool !== 'text') return;

    // Prevent default behavior
    if (options.e) {
        options.e.preventDefault();
        options.e.stopPropagation();
    }

    const pointer = fabricCanvas.getPointer(options.e);
    const text = new fabric.IText('Click to edit', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 20,
        fill: document.getElementById('strokeColor').value || '#000000',
        fontFamily: 'Arial',
        editable: true
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();

    // Enter editing mode immediately
    text.enterEditing();
    text.selectAll();

    // Remove this handler after adding text
    fabricCanvas.off('mouse:down', addTextAtPosition);

    // Switch back to select tool after a short delay
    setTimeout(() => {
        setTool('select');
    }, 100);
}

function addRectangle() {
    const rect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 100,
        fill: 'transparent',
        stroke: document.getElementById('strokeColor').value || '#000000',
        strokeWidth: parseInt(document.getElementById('strokeWidth').value) || 3
    });

    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    fabricCanvas.renderAll();
    setTool('select');
}

function addCircle() {
    const circle = new fabric.Circle({
        left: 100,
        top: 100,
        radius: 50,
        fill: 'transparent',
        stroke: document.getElementById('strokeColor').value || '#000000',
        strokeWidth: parseInt(document.getElementById('strokeWidth').value) || 3
    });

    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    fabricCanvas.renderAll();
    setTool('select');
}

function addArrow() {
    // Simple arrow using a line with arrowhead
    const line = new fabric.Line([100, 100, 200, 100], {
        stroke: document.getElementById('strokeColor').value || '#000000',
        strokeWidth: parseInt(document.getElementById('strokeWidth').value) || 3,
        originX: 'center',
        originY: 'center'
    });

    fabricCanvas.add(line);
    fabricCanvas.setActiveObject(line);
    fabricCanvas.renderAll();
    setTool('select');
}

window.updateStrokeColor = function () {
    const color = document.getElementById('strokeColor').value;
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.color = color;
    }
};

window.updateStrokeWidth = function () {
    const width = parseInt(document.getElementById('strokeWidth').value) || 3;
    if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.width = width;
    }
};

window.clearCanvas = function () {
    if (fabricCanvas && confirm('Clear all annotations?')) {
        fabricCanvas.clear();
        saveAnnotations();
    }
};

// Save annotations to Firestore
async function saveAnnotations() {
    if (!fabricCanvas || !annotationsRef || isApplyingRemoteChange) return;

    try {
        const json = JSON.stringify(fabricCanvas.toJSON(['selectable', 'evented']));

        clearTimeout(annotationSaveTimeout);
        annotationSaveTimeout = setTimeout(async () => {
            try {
                await annotationsRef.set({
                    data: json,
                    lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                    lastModifiedBy: sessionUser.id
                }, { merge: true });
                updateSaveStatus('saved');
            } catch (error) {
                console.error('Error saving annotations:', error);
                updateSaveStatus('error');
            }
        }, 500);
    } catch (error) {
        console.error('Error serializing annotations:', error);
    }
}

// Load Fabric.js annotations from Firestore
async function loadFabricAnnotations() {
    if (!fabricCanvas || !annotationsRef) return;

    try {
        const snap = await annotationsRef.get();
        if (snap.exists) {
            const data = snap.data();
            if (data.data) {
                isApplyingRemoteChange = true;
                fabricCanvas.loadFromJSON(data.data, () => {
                    fabricCanvas.renderAll();
                    isApplyingRemoteChange = false;
                });
            }
        }
    } catch (error) {
        console.error('Error loading Fabric annotations:', error);
    }
}

// Setup real-time annotation listener
function setupAnnotationListener() {
    if (!annotationsRef) return;

    annotationsUnsubscribe = annotationsRef.onSnapshot((snap) => {
        if (!snap.exists || isApplyingRemoteChange) return;

        const data = snap.data();
        if (data.data && data.lastModifiedBy !== sessionUser.id) {
            isApplyingRemoteChange = true;
            try {
                fabricCanvas.loadFromJSON(data.data, () => {
                    fabricCanvas.renderAll();
                    isApplyingRemoteChange = false;
                });
            } catch (error) {
                console.error('Error applying remote annotations:', error);
                isApplyingRemoteChange = false;
            }
        }
    });
}

// OLD YJS CODE - REMOVED
// Custom Firestore Provider for Yjs (REMOVED - using Fabric.js instead)
class FirestoreProvider {
    constructor(ydoc, firestore, docId) {
        this.ydoc = ydoc;
        this.db = firestore;
        this.docId = docId;
        this.docRef = firestore.collection('yjs-documents').doc(docId);
        this.synced = false;
        this.unsubscribe = null;

        this.init();
    }

    async init() {
        try {
            // Load initial state
            const docSnap = await this.docRef.get();

            if (docSnap.exists) {
                const data = docSnap.data();
                if (data.state) {
                    // Apply the document state
                    const uint8Array = this.base64ToUint8Array(data.state);
                    Y.applyUpdate(this.ydoc, uint8Array);
                }
            } else {
                // Create initial document
                await this.docRef.set({
                    state: '',
                    lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                    version: 0
                });
            }

            this.synced = true;
            console.log('Yjs document synced with Firestore');

            // Listen for updates from other clients
            this.setupListener();

            // Listen for local updates and sync to Firestore
            this.ydoc.on('update', this.handleLocalUpdate.bind(this));

        } catch (error) {
            console.error('Error initializing Firestore provider:', error);
        }
    }

    setupListener() {
        let isApplyingRemoteUpdate = false;

        this.unsubscribe = this.docRef.onSnapshot((snapshot) => {
            if (!snapshot.exists || isApplyingRemoteUpdate) return;

            const data = snapshot.data();
            if (data.state && data.lastModifiedBy !== sessionId) {
                isApplyingRemoteUpdate = true;
                try {
                    const uint8Array = this.base64ToUint8Array(data.state);
                    Y.applyUpdate(this.ydoc, uint8Array);
                } catch (error) {
                    console.error('Error applying remote update:', error);
                }
                isApplyingRemoteUpdate = false;
            }
        });
    }

    handleLocalUpdate(update, origin) {
        // Don't sync updates that came from Firestore
        if (origin === 'firestore') return;

        // Debounce updates to Firestore
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.syncToFirestore();
        }, 500);
    }

    async syncToFirestore() {
        try {
            const state = Y.encodeStateAsUpdate(this.ydoc);
            const base64State = this.uint8ArrayToBase64(state);

            await this.docRef.set({
                state: base64State,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: sessionId,
                version: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });

            updateSaveStatus('saved');
        } catch (error) {
            console.error('Error syncing to Firestore:', error);
            updateSaveStatus('error');
        }
    }

    uint8ArrayToBase64(uint8Array) {
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
    }

    base64ToUint8Array(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const uint8Array = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            uint8Array[i] = binary.charCodeAt(i);
        }
        return uint8Array;
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
    }
}

// Yjs Awareness for cursor sharing
class FirestoreAwareness {
    constructor(ydoc, firestore, docId, userId) {
        this.ydoc = ydoc;
        this.db = firestore;
        this.docId = docId;
        this.userId = userId;
        this.localState = null;
        this.states = new Map();
        this.cursorsRef = firestore.collection('yjs-documents').doc(docId).collection('awareness');
        this.myStateRef = this.cursorsRef.doc(sessionId);

        this.init();
    }

    init() {
        // Set up listener for remote awareness states
        this.unsubscribe = this.cursorsRef.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data();

                if (change.type === 'added' || change.type === 'modified') {
                    if (data.sessionId !== sessionId) {
                        this.states.set(data.sessionId, data);
                        this.renderCursor(data);
                    }
                } else if (change.type === 'removed') {
                    this.states.delete(data.sessionId);
                    this.removeCursor(data.sessionId);
                }
            });
        });

        // Track local selection changes
        quill.on('selection-change', (range) => {
            if (range) {
                this.setLocalState({
                    user: {
                        name: sessionUser.displayName || sessionUser.email,
                        color: generateUserColor(sessionUser.id)
                    },
                    cursor: {
                        index: range.index,
                        length: range.length
                    }
                });
            }
        });

        // Update presence periodically
        setInterval(() => this.updatePresence(), 30000);

        // Clean up on unload
        window.addEventListener('beforeunload', () => this.destroy());
    }

    setLocalState(state) {
        this.localState = state;
        this.updatePresence();
    }

    async updatePresence() {
        if (!this.localState) return;

        try {
            await this.myStateRef.set({
                sessionId: sessionId,
                userId: this.userId,
                ...this.localState,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating awareness:', error);
        }
    }

    renderCursor(state) {
        if (!state.cursor || !state.user) return;

        const cursorId = `cursor-${state.sessionId}`;
        let cursorEl = document.getElementById(cursorId);

        if (!cursorEl) {
            cursorEl = document.createElement('div');
            cursorEl.id = cursorId;
            cursorEl.className = 'user-cursor';
            cursorEl.setAttribute('data-user-name', state.user.name);
            document.querySelector('.editor-wrapper').appendChild(cursorEl);
        }

        try {
            const bounds = quill.getBounds(state.cursor.index, state.cursor.length);
            const editorContainer = quill.root.parentElement;

            cursorEl.style.position = 'absolute';
            cursorEl.style.left = (bounds.left + editorContainer.offsetLeft) + 'px';
            cursorEl.style.top = (bounds.top + editorContainer.offsetTop) + 'px';
            cursorEl.style.height = bounds.height + 'px';
            cursorEl.style.background = state.user.color;
            cursorEl.style.width = '2px';
            cursorEl.style.zIndex = '1000';
            cursorEl.style.pointerEvents = 'none';
        } catch (error) {
            // Cursor position out of bounds
        }
    }

    removeCursor(sessionId) {
        const cursorEl = document.getElementById(`cursor-${sessionId}`);
        if (cursorEl) {
            cursorEl.remove();
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.myStateRef.delete().catch(console.error);
    }
}

// Load document and set up real-time listener
async function initializeEditor() {
    try {
        // Fetch document metadata from backend
        const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`);
        if (!response.ok) {
            throw new Error('Document not found');
        }
        const data = await response.json();
        currentDocument = data.document;

        document.getElementById('docTitle').textContent = currentDocument.title || 'Untitled Document';

        // Check if user has access
        if (!hasAccess(currentDocument)) {
            alert('You do not have access to this document.');
            window.location.href = 'student-dashboard.html';
            return;
        }

        const canEdit = isOwner(currentDocument);

        if (!canEdit) {
            document.querySelector('.editor-toolbar').style.display = 'none';
            quill.enable(false);
        }

        // Set up real-time collaboration with Firestore FIRST (before loading documents)
        if (firestoreAvailable && db) {
            docRef = db.collection('documents').doc(documentId);
            presenceRef = db.collection('documents').doc(documentId).collection('presence').doc(sessionId);
            cursorsRef = db.collection('documents').doc(documentId).collection('cursors');
            annotationsRef = db.collection('documents').doc(documentId).collection('annotations').doc('canvas');

            // Set up presence tracking
            await setupPresence(canEdit);
            setupPresenceListener();

            // Load initial content
            await loadInitialContent();

            // Set up real-time content listener
            setupContentListener(canEdit);

            // Set up cursor/selection tracking
            if (canEdit) {
                setupCursorTracking();
            }

            // Set up cursor listener
            setupCursorListener();

            // Load and set up annotation listener
            setTimeout(async () => {
                if (fabricCanvas && annotationsRef) {
                    await loadFabricAnnotations();
                    setupAnnotationListener();
                }
            }, 1000);

            console.log('Real-time collaboration initialized with Firestore');
        } else {
            console.warn('Firestore not available, falling back to basic collaboration');
            await loadContentFromAPI();
        }

        // Load original document if storagePath exists (AFTER docRef is initialized)
        if (currentDocument.storagePath) {
            // Check if it's a Word document
            const fileType = currentDocument.type || '';
            const fileName = currentDocument.title || '';
            const isWordDoc = fileType.includes('word') ||
                fileType.includes('msword') ||
                fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
                /\.(doc|docx)$/i.test(fileName);

            await loadOriginalDocument();

            // For Word documents, hide view mode toggle (always in editor mode)
            if (isWordDoc) {
                document.getElementById('viewModeToggle').style.display = 'none';
            } else {
                // For PDF/images, show view mode toggle
                document.getElementById('viewModeToggle').style.display = 'flex';
                switchViewMode('document'); // Default to document view
                if (!canEdit) {
                    const editorBtn = document.getElementById('editorViewBtn');
                    if (editorBtn) {
                        editorBtn.textContent = '📝 View Notes';
                    }
                }
            }
        } else {
            // No document, just show editor
            if (canEdit) {
                document.getElementById('editor').classList.add('active');
                document.querySelector('.editor-toolbar').style.display = 'block';
            } else {
                document.getElementById('editor').classList.add('active');
                document.querySelector('.editor-toolbar').style.display = 'none';
            }
        }

        // Hide share button if user is not owner
        if (!canEdit) {
            document.querySelector('.share-btn').style.display = 'none';
        }

        // Hide annotation toolbar (not using overlay mode)
        document.getElementById('annotationToolbar').style.display = 'none';

        // Track when user is typing
        if (canEdit) {
            quill.on('text-change', (delta, oldDelta, source) => {
                if (source === 'user' && !isApplyingRemoteChange) {
                    updateSaveStatus('saving');
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => saveContent(delta), 300);
                }
            });
        }

    } catch (error) {
        console.error('Error initializing editor:', error);
        alert('Failed to load document: ' + error.message);
        window.location.href = 'student-dashboard.html';
    }
}

async function setupPresence(canEdit) {
    if (!presenceRef) return;

    const userName = sessionUser.displayName || sessionUser.email || 'Unknown User';
    const userColor = generateUserColor(sessionUser.id);

    await presenceRef.set({
        userId: sessionUser.id,
        userName: userName,
        userColor: userColor,
        sessionId: sessionId,
        isEditing: canEdit,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });

    setInterval(async () => {
        if (presenceRef) {
            try {
                await presenceRef.update({
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating presence:', error);
            }
        }
    }, 30000);

    window.addEventListener('beforeunload', async () => {
        if (presenceRef) {
            try {
                await presenceRef.delete();
            } catch (error) {
                console.error('Error removing presence:', error);
            }
        }
    });
}

function setupPresenceListener() {
    if (!db || !documentId) return;

    const presenceCollection = db.collection('documents').doc(documentId).collection('presence');

    presenceUnsubscribe = presenceCollection.onSnapshot((snapshot) => {
        const now = Date.now();
        const activeUserIds = new Set();

        snapshot.forEach((doc) => {
            const data = doc.data();
            const lastSeen = data.lastSeen?.toMillis?.() || data.lastSeen || 0;
            const timeSinceLastSeen = now - lastSeen;

            if (timeSinceLastSeen < 60000 && data.userId !== sessionUser.id) {
                activeUserIds.add(data.userId);
                activeUsers.set(data.userId, {
                    id: data.userId,
                    name: data.userName || 'Unknown',
                    color: data.userColor || '#1a73e8',
                    isEditing: data.isEditing || false
                });
            }
        });

        activeUsers.forEach((user, userId) => {
            if (!activeUserIds.has(userId)) {
                activeUsers.delete(userId);
            }
        });

        updateActiveUsersDisplay();
    });
}

function updateActiveUsersDisplay() {
    const activeUsersEl = document.getElementById('activeUsers');
    const activeUsersCountEl = document.getElementById('activeUsersCount');

    if (activeUsers.size > 0) {
        activeUsersEl.style.display = 'flex';
        activeUsersCountEl.textContent = activeUsers.size;
    } else {
        activeUsersEl.style.display = 'none';
    }
}

async function loadInitialContent() {
    if (!docRef) return;

    try {
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.content) {
                try {
                    const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                    quill.setContents(content, 'silent');
                    lastKnownContent = JSON.stringify(content);
                } catch (e) {
                    console.error('Error parsing content:', e);
                    quill.setContents({ ops: [{ insert: '\n' }] }, 'silent');
                    lastKnownContent = JSON.stringify({ ops: [{ insert: '\n' }] });
                }
            } else {
                quill.setContents({ ops: [{ insert: '\n' }] }, 'silent');
                lastKnownContent = JSON.stringify({ ops: [{ insert: '\n' }] });
            }
        }
    } catch (error) {
        console.error('Error loading initial content:', error);
    }
}

function setupContentListener(canEdit) {
    if (!docRef) return;

    unsubscribe = docRef.onSnapshot((snap) => {
        if (!snap.exists) return;

        const data = snap.data();
        if (data.content) {
            try {
                const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                const contentStr = JSON.stringify(content);

                // Only update if content actually changed
                if (contentStr !== lastKnownContent) {
                    isApplyingRemoteChange = true;

                    // Get current selection to restore it
                    const currentSelection = quill.getSelection();

                    // Apply the new content
                    quill.setContents(content, 'silent');
                    lastKnownContent = contentStr;

                    // Try to restore selection if user was editing
                    if (currentSelection && canEdit) {
                        setTimeout(() => {
                            try {
                                const length = quill.getLength();
                                const newIndex = Math.min(currentSelection.index, length - 1);
                                quill.setSelection(newIndex, 'silent');
                            } catch (e) {
                                // Selection restoration failed, that's okay
                            }
                        }, 50);
                    }

                    isApplyingRemoteChange = false;
                    updateSaveStatus('saved');
                }
            } catch (e) {
                console.error('Error parsing content in snapshot:', e);
            }
        }
    });
}

function setupCursorTracking() {
    if (!cursorsRef) return;

    // Update cursor position with debouncing
    const updateCursor = () => {
        const range = quill.getSelection();
        if (range) {
            updateCursorPosition(range);
        } else {
            removeCursorPosition();
        }
    };

    // Track selection changes
    quill.on('selection-change', (range) => {
        clearTimeout(cursorUpdateTimeout);
        cursorUpdateTimeout = setTimeout(updateCursor, 100);
    });

    // Also track on text changes (cursor moves)
    quill.on('text-change', () => {
        clearTimeout(cursorUpdateTimeout);
        cursorUpdateTimeout = setTimeout(updateCursor, 100);
    });
}

async function updateCursorPosition(range) {
    if (!cursorsRef || !range) return;

    try {
        const cursorDoc = cursorsRef.doc(sessionId);
        await cursorDoc.set({
            userId: sessionUser.id,
            sessionId: sessionId,
            range: range,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating cursor position:', error);
    }
}

async function removeCursorPosition() {
    if (!cursorsRef) return;

    try {
        const cursorDoc = cursorsRef.doc(sessionId);
        await cursorDoc.delete();
    } catch (error) {
        console.error('Error removing cursor position:', error);
    }
}

function setupCursorListener() {
    if (!cursorsRef) return;

    cursorsUnsubscribe = cursorsRef.onSnapshot((snapshot) => {
        const activeCursorUsers = new Set();

        snapshot.forEach((doc) => {
            const data = doc.data();
            // Only show cursors from other users
            if (data.userId !== sessionUser.id && data.sessionId !== sessionId) {
                const user = activeUsers.get(data.userId);
                if (user && data.range) {
                    activeCursorUsers.add(data.userId);
                    // Update or create cursor
                    const existing = userCursors.get(data.userId);
                    if (existing) {
                        // Update existing cursor range
                        existing.range = data.range;
                        // Trigger position update
                        setTimeout(() => {
                            try {
                                const length = quill.getLength();
                                const safeIndex = Math.min(data.range.index, length - 1);
                                const bounds = quill.getBounds(safeIndex, 0);
                                if (bounds && existing.element.parentElement) {
                                    const editorContainer = quill.root.parentElement;
                                    existing.element.style.left = (bounds.left + editorContainer.offsetLeft) + 'px';
                                    existing.element.style.top = (bounds.top + editorContainer.offsetTop) + 'px';
                                    existing.element.style.height = bounds.height + 'px';
                                }
                            } catch (e) {
                                // Update failed
                            }
                        }, 50);
                    } else {
                        displayUserCursor(data.userId, data.range, user.name, user.color);
                    }
                }
            }
        });

        // Remove cursors for users who are no longer active
        userCursors.forEach((cursorData, userId) => {
            if (!activeCursorUsers.has(userId) && userId !== sessionUser.id) {
                removeUserCursor(userId);
            }
        });

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
                const data = change.doc.data();
                if (data.userId !== sessionUser.id) {
                    removeUserCursor(data.userId);
                }
            }
        });
    });
}

function displayUserCursor(userId, range, userName, userColor) {
    // Remove existing cursor for this user
    removeUserCursor(userId);

    try {
        const editor = quill.root;
        const editorContainer = editor.parentElement;

        if (!editorContainer) return;

        // Get bounds for the cursor position
        let bounds;
        try {
            bounds = quill.getBounds(range.index, 0);
        } catch (e) {
            // If index is out of bounds, try to get bounds at the end
            const length = quill.getLength();
            bounds = quill.getBounds(Math.min(range.index, length - 1), 0);
        }

        if (!bounds) return;

        const cursorEl = document.createElement('div');
        cursorEl.className = 'user-cursor';
        cursorEl.style.position = 'absolute';
        cursorEl.style.left = (bounds.left + editorContainer.offsetLeft) + 'px';
        cursorEl.style.top = (bounds.top + editorContainer.offsetTop) + 'px';
        cursorEl.style.background = userColor;
        cursorEl.style.width = '2px';
        cursorEl.style.height = bounds.height + 'px';
        cursorEl.setAttribute('data-user-id', userId);
        cursorEl.setAttribute('data-user-name', userName);
        cursorEl.style.zIndex = '1000';
        cursorEl.style.pointerEvents = 'none';

        // Ensure editor container has relative positioning
        if (getComputedStyle(editorContainer).position === 'static') {
            editorContainer.style.position = 'relative';
        }

        // Find the editor wrapper to append cursor
        const editorWrapper = document.querySelector('.editor-wrapper');
        if (editorWrapper) {
            editorWrapper.appendChild(cursorEl);
        } else {
            editorContainer.appendChild(cursorEl);
        }

        userCursors.set(userId, { element: cursorEl, range: range });
    } catch (error) {
        console.error('Error displaying user cursor:', error);
    }
}

function removeUserCursor(userId) {
    const cursorData = userCursors.get(userId);
    if (cursorData && cursorData.element) {
        const cursorEl = cursorData.element;
        if (cursorEl.parentElement) {
            cursorEl.remove();
        }
        userCursors.delete(userId);
    }
}

async function saveContent(delta) {
    if (!docRef || isApplyingRemoteChange) return;

    try {
        const content = quill.getContents();
        const contentJson = JSON.stringify(content);

        // Save to Firestore
        await docRef.update({
            content: contentJson,
            lastModified: firebase.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: sessionUser.id
        });

        lastKnownContent = contentJson;

        // Also save annotation for tracking
        await saveAnnotation({
            type: 'edit',
            content: contentJson,
            userId: sessionUser.id,
            userName: sessionUser.displayName || sessionUser.email,
            timestamp: new Date()
        });

        updateSaveStatus('saved');
    } catch (error) {
        console.error('Error saving content:', error);
        updateSaveStatus('error');
    }
}

async function loadContentFromAPI() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`);
        if (response.ok) {
            const data = await response.json();
            const doc = data.document;
            if (doc.content) {
                try {
                    const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
                    quill.setContents(content);
                    lastKnownContent = JSON.stringify(content);
                } catch (e) {
                    quill.setContents({ ops: [{ insert: '\n' }] });
                    lastKnownContent = JSON.stringify({ ops: [{ insert: '\n' }] });
                }
            }
        }
    } catch (error) {
        console.error('Error loading content:', error);
        quill.setContents({ ops: [{ insert: '\n' }] });
        lastKnownContent = JSON.stringify({ ops: [{ insert: '\n' }] });
    }
}

function generateUserColor(userId) {
    const colors = [
        '#1a73e8', '#34a853', '#ea4335', '#fbbc04',
        '#9c27b0', '#00bcd4', '#ff9800', '#4caf50'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function hasAccess(doc) {
    if (doc.ownerId === sessionUser.id) {
        return true;
    }
    if (doc.sharedWith && Array.isArray(doc.sharedWith)) {
        return doc.sharedWith.includes(sessionUser.id) || doc.sharedWith.includes(sessionUser.email);
    }
    return false;
}

function isOwner(doc) {
    return doc.ownerId === sessionUser.id;
}

async function saveAnnotation(annotationData) {
    try {
        await fetch(`${API_BASE_URL}/api/documents/${documentId}/annotations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(annotationData)
        });
    } catch (error) {
        console.error('Error saving annotation:', error);
    }
}

async function loadAnnotations() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/annotations`);
        if (response.ok) {
            const data = await response.json();
            console.log('Annotations loaded:', data.annotations);
        }
    } catch (error) {
        console.error('Error loading annotations:', error);
    }
}

function updateSaveStatus(status) {
    const statusEl = document.getElementById('saveStatus');
    statusEl.className = 'save-status ' + status;

    switch (status) {
        case 'saving':
            statusEl.textContent = 'Saving...';
            break;
        case 'saved':
            statusEl.textContent = 'Saved';
            break;
        case 'error':
            statusEl.textContent = 'Error saving';
            break;
        default:
            statusEl.textContent = 'Saved';
    }
}

function goBack() {
    // Clean up listeners
    if (unsubscribe) {
        unsubscribe();
    }
    if (presenceUnsubscribe) {
        presenceUnsubscribe();
    }
    if (cursorsUnsubscribe) {
        cursorsUnsubscribe();
    }
    if (annotationsUnsubscribe) {
        annotationsUnsubscribe();
    }
    if (window.wordContentUnsubscribe) {
        window.wordContentUnsubscribe();
    }

    // Clean up presence
    if (presenceRef) {
        presenceRef.delete().catch(console.error);
    }

    // Clean up cursor position
    if (cursorsRef) {
        cursorsRef.doc(sessionId).delete().catch(console.error);
    }

    // Save any pending changes
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    // Try to save any unsaved content (fire and forget)
    if (docRef && !isApplyingRemoteChange && quill) {
        try {
            const content = quill.getContents();
            const contentJson = JSON.stringify(content);
            docRef.update({
                content: contentJson,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: sessionUser.id
            }).catch(() => { }); // Ignore errors on navigation
        } catch (e) {
            // Ignore errors
        }
    }

    // Navigate back
    window.location.href = 'student-dashboard.html';
}

// Share functionality
let selectedUserId = null;

async function openShareModal() {
    document.getElementById('shareModal').classList.add('show');
    selectedUserId = null;
    document.getElementById('shareBtn').disabled = true;
    await loadSchoolUsers();
    await loadSharedUsers();
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('show');
}

async function loadSchoolUsers() {
    const container = document.getElementById('schoolUsersList');
    if (!currentDocument || !currentDocument.schoolId) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No school information available.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/school/${currentDocument.schoolId}`);
        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        const allUsers = (data.users || []).filter(user =>
            user.id !== sessionUser.id && user.role === 'student'
        );

        const sharedWith = currentDocument.sharedWith || [];
        const availableUsers = allUsers.filter(user => !sharedWith.includes(user.id));

        if (availableUsers.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No other users available to share with.</p>';
            return;
        }

        container.innerHTML = availableUsers.map(user => {
            const displayName = user.displayName || user.email || user.id;
            const role = user.role || 'user';
            return `
                <div class="user-list-item" onclick="selectUser('${user.id}', this)">
                    <div class="user-info">
                        <span class="user-name">${displayName}</span>
                        <span class="user-email">${user.email || ''}</span>
                    </div>
                    <span class="user-role">${role}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading school users:', error);
        container.innerHTML = '<p style="text-align: center; color: #d32f2f; padding: 20px;">Error loading users.</p>';
    }
}

function selectUser(userId, element) {
    document.querySelectorAll('.user-list-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedUserId = userId;
    document.getElementById('shareBtn').disabled = false;
}

async function shareDocument() {
    if (!selectedUserId) {
        alert('Please select a user to share with');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: selectedUserId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to share document');
        }

        selectedUserId = null;
        document.getElementById('shareBtn').disabled = true;
        await loadSchoolUsers();
        await loadSharedUsers();
        alert('Document shared successfully!');
    } catch (error) {
        console.error('Error sharing document:', error);
        alert('Failed to share document: ' + error.message);
    }
}

async function loadSharedUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`);
        if (response.ok) {
            const data = await response.json();
            const doc = data.document;
            const sharedList = document.getElementById('sharedUsersList');

            if (!doc.sharedWith || doc.sharedWith.length === 0) {
                sharedList.innerHTML = '<li>No one else has access</li>';
                return;
            }

            const userPromises = doc.sharedWith.map(async (userId) => {
                try {
                    const userResponse = await fetch(`${API_BASE_URL}/api/users/${userId}`);
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        return userData.user;
                    }
                } catch (e) {
                    console.error('Error fetching user:', e);
                }
                return { id: userId, email: userId, displayName: userId };
            });

            const users = await Promise.all(userPromises);
            sharedList.innerHTML = users.map(user =>
                `<li>${user.displayName || user.email || user.id}</li>`
            ).join('');
        }
    } catch (error) {
        console.error('Error loading shared users:', error);
        document.getElementById('sharedUsersList').innerHTML = '<li>Error loading shared users</li>';
    }
}

document.getElementById('shareModal').addEventListener('click', (e) => {
    if (e.target.id === 'shareModal') {
        closeShareModal();
    }
});

document.addEventListener('DOMContentLoaded', initializeEditor);

async function loadOriginalDocument() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/view-url`);
        if (!response.ok) {
            throw new Error('Failed to get document URL');
        }
        const data = await response.json();
        const signedUrl = data.signedUrl;

        const viewer = document.getElementById('documentViewer');
        const fileType = currentDocument.type || '';
        const fileName = currentDocument.title || '';

        // Check if it's a Word document
        const isWordDoc = fileType.includes('word') ||
            fileType.includes('msword') ||
            fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
            /\.(doc|docx)$/i.test(fileName);

        if (isWordDoc) {
            // For Word documents, convert to HTML and load into editor
            await loadWordDocument(signedUrl);
        } else if (fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
            viewer.innerHTML = `<iframe src="${signedUrl}" type="application/pdf"></iframe>`;
        } else if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
            viewer.innerHTML = `<img src="${signedUrl}" alt="${currentDocument.title}">`;
        } else {
            viewer.innerHTML = `<iframe src="${signedUrl}"></iframe>`;
        }
    } catch (error) {
        console.error('Error loading original document:', error);
        document.getElementById('documentViewer').innerHTML =
            '<p style="padding: 40px; text-align: center; color: #666;">Unable to load document preview</p>';
    }
}

// Load and convert Word document to HTML for inline editing
async function loadWordDocument(signedUrl) {
    try {
        // Show loading message
        const viewer = document.getElementById('documentViewer');
        viewer.innerHTML = '<p style="padding: 40px; text-align: center; color: #666;">Loading Word document...</p>';

        // Fetch the Word document
        const response = await fetch(signedUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch Word document');
        }

        const arrayBuffer = await response.arrayBuffer();

        // Check if mammoth.js is available
        if (typeof mammoth === 'undefined') {
            throw new Error('Word document converter not available. Please refresh the page.');
        }

        // Convert Word document to HTML using mammoth.js
        // Note: mammoth.js supports .docx files. Older .doc files may not work.
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        let html = result.value;

        // Check for conversion warnings
        if (result.messages.length > 0) {
            console.warn('Word document conversion warnings:', result.messages);
        }

        // Check if document already has saved content (user has edited before)
        // Wait for docRef to be initialized if needed
        let hasExistingContent = false;
        let savedHtml = null;

        // Wait a bit for docRef to be ready (it's set up in initializeEditor)
        let attempts = 0;
        while (!docRef && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (docRef) {
            try {
                const docSnap = await docRef.get();
                console.log('Checking for saved Word content, doc exists:', docSnap.exists);
                if (docSnap.exists) {
                    const data = docSnap.data();
                    console.log('Document data:', { wordContentPath: data.wordContentPath, hasContent: !!data.wordContentPath });
                    if (data.wordContentPath) {
                        // Load saved content from Storage
                        console.log('Loading saved content from path:', data.wordContentPath);
                        hasExistingContent = true;
                        savedHtml = await loadWordContentFromStorage(data.wordContentPath);
                        console.log('Loaded saved content, length:', savedHtml ? savedHtml.length : 0);
                    }
                }
            } catch (error) {
                console.error('Could not check existing content:', error);
                // If loading from storage fails, try again after a short delay
                if (docRef) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const docSnap = await docRef.get();
                        if (docSnap.exists && docSnap.data().wordContentPath) {
                            console.log('Retry: Loading saved content from path:', docSnap.data().wordContentPath);
                            hasExistingContent = true;
                            savedHtml = await loadWordContentFromStorage(docSnap.data().wordContentPath);
                            console.log('Retry: Loaded saved content, length:', savedHtml ? savedHtml.length : 0);
                        }
                    } catch (retryError) {
                        console.error('Retry failed to load existing content:', retryError);
                    }
                }
            }
        } else {
            console.warn('docRef not available after waiting');
        }

        // Use saved content if available, otherwise use converted Word content
        const contentToDisplay = hasExistingContent ? savedHtml : html;

        // Create editable div for inline Word document editing
        const wordEditor = document.createElement('div');
        wordEditor.className = 'word-document-editor';
        wordEditor.contentEditable = isOwner(currentDocument) ? 'true' : 'false';
        wordEditor.innerHTML = contentToDisplay;
        wordEditor.id = 'wordDocumentEditor';

        // Clear viewer and add editable Word document
        viewer.innerHTML = '';
        viewer.appendChild(wordEditor);
        viewer.classList.add('active');

        // Hide the Quill editor for Word documents
        document.getElementById('editor').classList.remove('active');

        // Set up inline editing handlers
        const canEdit = isOwner(currentDocument);
        if (canEdit) {
            setupWordDocumentEditing(wordEditor, html, true);
            // Show formatting toolbar for Word documents
            document.getElementById('wordFormatToolbar').style.display = 'flex';
            document.querySelector('.editor-toolbar').style.display = 'block';
        } else {
            // Set up read-only real-time sync for shared users
            setupWordDocumentEditing(wordEditor, html, false);
            // Hide toolbar for non-owners
            document.getElementById('wordFormatToolbar').style.display = 'none';
            document.querySelector('.editor-toolbar').style.display = 'none';
        }

        // Hide view mode toggle for Word documents (always in document view)
        document.getElementById('viewModeToggle').style.display = 'none';

        // Save initial content if it's the first time loading
        if (!hasExistingContent) {
            await saveWordContentToStorage(html);
        }

    } catch (error) {
        console.error('Error loading Word document:', error);
        const viewer = document.getElementById('documentViewer');
        viewer.innerHTML =
            '<p style="padding: 40px; text-align: center; color: #d32f2f;">Unable to load Word document. ' +
            (error.message || 'Please ensure the file is a valid .doc or .docx file.') + '</p>';
    }
}

// Set up inline editing for Word document
function setupWordDocumentEditing(wordEditor, originalHtml, canEdit) {
    let saveTimeout;
    let lastSavedContent = wordEditor.innerHTML;
    let lastKnownPath = null;

    // Only set up editing handlers if user can edit
    if (canEdit) {
        // Listen for changes in the editable div
        wordEditor.addEventListener('input', () => {
            updateSaveStatus('saving');
            clearTimeout(saveTimeout);

            saveTimeout = setTimeout(async () => {
                try {
                    const currentContent = wordEditor.innerHTML;

                    if (currentContent !== lastSavedContent) {
                        // Save to Storage instead of Firestore
                        const savedPath = await saveWordContentToStorage(currentContent);

                        lastSavedContent = currentContent;
                        lastKnownPath = savedPath;
                        updateSaveStatus('saved');

                        // Also save annotation for tracking (with summary, not full content)
                        await saveAnnotation({
                            type: 'word-edit',
                            summary: 'Word document edited',
                            userId: sessionUser.id,
                            userName: sessionUser.displayName || sessionUser.email,
                            timestamp: new Date()
                        });
                    }
                } catch (error) {
                    console.error('Error saving Word document:', error);
                    updateSaveStatus('error');
                }
            }, 1000); // Increased debounce for Storage uploads
        });

        // Listen for paste events to clean up pasted content
        wordEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }

    // Set up real-time sync for Word document (for both owners and shared users)
    if (docRef && firestoreAvailable) {
        // Get initial path
        docRef.get().then(snap => {
            if (snap.exists) {
                const data = snap.data();
                if (data.wordContentPath) {
                    lastKnownPath = data.wordContentPath;
                }
            }
        }).catch(console.error);

        const wordContentUnsubscribe = docRef.onSnapshot(async (snap) => {
            if (!snap.exists || isApplyingRemoteChange) return;

            const data = snap.data();
            const currentPath = data.wordContentPath;

            // Check if wordContentPath was updated (by anyone, including owner after refresh)
            if (currentPath && currentPath !== lastKnownPath) {
                lastKnownPath = currentPath;
                try {
                    // Load updated content from Storage
                    const updatedContent = await loadWordContentFromStorage(currentPath);
                    if (updatedContent && updatedContent !== wordEditor.innerHTML) {
                        isApplyingRemoteChange = true;
                        wordEditor.innerHTML = updatedContent;
                        lastSavedContent = updatedContent;
                        isApplyingRemoteChange = false;
                        updateSaveStatus('saved');
                    }
                } catch (error) {
                    console.error('Error loading updated Word content:', error);
                }
            }
            // Also check if lastModifiedBy changed (for real-time updates when path is same)
            else if (currentPath && data.lastModifiedBy && data.lastModifiedBy !== sessionUser.id) {
                try {
                    // Reload to get latest content (in case it was updated)
                    const updatedContent = await loadWordContentFromStorage(currentPath);
                    if (updatedContent && updatedContent !== wordEditor.innerHTML) {
                        isApplyingRemoteChange = true;
                        wordEditor.innerHTML = updatedContent;
                        lastSavedContent = updatedContent;
                        isApplyingRemoteChange = false;
                        updateSaveStatus('saved');
                    }
                } catch (error) {
                    console.error('Error loading updated Word content:', error);
                }
            }
        });

        // Store unsubscribe function for cleanup
        window.wordContentUnsubscribe = wordContentUnsubscribe;
    }
}

// Save Word content to Firebase Storage
async function saveWordContentToStorage(htmlContent) {
    try {
        // Request upload URL from backend using dedicated endpoint
        const response = await fetch(`${API_BASE_URL}/api/storage/upload-word-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                documentId: documentId,
                contentType: 'text/html'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to get upload URL');
        }

        const { uploadUrl, storagePath: finalPath } = await response.json();

        // Upload HTML content to Storage
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/html'
            },
            body: htmlContent
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload Word content');
        }

        // Update Firestore with storage path reference
        if (docRef) {
            console.log('Updating Firestore with wordContentPath:', finalPath);
            await docRef.update({
                wordContentPath: finalPath,
                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: sessionUser.id
            });
            console.log('Firestore updated successfully');
        } else {
            console.warn('docRef not available when trying to save wordContentPath');
        }

        return finalPath;
    } catch (error) {
        console.error('Error saving Word content to Storage:', error);
        throw error;
    }
}

// Load Word content from Firebase Storage
async function loadWordContentFromStorage(storagePath) {
    try {
        console.log('loadWordContentFromStorage called with path:', storagePath);
        // Get signed URL for reading
        const response = await fetch(`${API_BASE_URL}/api/storage/view-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storagePath: storagePath
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to get view URL:', response.status, errorText);
            throw new Error(`Failed to get view URL: ${response.status}`);
        }

        const result = await response.json();
        console.log('Got signed URL response:', { hasSignedUrl: !!result.signedUrl });
        const { signedUrl } = result;

        if (!signedUrl) {
            throw new Error('No signed URL returned');
        }

        // Fetch the HTML content
        console.log('Fetching content from signed URL...');
        const contentResponse = await fetch(signedUrl);
        if (!contentResponse.ok) {
            console.error('Failed to fetch Word content:', contentResponse.status, contentResponse.statusText);
            throw new Error(`Failed to fetch Word content: ${contentResponse.status}`);
        }

        const content = await contentResponse.text();
        console.log('Successfully loaded content, length:', content.length);
        return content;
    } catch (error) {
        console.error('Error loading Word content from Storage:', error);
        throw error;
    }
}

// Format Word document using document.execCommand
window.formatWordDoc = function (command, value = null) {
    const wordEditor = document.getElementById('wordDocumentEditor');
    if (!wordEditor || wordEditor.contentEditable !== 'true') return;

    wordEditor.focus();

    try {
        if (command === 'fontSize') {
            // Apply custom font size via style
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (!range.collapsed) {
                    const span = document.createElement('span');
                    span.style.fontSize = value;
                    try {
                        range.surroundContents(span);
                    } catch (e) {
                        // If surroundContents fails, try a different approach
                        const contents = range.extractContents();
                        span.appendChild(contents);
                        range.insertNode(span);
                    }
                } else {
                    // For collapsed selection, apply to next typed text
                    document.execCommand('styleWithCSS', false, true);
                    document.execCommand('insertHTML', false, `<span style="font-size: ${value}">&#8203;</span>`);
                }
            }
        } else if (command === 'fontFamily') {
            document.execCommand('fontName', false, value);
        } else if (value) {
            document.execCommand(command, false, value);
        } else {
            document.execCommand(command, false, null);
        }
    } catch (error) {
        console.warn('Format command failed:', command, error);
    }

    // Update button states
    updateFormatButtons();
}

// Update format button states based on current selection
function updateFormatButtons() {
    const wordEditor = document.getElementById('wordDocumentEditor');
    if (!wordEditor) return;

    // This would require checking document.queryCommandState
    // For now, we'll keep it simple
}

function switchViewMode(mode) {
    const viewer = document.getElementById('documentViewer');
    const editor = document.getElementById('editor');
    const toolbar = document.querySelector('.editor-toolbar');
    const docBtn = document.getElementById('docViewBtn');
    const editorBtn = document.getElementById('editorViewBtn');
    const canEdit = currentDocument && isOwner(currentDocument);

    if (mode === 'document') {
        // View document only
        viewer.classList.add('active');
        editor.classList.remove('active');
        toolbar.style.display = 'none';
        if (docBtn) docBtn.classList.add('active');
        if (editorBtn) editorBtn.classList.remove('active');
    } else {
        // Editor mode - show editor for notes
        viewer.classList.remove('active');
        editor.classList.add('active');
        if (docBtn) docBtn.classList.remove('active');
        if (editorBtn) editorBtn.classList.add('active');

        if (!canEdit) {
            toolbar.style.display = 'none';
            // Refresh content for shared users
            setTimeout(() => {
                if (currentDocument && docRef) {
                    docRef.get().then(snap => {
                        if (snap.exists) {
                            const data = snap.data();
                            if (data.content) {
                                try {
                                    const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                                    const wasEnabled = quill.isEnabled();
                                    if (!wasEnabled) {
                                        quill.enable(true);
                                    }
                                    quill.setContents(content, 'silent');
                                    if (!wasEnabled) {
                                        quill.enable(false);
                                    }
                                } catch (e) {
                                    console.error('Error refreshing content:', e);
                                }
                            }
                        }
                    }).catch(err => {
                        console.error('Error fetching document for refresh:', err);
                    });
                }
            }, 100);
        } else {
            toolbar.style.display = 'block';
        }
    }
}

window.addEventListener('beforeunload', async () => {
    if (unsubscribe) {
        unsubscribe();
    }
    if (presenceUnsubscribe) {
        presenceUnsubscribe();
    }
    if (provider) {
        provider.destroy();
    }
    if (awareness) {
        awareness.destroy();
    }
    if (presenceRef) {
        try {
            await presenceRef.delete();
        } catch (error) {
            console.error('Error removing presence:', error);
        }
    }
});