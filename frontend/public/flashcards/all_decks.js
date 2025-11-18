// Global modal elements
let deleteModal, confirmDeleteBtn, cancelDeleteBtn;
let deckToDelete = null; // Stores the ID of the deck currently marked for deletion

// Challenge modal elements
let challengeModal, challengeLinkInput, challengeModalCloseBtn, copyLinkBtn;

// flashcardApiUrl is set by config.js - ensure it's loaded before this script
const flashcardApiUrl = window.FLASHCARD_API_URL || 'http://localhost:5080';
// --- API UTILITIES (CRUD using fetch) ---

/**
 * Retrieves the user ID from localStorage and prepares the necessary headers.
 * @param {boolean} isJson - Set to true if a 'Content-Type: application/json' header is also needed (for POST/PUT).
 * @returns {Object} An object containing the required HTTP headers.
 */
function getAuthHeaders(isJson = false) {
    // Falls back to the server's default ID if nothing is found (as per server design)
    const userId = localStorage.getItem('userEmail') || 'default-user-server-side';
    const headers = {
        'x-user-id': userId // <-- The critical header the server requires
    };

    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

/**
 * Retrieves the currently selected subject ID from the UI.
 * @returns {string} The subject ID, defaulting to 'uncategorized' if not found.
 */
function getCurrentSubjectId() {

    const subjectSpan = document.getElementById('flashcardSubjectName');

    const subjectName = subjectSpan ? subjectSpan.textContent.trim() : '';

    return (subjectName && subjectName !== 'null') ? subjectName : 'uncategorized';
}

/**
 * Loads all decks by calling the secure server API route /api/decks.
 * @returns {Promise<Array>} An array of summarized deck objects.
 */
async function loadDecks() {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) loadingMessage.textContent = 'Loading decks...';

    try {
        // Get the headers without Content-Type, as this is a GET request
        const headers = getAuthHeaders(false);

        const subjectIdToQuery = getCurrentSubjectId();

        console.log("Querying Decks for Subject:", subjectIdToQuery);

        let url = `${flashcardApiUrl}/api/decks`;

        url += `?subjectId=${encodeURIComponent(subjectIdToQuery)}`;

        // Fetch decks from the server API endpoint
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Failed to fetch decks: ${response.statusText}`);
        }

        // The server (flashcardDecks.js) returns the processed JSON array.
        const decks = await response.json();

        if (loadingMessage) loadingMessage.textContent = '';
        return decks;

    } catch (e) {
        console.error("Error loading decks from API:", e);
        if (loadingMessage) loadingMessage.textContent = 'Failed to load decks. Please try again.';
        return [];
    }
}

/**
 * Deletes a deck by calling the server API route and re-renders the list.
 * @param {string} deckId - The ID of the deck to delete.
 */
async function deleteDeckFromApi(deckId) {
    try {
        // Get the headers without Content-Type
        const headers = getAuthHeaders(false);

        const subjectIdToDelete = getCurrentSubjectId();
        console.log(subjectIdToDelete);

        // Use the DELETE method on the server API route
        let url = `${flashcardApiUrl}/api/decks/${deckId}`;

        url += `?subjectId=${encodeURIComponent(subjectIdToDelete)}`;
        console.log(url)

        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Server failed to delete deck: ${response.statusText}`);
        }

        // Success: Re-render the deck list
        renderDecksList();

    } catch (e) {
        console.error("Error deleting deck:", e);
        // Changed alert() to console error message since alerts are forbidden
        showTemporaryMessage('Failed to delete deck. Check console for details.', 'danger');
    }
}

/**
 * Calls the server API to create a unique competition document in the global /competitions collection.
 * @param {string} deckId - The ID of the deck to base the competition on.
 * @returns {Promise<string|null>} The newly generated competitionId, or null on failure.
 */
async function createCompetitionInstance(deckId, deckName, deckSize) {
    const url = `${flashcardApiUrl}/api/decks/challenge`;
    const headers = getAuthHeaders(true);

    try {
        const payload = {
            deckId: deckId,
            deckName: deckName,
            deckSize: deckSize
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'No detailed error message' }));
            throw new Error(`HTTP error! status: ${response.status}. Details: ${errorBody.message}`);
        }


        const data = await response.json();
        return data.competitionId;
    } catch (error) {
        console.error('Error creating competition instance:', error);
        return null;
    }
}

