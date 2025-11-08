// Global state
let flashcardDeck = []; 
let currentCardIndex = -1; // -1 means no card is selected/new card mode
let currentDeckId = null; 

// DOM elements (declared here, assigned on window.load)
let deckNameInput, subjectInput, qInput, aInput, deckListContainer, cardCount, messageArea, deleteDeckBtn, deleteModal, saveDeckBtn, addCardBtn, deckNavList;


// --- API UTILITIES (CRUD using fetch) ---

/**
 * Loads a single deck and its cards by calling the server API.
 * The server handles fetching the deck document and its card subcollection.
 * @param {string} id - The Deck ID.
 * @returns {Promise<Object | null>} The deck object or null if not found.
 */
async function loadDeckFromApi(id) {
    if (!id) return null;
    try {
        // Fetch deck from the server API endpoint
        const response = await fetch(`/api/decks/${id}`);
        
        if (response.status === 404) {
             showFeedback('Deck not found.', 'danger');
             return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch deck: ${response.statusText}`);
        }

        const deck = await response.json();
        
        // The deck object returned by the server already contains the card array
        return {
            id: deck.id,
            name: deck.name, // Server uses 'name', client uses 'deckNameInput'
            subject: deck.subject,
            cards: deck.cards || [],
        };

    } catch (e) {
        console.error("Error loading deck from API:", e);
        showFeedback('Error loading deck data.', 'danger');
        return null;
    }
}

/**
 * Saves the current deck state and card subcollection by calling the server API.
 * The server handles the logic for deck updates and card CUD.
 * @param {boolean} showSuccess - Whether to show a success message on completion.
 */
async function saveDeckToApi(showSuccess) {
    const name = deckNameInput.value.trim() || 'Untitled Deck';
    const subject = subjectInput.value.trim() || '';

    if (flashcardDeck.length === 0 && !currentDeckId) {
        // Don't save a brand new, empty deck
        return; 
    }
    
    // 1. Prepare Data for Server API
    const dataToSend = {
        id: currentDeckId, // Will be null for new decks, ID for existing
        name: name,
        subject: subject,
        cards: flashcardDeck, // Send the entire card array to the server
    };

    try {
        const response = await fetch('/api/decks', {
            method: 'POST', // POST handles both CREATE (new ID) and UPDATE (existing ID)
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        });

        if (!response.ok) {
            throw new Error(`Server failed to save deck: ${response.statusText}`);
        }

        const result = await response.json();

        // If a new deck was created, update the client-side state
        if (result.status === 'created') {
            currentDeckId = result.deckId;
            history.replaceState(null, '', `?deckId=${currentDeckId}`);
            if (deleteDeckBtn) deleteDeckBtn.style.display = 'inline-flex';
        }
        
        // The server handled card CUD and deck update.

        if (showSuccess) {
            showFeedback('Deck saved successfully.', 'success');
        } else {
            showFeedback('Auto-saved.', 'secondary', 1000); 
        }

    } catch (e) {
        console.error("Error saving deck to API:", e);
        showFeedback('Error saving deck data. Check console for details.', 'danger');
    }
}


/**
 * Deletes the deck using the server API route.
 * @param {string} id - The Deck ID.
 */
async function deleteDeckFromApi(id) {
    if (!id) return;
    try {
        const response = await fetch(`/api/decks/${id}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error(`Server failed to delete deck: ${response.statusText}`);
        }

        // Redirect back to all decks page on success
        window.location.href = '/allDecks?message=Deck+deleted+successfully';
    } catch (e) {
        console.error("Error deleting deck from API:", e);
        showFeedback('Error deleting deck. Try again.', 'danger');
    }
}


/**
 * Clears the question/answer inputs and sets to new card mode.
 */
function clearEditor() {
    qInput.value = '';
    aInput.value = '';
    currentCardIndex = -1; 
    qInput.focus();
}

/**
 * Saves the current card's content to the flashcardDeck array.
 * This is triggered automatically on every input event.
 */
function saveCurrentCard() {
    if (!qInput || !aInput) return; 

    const qText = qInput.value.trim();
    const aText = aInput.value.trim();

    if (!qText && !aText) {
        if (currentCardIndex !== -1) { 
            // Mark the card for deletion from the array
             flashcardDeck.splice(currentCardIndex, 1);
             clearEditor();
             showFeedback('Empty card removed to cloud. Saving will persist deletion.', 'secondary');
             renderDeckNavList();
             saveDeckToApi(false); // **API save to persist deletion**
        }
        return; 
    }

    if (currentCardIndex === -1) {
        // If the user starts typing in new card mode, create a new card
        flashcardDeck.push({ question: qText, answer: aText});
        currentCardIndex = flashcardDeck.length - 1; 
        showFeedback('New card added to cloud.', 'secondary');
    } else {
        flashcardDeck[currentCardIndex].question = qText;
        flashcardDeck[currentCardIndex].answer = aText;
        showFeedback('Card content updated to cloud.', 'secondary');
    }
    
    renderDeckNavList();
    if (currentDeckId) {
        saveDeckToApi(false); // Auto-save to API
    }
}


