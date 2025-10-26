// Global key for Local Storage (Must match new_flashcard.js)
const STORAGE_KEY = 'auraLearnDecks';

// Helper function to format the 'Last Edited' time
function timeAgo(timestamp) {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

    return new Date(timestamp).toLocaleDateString();
}

// --- Local Storage Operations ---

/**
 * Loads decks from Local Storage. Returns an empty array if none are found.
 */
function loadDecks() {
    try {
        const storedDecks = localStorage.getItem(STORAGE_KEY);
        if (storedDecks) {
            const decks = JSON.parse(storedDecks);
            // Ensure data is an array
            return Array.isArray(decks) ? decks : [];
        }
    } catch (e) {
        console.error("Could not load decks from Local Storage:", e);
    }
    return [];
}

/**
 * Saves the entire decks array back to Local Storage.
 * @param {Array} decks - The array of decks to save.
 */
function saveDecks(decks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
        return true;
    } catch (e) {
        console.error("Error saving decks to Local Storage:", e);
        return false;
    }
}

/**
 * Deletes a deck by its ID after confirmation and re-renders the list.
 * @param {string} deckId - The unique ID of the deck to delete.
 * @param {string} deckName - The name of the deck for the confirmation message.
 */
function deleteDeckAction(deckId, deckName) {
    // Show a simple confirmation dialog (Yes/No)
    if (!window.confirm(`Are you sure you want to permanently delete the deck: "${deckName}"? This action cannot be undone.`)) {
        // Display a message if deletion was cancelled
        displayMessage(`Deletion of "${deckName}" cancelled.`, 'info');
        return;
    }

    let decks = loadDecks();
    const initialLength = decks.length;

    // Filter out the deck to be deleted
    decks = decks.filter(deck => deck.id !== deckId);

    if (decks.length < initialLength) {
        // Save the updated list and re-render
        if (saveDecks(decks)) {
            displayMessage(`Deck "${deckName}" deleted successfully.`, 'success');
            // Re-render the list only after a successful save
            fetchAndRenderDecks();
        } else {
             displayMessage('Error saving decks after deletion.', 'error');
        }
    } else {
        displayMessage(`Error: Could not find deck "${deckId}" to delete.`, 'error');
    }
}

/**
 * Displays a temporary message in the deck list area.
 * @param {string} message - The message content.
 * @param {string} type - 'success', 'error', or 'info'.
 */
function displayMessage(message, type = 'info') {
    const decksContainer = document.getElementById('decks-list-area');
    if (decksContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `feedback-message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.padding = '10px';
        messageDiv.style.margin = '10px 0';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.fontWeight = 'bold';
        messageDiv.style.textAlign = 'center';

        if (type === 'success') messageDiv.style.backgroundColor = '#d4edda'; // Light green
        else if (type === 'error') messageDiv.style.backgroundColor = '#f8d7da'; // Light red
        else messageDiv.style.backgroundColor = '#ffeeba'; // Light yellow (info)

        // Find the loading message or a good spot to insert the message
        const listWrapper = document.querySelector('.decks-list-area');
        if (listWrapper) {
            listWrapper.prepend(messageDiv);
        } else {
            decksContainer.prepend(messageDiv);
        }

        // Remove the message after a few seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}


// --- Rendering Logic ---

/**
 * Loads decks from Local Storage and dynamically renders them grouped by subject.
 */
function fetchAndRenderDecks() {
    const decksContainer = document.getElementById('decks-list-area');
    if (!decksContainer) {
        console.error("Deck list area container not found.");
        return;
    }

    decksContainer.innerHTML = ''; // Clear the loading message/old content

    const decks = loadDecks();

    if (decks.length === 0) {
        decksContainer.innerHTML = `
            <div style="text-align: center; padding: 50px; background-color: var(--color-card-bg); border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <h3 style="font-size: 1.5rem; color: var(--color-primary); margin-bottom: 10px;">Your library is empty!</h3>
                <p style="color: var(--color-text-light);">Click '+ Start New' to create your first flashcard set in the editor.</p>
            </div>
        `;
        return;
    }

    // 1. Group decks by subject
    const decksBySubject = decks.reduce((acc, deck) => {
        const subject = (deck.subject && deck.subject.trim()) || 'Uncategorized';

        const cardCount = Array.isArray(deck.cards) ? deck.cards.length : 0;

        const enhancedDeck = {
            ...deck,
            subject,
            cardCount,
            lastEdited: deck.lastEdited || Date.now()
        };

        if (!acc[subject]) {
            acc[subject] = [];
        }
        acc[subject].push(enhancedDeck);
        return acc;
    }, {});

    // 2. Render the grouped decks using the new structure
    const sortedSubjects = Object.keys(decksBySubject).sort();

    sortedSubjects.forEach(subject => {
        const deckList = decksBySubject[subject];

        // Subject Header (<h2>)
        const subjectHeader = document.createElement('h2');
        subjectHeader.textContent = subject;
        decksContainer.appendChild(subjectHeader);

        // Deck List Wrapper (div class="subject-row")
        const listWrapper = document.createElement('div');
        listWrapper.className = 'subject-row';

        // Render individual deck cards
        deckList.forEach(deck => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'deck-card';

            // --- 1. Content Area (clickable for view/edit) ---
            // Wrap existing content to control layout
            const contentDiv = document.createElement('div');
            contentDiv.className = 'deck-info-content';

            // The main click handler is now ONLY on the content
            contentDiv.addEventListener('click', () => {
                // Link to the flashcard learning page
                window.location.href = `/flashcardLearn?deckId=${deck.id}`;
            });

            // Deck Name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'deck-name';
            nameDiv.textContent = deck.name || 'Untitled Deck';
            contentDiv.appendChild(nameDiv);

            // Last Edited and Card Count
            const statsDiv = document.createElement('div');
            statsDiv.className = 'deck-stats';

            const cardCountText = `<span style="color: var(--color-primary); font-weight: 500;">${deck.cardCount} Card${deck.cardCount !== 1 ? 's' : ''}</span>`;
            const lastEditedText = ` | Last Edited: ${timeAgo(deck.lastEdited)}`;

            statsDiv.innerHTML = cardCountText + lastEditedText;

            contentDiv.appendChild(statsDiv);
            cardDiv.appendChild(contentDiv); // Append content area to card

            // --- 2. Actions Area (Edit and Delete Buttons) ---
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'deck-actions'; // Use the new CSS class

            // A. Edit Button (Pencil Icon)
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit-btn'; // Use new CSS classes
            editBtn.title = `Edit Deck: ${deck.name}`;
            editBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
    `;
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents the contentDiv click from firing
                window.location.href = `/newFlashcard?deckId=${deck.id}`;
            });
            actionsDiv.appendChild(editBtn);

            // B. Delete Button (Trash Icon)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete-btn'; // Use new CSS classes
            deleteBtn.title = `Delete Deck: ${deck.name}`;
            deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
    `;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents the contentDiv click from firing
                deleteDeckAction(deck.id, deck.name || 'Untitled Deck');
            });
            actionsDiv.appendChild(deleteBtn);

            cardDiv.appendChild(actionsDiv); // Append actions area to card

            listWrapper.appendChild(cardDiv);
        });

        decksContainer.appendChild(listWrapper);
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Load and render decks on page load
    fetchAndRenderDecks();

    // Attach event listener to the "Start New Deck" button
    const startNewDeckBtn = document.getElementById('start-new-deck-btn');
    if (startNewDeckBtn) {
        startNewDeckBtn.addEventListener('click', () => {
            // Redirect without an ID to signify creating a new deck
            window.location.href = `/newFlashcard`;
        });
    }
});