// Calls the API to initiate a challenge
async function initiateChallenge(deck) {
    try {
        const { headers, username } = getAuthHeaders(true); // JSON body needed for POST

        const response = await fetch(`${flashcardApiUrl}/api/decks/challenge`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                deckId: deck.id,
                deckName: deck.name,
                deckSize: deck.cardCount,
                username: username
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        showChallengeLinkModal(data.challengeLink);

    } catch (error) {
        console.error("Failed to initiate challenge:", error);
        // Implement a custom error display instead of alert
        showModalMessage('Challenge Failed', 'Could not create competition session. Please check your connection.', 'error');
    }
}

// Calls the API to initiate a challenge
async function initiateChallenge(deck) {
    try {
        const { headers, username } = getAuthHeaders(true); // JSON body needed for POST

        const response = await fetch(`${flashcardApiUrl}/api/decks/challenge`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                deckId: deck.id,
                deckName: deck.name,
                deckSize: deck.cardCount,
                username: username
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        showChallengeLinkModal(data.challengeLink);

    } catch (error) {
        console.error("Failed to initiate challenge:", error);
        // Implement a custom error display instead of alert
        showModalMessage('Challenge Failed', 'Could not create competition session. Please check your connection.', 'error');
    }
}

// --- UI RENDERING LOGIC ---

/**
 * Shows a temporary, non-blocking message to the user.
 * @param {string} message - The message content.
 * @param {string} type - 'success', 'danger', or 'secondary'.
 */
function showTemporaryMessage(message, type = 'secondary') {
    const messageArea = document.getElementById('message-area');
    if (messageArea) {
        messageArea.textContent = message;
        messageArea.className = `temporary-message ${type}`;
        messageArea.style.display = 'block';

        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 3000); // Hide after 3 seconds
    }
}

/**
 * Renders the full list of decks to the UI.
 */
async function renderDecksList() {
    const decksContainer = document.getElementById('decks-list-area');
    const loadingMessage = document.getElementById('loading-message');

    // Clear previous content
    decksContainer.innerHTML = '';
    if (loadingMessage) loadingMessage.style.display = 'block';

    const allDecks = await loadDecks();

    const currentSubjectId = getCurrentSubjectId();
    console.log(currentSubjectId);

    if (loadingMessage) loadingMessage.style.display = 'none';

    if (allDecks.length === 0) {
        decksContainer.innerHTML = '<p class="empty-list-message">You have no decks yet. Click "+ Start New" to create one!</p>';
        return;
    }

    // Create a single list wrapper for the deck cards
    const listWrapper = document.createElement('div');
    listWrapper.className = 'subject-row'; // Use grid for layout

    allDecks.forEach(deck => {
        const cardDiv = document.createElement('a');

        // Main card click should lead to the STUDY/LEARN view
        cardDiv.href = `/flashcardLearn?deckId=${deck.id}&subjectId=${encodeURIComponent(currentSubjectId)}`;

        cardDiv.className = 'deck-card';
        cardDiv.setAttribute('title', `Study Deck: ${deck.name}`);

        // Stats Section
        const statsDiv = document.createElement('div');
        statsDiv.className = 'deck-stats';
        statsDiv.innerHTML = `
                <span>${deck.cardCount} Cards</span>
            `;

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'deck-content';
        contentDiv.innerHTML = `
                <div class="deck-name">${deck.name}</div>
                ${statsDiv.outerHTML}
            `;
        cardDiv.appendChild(contentDiv);

        // Action Buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'deck-actions';

        // Action Button (Challenge) 
        const challengeBtn = document.createElement('button');
        challengeBtn.className = 'action-btn challenge-btn';
        challengeBtn.title = `Challenge with: ${deck.name}`;
        challengeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trophy"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14l2-2 2 2"/><path d="M12 17V12"/><path d="M12 3a7 7 0 0 0-7 7v2H2l10 10 10-10h-3v-2a7 7 0 0 0-7-7Z"/></svg>
            `;
        challengeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showChallengeLinkModal(deck.id, deck.name, deck.cardCount);
        });
        actionsDiv.appendChild(challengeBtn);

        // Action Button (Edit)
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.title = `Edit Deck: ${deck.name}`;
        editBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            `;
        editBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevents the cardDiv (<a>) from navigating to the Learn page
            e.stopPropagation(); // Stops the card's main click handler from firing
            // Explicit button click leads to the EDITOR
            window.location.href = `/newFlashcard?deckId=${deck.id}&subjectId=${encodeURIComponent(currentSubjectId)}`;
        });
        actionsDiv.appendChild(editBtn);

        // Action Button (Delete)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.title = `Delete Deck: ${deck.name}`;
        deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            `;
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault(); // <-- IMPORTANT: Prevents the cardDiv (<a>) from navigating
            e.stopPropagation(); // Stop the card's main click handler from firing
            showDeleteModal(deck.id, deck.name || 'Untitled Deck');
        });
        actionsDiv.appendChild(deleteBtn);

        cardDiv.appendChild(actionsDiv); // Append actions area to card

        listWrapper.appendChild(cardDiv);
    });

    decksContainer.appendChild(listWrapper);

}

// --- Modal Handlers ---

/**
 * Shows the custom deletion confirmation modal for a specific deck.
 * @param {string} id - The ID of the deck to be deleted.
 * @param {string} name - The name of the deck for display.
 */
function showDeleteModal(id, name) {
    deckToDelete = { id, name };
    // Update the modal text
    const modalText = document.querySelector('#delete-modal p');
    if (modalText) {
        modalText.innerHTML = `Are you sure you want to permanently delete the deck \"<strong>${name}</strong>\"? This cannot be undone.`;
    }
    deleteModal.classList.remove('hidden'); // Show the custom confirmation modal
}