/**
 * Loads a card from the deck into the editor.
 * @param {number} index - The index of the card to load.
 */
function loadCard(index) {
    if (index >= 0 && index < flashcardDeck.length) {
        // Before loading a new card, save the state of the *previous* card
        saveCurrentCard(); 
        
        currentCardIndex = index;
        const card = flashcardDeck[index];
        qInput.value = card.question;
        aInput.value = card.answer;
        
        // Highlight the current card in the navigation list
        const activeItem = deckNavList?.querySelector('.active');
        if (activeItem) {
            activeItem.classList.remove('active');
        }
        // Defensive check: deckNavList must exist before trying to query
        document.getElementById(`card-item-${index}`)?.classList.add('active');
        qInput.focus();
    } else {
        // If index is out of bounds, switch to new card mode
        clearEditor(); 
    }
}

/**
 * Renders the navigation list of cards.
 */
function renderDeckNavList() {
    if (!deckNavList || !cardCount) {
        console.error("DOM elements for deck navigation list or card count are missing.");
        return; // Prevents the TypeError: Cannot set properties of null (setting 'innerHTML')
    }
    
    deckNavList.innerHTML = '';
    cardCount.textContent = flashcardDeck.length;
    
    if (flashcardDeck.length === 0) {
        deckNavList.innerHTML = '<li class="text-sm p-2 text-gray-500">Deck is empty. Start typing above!</li>';
        return;
    }

    flashcardDeck.forEach((card, index) => {
        const li = document.createElement('li');
        li.id = `card-item-${index}`;
        li.className = 'deck-nav-item';
        if (index === currentCardIndex) {
            li.classList.add('active');
        }

        const titleText = card.question.trim().substring(0, 30) || `[Card ${index + 1}]`;
        li.textContent = titleText;
        
        li.addEventListener('click', () => loadCard(index));
        deckNavList.appendChild(li);
    });
}

/**
 * Initializes the deck loading process based on URL parameter.
 */
async function initLoadDeck() {
    const params = new URLSearchParams(window.location.search);
    currentDeckId = params.get('deckId');

    if (currentDeckId) {
        showFeedback('Loading deck...', 'secondary');
        const deck = await loadDeckFromApi(currentDeckId);
        
        if (deck) {
            deckNameInput.value = deck.name;
            subjectInput.value = deck.subject;
            flashcardDeck = deck.cards || [];
            if (deleteDeckBtn) deleteDeckBtn.style.display = 'inline-flex'; // Show delete button for existing deck
            
            // Load the first card if the deck is not empty, otherwise start in new card mode
            if (flashcardDeck.length > 0) {
                // Ensure card order is maintained if the server added an 'order' field
                flashcardDeck.sort((a, b) => a.order - b.order); 
                loadCard(0);
            } else {
                clearEditor();
            }
            showFeedback(`Loaded deck: ${deck.name}.`, 'success');
        } else {
            // If deck not found, treat it as a new deck
            currentDeckId = null;
            if (deleteDeckBtn) deleteDeckBtn.style.display = 'none';
            showFeedback('Deck ID invalid. Starting new deck.', 'danger');
            clearEditor();
        }
    } else {
        // Start a completely new deck
        if (deleteDeckBtn) deleteDeckBtn.style.display = 'none';
        clearEditor();
        showFeedback('Start creating your new flashcard deck!', 'secondary');
    }
    renderDeckNavList();
}


// --- Utility for showing feedback messages ---

let feedbackTimer;
/**
 * Displays a temporary message to the user.
 * @param {string} message - The message content.
 * @param {string} type - The message type ('success', 'danger', 'secondary').
 * @param {number} [duration=3000] - Duration in milliseconds before fading.
 */
function showFeedback(message, type, duration = 3000) {
    if (!messageArea) return; 

    // Clear any previous timer
    if (feedbackTimer) {
        clearTimeout(feedbackTimer);
    }
    
    // Update content and class
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    messageArea.style.opacity = '1';

    // Set timeout to fade out
    feedbackTimer = setTimeout(() => {
        messageArea.style.opacity = '0';
    }, duration);
}

/**
 * Initializes the deck loading process based on URL parameter.
 */
