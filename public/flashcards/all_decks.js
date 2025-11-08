// Global modal elements
let deleteModal, confirmDeleteBtn, cancelDeleteBtn;
let deckToDelete = null; // Stores the ID of the deck currently marked for deletion

// --- API UTILITIES (CRUD using fetch) ---

/**
 * Loads all decks by calling the secure server API route /api/decks.
 * @returns {Promise<Array>} An array of summarized deck objects.
 */
async function loadDecks() {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) loadingMessage.textContent = 'Loading decks...';

    try {
        // Fetch decks from the server API endpoint
        const response = await fetch('/api/decks');

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
        // Use the DELETE method on the server API route
        const response = await fetch(`/api/decks/${deckId}`, {
            method: 'DELETE',
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

    if (loadingMessage) loadingMessage.style.display = 'none';

    if (allDecks.length === 0) {
        decksContainer.innerHTML = '<p class="empty-list-message">You have no decks yet. Click "+ Start New" to create one!</p>';
        return;
    }

    // Group decks by subject (Simple grouping for display)
    const decksBySubject = allDecks.reduce((acc, deck) => {
        const subject = deck.subject || 'Uncategorized';
        if (!acc[subject]) {
            acc[subject] = [];
        }
        acc[subject].push(deck);
        return acc;
    }, {});

    Object.keys(decksBySubject).forEach(subject => {
        const subjectHeader = document.createElement('h2');
        subjectHeader.className = 'subject-header';
        subjectHeader.textContent = subject;
        decksContainer.appendChild(subjectHeader);

        const listWrapper = document.createElement('div');
        listWrapper.className = 'subject-row'; // Use grid for layout

        decksBySubject[subject].forEach(deck => {
            const cardDiv = document.createElement('a'); // Use <a> for easy navigation
            
            // Revert: Main card click should lead to the STUDY/LEARN view
            cardDiv.href = `/flashcardLearn?deckId=${deck.id}`; 
            
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
            
            // --- RESTORED EDIT BUTTON ---
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
                window.location.href = `/newFlashcard?deckId=${deck.id}`;
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
                deleteDeckAction(deck.id, deck.name || 'Untitled Deck');
            });
            actionsDiv.appendChild(deleteBtn);

            cardDiv.appendChild(actionsDiv); // Append actions area to card

            listWrapper.appendChild(cardDiv);
        });

        decksContainer.appendChild(listWrapper);
    });
}

/**
 * Prepares and shows the custom modal for deck deletion confirmation.
 * @param {string} id - The ID of the deck to delete.
 * @param {string} name - The name of the deck.
 */
function deleteDeckAction(id, name) {
    deckToDelete = id; // Store ID globally
    const modalText = document.querySelector('#delete-modal p');
    if (modalText) {
        modalText.innerHTML = `Are you sure you want to permanently delete the deck "<strong>${name}</strong>"? This cannot be undone.`;
    }
    deleteModal.style.display = 'flex'; // Show the custom confirmation modal
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Assign DOM elements for modal and button
    deleteModal = document.getElementById('delete-modal');
    confirmDeleteBtn = document.getElementById('confirm-delete');
    cancelDeleteBtn = document.getElementById('cancel-delete');
    const startNewDeckBtn = document.getElementById('start-new-deck-btn'); // This is the null culprit

    if (!startNewDeckBtn) {
        // If the main deck button is missing, we are likely on a different page (like /flashcardLearn)
        // so we stop the initialization for the 'all_decks' view.
        return; 
    }

    // 2. Attach Listeners (Line 215 is now protected by the check above)
    startNewDeckBtn.addEventListener('click', () => {
        window.location.href = '/newFlashcard';
    });

    // ... (Continue with other listeners that use elements specific to all_decks.html)
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        deckToDelete = null;
    });

    confirmDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        if (deckToDelete) {
            deleteDeckFromApi(deckToDelete);
            deckToDelete = null;
        }
    });

    // 3. Initial Render
    renderDecksList();
});