/**
 * Shows the challenge link modal.
 * @param {string} deckId - The ID of the deck to challenge with.
 * @param {string} deckName - The name of the deck for display.
 */
async function showChallengeLinkModal(deckId, deckName, deckSize) {
    // Show a loading state while we wait for the server
    challengeLinkInput.value = 'Generating unique challenge link...';
    challengeLinkInput.style.color = '#6b7280'; // gray-500

    challengeLinkInput.value = 'Contacting server to create challenge...';

    const competitionId = await createCompetitionInstance(deckId, deckName, deckSize);

    const currentSubjectId = getCurrentSubjectId();

    if (competitionId) {
        // Construct the new URL using the competitionId
        const competitionUrl = `${window.location.origin}/flashcardCompetition?deckId=${competitionId}&subjectId=${encodeURIComponent(currentSubjectId)}`;


        challengeLinkInput.value = competitionUrl;
        document.getElementById('challenge-link-display').textContent = competitionUrl;
        document.querySelector('#challenge-link-modal h3').textContent = `Challenge: ${deckName}`;
        document.getElementById('copy-status').textContent = 'Click the button below to copy the link.';
        copyLinkBtn.textContent = 'Copy Link to Clipboard';

    } else {
        challengeLinkInput.value = 'Error generating link. See console.';
        challengeLinkInput.style.color = '#b91c1c'; // red-700
    }

    challengeModal.classList.remove('hidden');
}


/**
 * Shows a generic message modal (to replace alert()).
 * @param {string} title - The title of the message.
 * @param {string} body - The body content of the message.
 */
function showGenericMessage(title, body) {
    document.getElementById('generic-modal-title').textContent = title;
    document.getElementById('generic-modal-body').innerHTML = body;
    document.getElementById('generic-message-modal').classList.remove('hidden');
}

/**
 * Copies the challenge link to the clipboard.
 */
function copyLinkToClipboard() {
    const linkInput = challengeLinkInput;

    // Use execCommand for broader compatibility in sandboxed environments
    try {
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand('copy');

        // Provide visual feedback
        document.getElementById('copy-status').textContent = 'Link copied successfully!';
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy Link to Clipboard';
        }, 3000);

    } catch (err) {
        console.error('Failed to copy text: ', err);
        document.getElementById('copy-status').textContent = 'Error: Could not copy link automatically. Please copy it manually.';
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements for modal and button
    deleteModal = document.getElementById('delete-modal');
    confirmDeleteBtn = document.getElementById('confirm-delete');
    cancelDeleteBtn = document.getElementById('cancel-delete');
    const startNewDeckBtn = document.getElementById('start-new-deck-btn');

    challengeModal = document.getElementById('challenge-link-modal');
    challengeLinkInput = document.getElementById('challenge-link-input');
    challengeModalCloseBtn = document.getElementById('close-challenge-modal');
    copyLinkBtn = document.getElementById('copy-link-btn');

    if (!startNewDeckBtn) {
        // If the main deck button is missing, we are likely on a different page (like /flashcardLearn)
        // so we stop the initialization for the 'all_decks' view.
        return;
    }

    // Attach Listeners
    if (startNewDeckBtn) {
        startNewDeckBtn.addEventListener('click', () => {
            const currentSubjectId = getCurrentSubjectId();
            const url = `/newFlashcard?subjectId=${encodeURIComponent(currentSubjectId)}`;
            console.log("Redirecting to /newFlashcard with subject:", currentSubjectId);
            window.location.href = url;
        });
    }

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        deckToDelete = null;
    });

    confirmDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        if (deckToDelete) {
            deleteDeckFromApi(deckToDelete.id);
            deckToDelete = null;
        }
    });

    // Challenge Modal Listeners 
    challengeModalCloseBtn.addEventListener('click', () => {
        challengeModal.classList.add('hidden');
    });

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyLinkToClipboard);
    }

    // Initial Render
    // renderDecksList();
});

window.refreshPersonalFlashcardDeckList = renderDecksList;