async function initLoadDeck() {
    const params = new URLSearchParams(window.location.search);
    currentDeckId = params.get('deckId');

    if (currentDeckId) {
        showFeedback('Loading deck...', 'secondary');
        const deck = await loadDeckFromApi(currentDeckId);
        
        if (deck) {
            deckNameInput.value = deck.name;
            subjectInput.value = deck.subject;
            flashcardDeck = deck.cards || [];
            if (deleteDeckBtn) deleteDeckBtn.style.display = 'inline-flex'; // Show delete button for existing deck
            
            // Load the first card if the deck is not empty, otherwise start in new card mode
            if (flashcardDeck.length > 0) {
                // Ensure card order is maintained if the server added an 'order' field
                flashcardDeck.sort((a, b) => a.order - b.order); // Added sorting for consistency
                loadCard(0);
            } else {
                clearEditor();
            }
            showFeedback(`Loaded deck: ${deck.name}.`, 'success');
        } else {
            // Deck not found or error loading it
            currentDeckId = null;
            if (deleteDeckBtn) deleteDeckBtn.style.display = 'none';
            // showFeedback('Deck ID invalid. Starting new deck.', 'danger'); // Already handled inside loadDeckFromApi's catch block, but kept for clarity
            clearEditor();
            showFeedback('Starting a new deck, as the requested ID was invalid or missing.', 'secondary');
        }
    } else {
        // Start a completely new deck (No deckId in URL)
        if (deleteDeckBtn) deleteDeckBtn.style.display = 'none';
        clearEditor();
        showFeedback('Start creating your new flashcard deck!', 'secondary');
    }
    renderDeckNavList();
}


// --- Initialization and Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Assign DOM elements
    deckNameInput = document.getElementById('deck-name-input');
    subjectInput = document.getElementById('subject-input');
    qInput = document.getElementById('question-input');
    aInput = document.getElementById('answer-input');
    cardCount = document.getElementById('card-count');
    messageArea = document.getElementById('message-area');
    deckNavList = document.getElementById('deck-list');
    deleteDeckBtn = document.getElementById('delete-deck-btn');
    saveDeckBtn = document.getElementById('save-deck-btn');
    addCardBtn = document.getElementById('add-card-btn');
    
    // IMPORTANT: Check if modal elements exist before trying to get them
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const backToDecksBtn = document.getElementById('back-to-decks-btn'); // New in HTML update

    // 2. Initial Load
    // Only proceed if critical elements are found (like inputs)
    if (!deckNameInput || !qInput || !aInput || !deckNavList) {
        console.error("FATAL: Essential input or navigation elements are missing from the HTML.");
        return;
    }
    initLoadDeck();

    // 3. Deck Metadata listeners (trigger API save on change)
    if (deckNameInput) deckNameInput.addEventListener('input', () => saveDeckToApi(false));
    if (subjectInput) subjectInput.addEventListener('input', () => saveDeckToApi(false));

    // 4. Card Input listeners: automatically save the current card on input change
    if (qInput) qInput.addEventListener('input', saveCurrentCard);
    if (aInput) aInput.addEventListener('input', saveCurrentCard);
    
    // 5. Manual Save Deck listener 
    if (saveDeckBtn) saveDeckBtn.addEventListener('click', () => saveDeckToApi(true)); 

    // 6. Add Card listener (moves to new card mode)
    if (addCardBtn) {
        addCardBtn.addEventListener('click', () => {
            // Ensure any unsaved data in the current editor is persisted before moving on
            saveCurrentCard(); 

            // Add a new empty card to the array
            flashcardDeck.push({ question: '', answer: '' });

            // Load the new card (which is now the last one)
            const newCardIndex = flashcardDeck.length - 1;
            loadCard(newCardIndex); 
            
            showFeedback('Ready to create a new card.', 'secondary');
        });
    }

    // 7. DECK Deletion Modal Handlers
    // Use defensive checks for optional buttons/modals
    if (deleteDeckBtn && deleteModal) {
        deleteDeckBtn.addEventListener('click', () => {
            deleteModal.style.display = 'flex'; // Show the custom confirmation modal
        });
    }

    if (cancelDeleteBtn && deleteModal) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none'; // Hide the modal
        });
    }

    if (confirmDeleteBtn && deleteModal) {
        confirmDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none'; // Hide the modal immediately
            if (currentDeckId) {
                deleteDeckFromApi(currentDeckId);
            }
        });
    }

    // 8. Back button
    if (backToDecksBtn) {
        backToDecksBtn.addEventListener('click', () => {
            window.location.href = '/allDecks';
        });
    }
});