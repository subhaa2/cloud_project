// Global state
let flashcardDeck = []; 
let currentCardIndex = -1; // -1 means no card is selected/new card mode
let currentDeckId = null; 
// --- FIX: Using the correct, consistent storage key across all files ---
const STORAGE_KEY = 'auraLearnDecks'; 

// DOM elements (declared here, assigned on window.load)
let deckNameInput, subjectInput, qInput, aInput, deckListContainer, cardCount, messageArea, deleteDeckBtn, deleteModal;

// --- LOCAL STORAGE UTILITIES (CRUD) ---

/**
 * Loads all decks from localStorage.
 * @returns {Array} An array of deck objects.
 */
function loadAllDecks() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error reading all decks from localStorage:", e);
        return [];
    }
}

/**
 * Saves the entire list of decks back to localStorage.
 * @param {Array} decks - The complete array of deck objects.
 */
function saveAllDecks(decks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
        return true;
    } catch (e) {
        // This catch block often handles Quota Exceeded errors.
        console.error("Error saving all decks to localStorage:", e);
        return false;
    }
}

/**
 * Persists the current flashcardDeck object (metadata and cards) into the main decks array 
 * in localStorage and updates the 'lastEdited' timestamp.
 */
function persistCurrentDeck() {
    if (!currentDeckId) {
        console.error("Cannot persist deck: currentDeckId is null.");
        return false;
    }

    const allDecks = loadAllDecks();
    let deckIndex = allDecks.findIndex(deck => deck.id === currentDeckId);

    // Create the deck object with current editor data
    const deckToSave = {
        id: currentDeckId,
        // Use the current input values (which might be empty for a new, unsaved deck)
        name: deckNameInput.value.trim(),
        subject: subjectInput.value.trim(),
        lastEdited: Date.now(), // Update timestamp
        cards: flashcardDeck
    };

    // --- Logic to handle both NEW deck creation and EXISTING deck updates ---
    if (deckIndex === -1) {
        // Deck not found (NEW DECK), add it to the list
        allDecks.push(deckToSave);
    } else {
        // Deck found (EXISTING DECK), update the existing entry
        allDecks[deckIndex] = deckToSave;
    }

    // 2. Save the full list back to localStorage
    if (saveAllDecks(allDecks)) {
        // Success feedback is handled by the main saveDeck function
        return true;
    }
    return false;
}


// --- CORE LOGIC FUNCTIONS ---

function clearEditor() {
    qInput.value = '';
    aInput.value = '';
    currentCardIndex = -1;
    qInput.placeholder = '+ question (New Card)';
    aInput.placeholder = '+ answer (New Card)';
    // Highlight the "New Card" state in the sidebar if applicable
    updateSidebarSelection();
}

/**
 * Saves the contents of the Question/Answer editor to the current card in the deck array.
 * This function is called frequently on input changes.
 * @returns {boolean} True if a card was successfully saved/updated, false otherwise.
 */
function saveCurrentCard() {
    const question = qInput.value.trim();
    const answer = aInput.value.trim();

    // Do nothing if both are empty and we're in new card mode
    if (currentCardIndex === -1 && (!question && !answer)) {
        return false;
    }
    
    // Require both Q and A to be present for a valid card
    if (!question || !answer) {
        // Don't show an error here, just don't save the card to the deck array yet if it's new
        // and only partially filled.
        return false; 
    }

    if (currentCardIndex === -1) {
        // Create a new card and set the index
        currentCardIndex = flashcardDeck.length;
        flashcardDeck.push({
            id: crypto.randomUUID(),
            question: question,
            answer: answer
        });
        // After creating the card, we must update the sidebar to reflect the new card
        renderCardList(); 
        
    } else {
        // Update existing card
        flashcardDeck[currentCardIndex].question = question;
        flashcardDeck[currentCardIndex].answer = answer;
    }
    
    // Save the entire deck to persistence immediately after card change
    saveDeck(false); // Silent save
    
    return true;
}

/**
 * Updates the main card list in the sidebar.
 */
function renderCardList() {
    // ... (existing code for clearing and handling empty deck) ...
    deckListContainer.innerHTML = '';
    
    if (flashcardDeck.length === 0) {
        deckListContainer.innerHTML = '<p>No cards in this deck. Click "+ New Card" to begin!</p>';
        cardCount.textContent = '0 Cards';
        return;
    }

    flashcardDeck.forEach((card, index) => {
        // --- Card Container for Button and Text ---
        const containerDiv = document.createElement('div');
        containerDiv.className = 'card-preview-container';
        
        // 1. Card Preview Button (Text + Select)
        const button = document.createElement('button');
        button.className = 'card-preview-btn';
        if (index === currentCardIndex) {
            button.classList.add('active');
        }
        
        // FIX IS HERE: Use index + 1 if the question is empty
        const previewText = card.question.substring(0, 40) || `Card ${index + 1} (No Question)`;
        button.textContent = previewText;
        
        button.addEventListener('click', () => selectCard(index));
        
        containerDiv.appendChild(button);
        
        // 2. Delete Card Button (Icon)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-card-btn';
        deleteBtn.title = `Delete Card: ${previewText}`;
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
            </svg>
        `;
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (window.confirm(`Are you sure you want to delete this card: "${previewText}"?`)) {
                deleteCard(card.id);
            }
        });

        containerDiv.appendChild(deleteBtn);
        deckListContainer.appendChild(containerDiv);
    });
    
    cardCount.textContent = `${flashcardDeck.length} Card${flashcardDeck.length !== 1 ? 's' : ''}`;
}

/**
 * Highlights the currently selected card in the sidebar.
 */
function updateSidebarSelection() {
    const cardButtons = deckListContainer.querySelectorAll('.card-list-item');
    cardButtons.forEach((btn, index) => {
        btn.classList.toggle('selected', index === currentCardIndex);
    });
    // Ensure the "New Card" button isn't highlighted if a card is selected, 
    // though it doesn't have a 'selected' class currently, this is good practice.
}


/**
 * Loads the selected card's content into the editor.
 * @param {number} index - The index of the card to select.
 */
function selectCard(index) {
    // 1. Ensure any changes to the PREVIOUS card are saved first
    saveCurrentCard(); 
    
    // 2. Update global state
    currentCardIndex = index;
    
    // 3. Load the data into the editor
    const card = flashcardDeck[index];
    qInput.value = card.question;
    aInput.value = card.answer;
    
    
    const allCardButtons = deckListContainer.querySelectorAll('.card-preview-btn');
    
    // a. Remove 'active' class from ALL buttons
    allCardButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // b. Find the button corresponding to the selected card
    // Note: Since the buttons are rebuilt on save/render, we need a way to reference the correct button.
    // The safest way is to re-render the list, which will automatically apply the 'active' class
    // based on the updated `currentCardIndex`.

    // Instead of manipulating the DOM here (which can be error-prone after deletion/reordering), 
    // the cleanest approach is to simply **re-render the entire card list**.
    
    renderCardList(); 
    
    // Set focus to the question input for immediate editing
    qInput.focus();
}
/**
 * Main function to save the entire deck to persistence.
 * @param {boolean} showSuccessMessage - Whether to display a success message to the user.
 */
function saveDeck(showSuccessMessage = true) {
    // 1. Check for basic requirements
    if (!currentDeckId) {
        messageArea.textContent = 'Error: Deck ID is missing. Cannot save.';
        return;
    }
    
    // 2. Perform persistence
    if (showSuccessMessage) {
        messageArea.textContent = 'Saving deck...';
    }

    if (persistCurrentDeck()) {
        if (showSuccessMessage) {
             // 3. Display success message
             messageArea.textContent = `Success! Deck "${deckNameInput.value || 'Untitled'}" saved successfully.`;
        } else {
             // Clear message area for silent saves
             messageArea.textContent = '';
        }
    } else {
        messageArea.textContent = 'Failed to save deck to local storage.';
    }
}

/**
 * Handles the deck deletion process.
 */
function deleteDeck() {
    const allDecks = loadAllDecks();
    const deckIndex = allDecks.findIndex(deck => deck.id === currentDeckId);

    if (deckIndex > -1) {
        allDecks.splice(deckIndex, 1);
        if (saveAllDecks(allDecks)) {
            messageArea.textContent = `Deck "${deckNameInput.value}" deleted successfully. Redirecting...`;
            // Redirect to the deck list view after successful deletion
            setTimeout(() => {
                window.location.href = '/allDecks'; 
            }, 1000);
            return;
        }
    }
    messageArea.textContent = 'Error: Could not delete deck.';
}

/**
 * Deletes a card from the current deck and re-saves the deck.
 * @param {string} cardId - The unique ID of the card to delete.
 */
function deleteCard(cardId) {
    if (!currentDeckId || !flashcardDeck) {
        displayMessage('Cannot delete card: No deck selected.', 'error');
        return;
    }
    
    // 1. Filter out the card to be deleted
    const initialLength = flashcardDeck.length;
    flashcardDeck = flashcardDeck.filter(card => card.id !== cardId);

    if (flashcardDeck.length === initialLength) {
        displayMessage('Card not found for deletion.', 'error');
        return;
    }
    
    // 2. Clear editor if the card being deleted was the one currently open
    if (currentCardIndex !== -1 && flashcardDeck[currentCardIndex]?.id !== cardId) {
        // Find the index of the next card to select after deletion
        const newIndex = Math.min(currentCardIndex, flashcardDeck.length - 1);
        
        if (newIndex >= 0) {
            // Select the new card at the index
            selectCard(newIndex); 
        } else {
            // If the deck is now empty, switch to 'New Card' mode
            clearEditor();
        }
    } else {
         // If the deleted card was not the selected one, maintain selection
         // If currentCardIndex refers to a position past the new array length, select the last card
         if (currentCardIndex >= flashcardDeck.length) {
             currentCardIndex = Math.max(0, flashcardDeck.length - 1);
         }
         
         if (flashcardDeck.length === 0) {
             clearEditor();
         }
    }


    // 3. Save the modified deck
    if (saveDeck(true)) {
        displayMessage('Card deleted successfully.', 'success');
        renderCardList(); // Re-render the sidebar
    } else {
        displayMessage('Error saving deck after card deletion.', 'error');
    }
}


/**
 * Initializes the page by reading the deckId from the URL and loading the corresponding deck.
 */
function initializeDeck() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('deckId');
    
    const allDecks = loadAllDecks();
    let deck = null;

    if (id) {
        deck = allDecks.find(d => d.id === id);
    }

    if (deck) {
        // Load existing deck
        currentDeckId = deck.id;
        deckNameInput.value = deck.name;
        subjectInput.value = deck.subject;
        flashcardDeck = deck.cards;
        deleteDeckBtn.style.display = 'block'; // Show delete button for existing decks

        // Automatically select the first card if it exists, otherwise stay in new card mode
        if (flashcardDeck.length > 0) {
            selectCard(0);
        } else {
            clearEditor();
        }
        
    } else {
        // Initialize a new deck (if no ID was provided or ID was invalid)
        currentDeckId = crypto.randomUUID();
        // --- FIX: Removing default values. Inputs now rely on HTML placeholders. ---
        deckNameInput.value = '';
        subjectInput.value = '';
        flashcardDeck = [];
        deleteDeckBtn.style.display = 'none'; // Hide delete button for new decks
        clearEditor();
        // Since this is a new deck, we immediately save the initial structure
        saveDeck(false); 
    }
    
    // Render the sidebar regardless of whether the deck is new or existing
    renderCardList();
}


// --- EVENT LISTENERS & INITIALIZATION ---
window.onload = () => {
    // 1. Get DOM elements
    deckNameInput = document.getElementById('deck-name-input');
    subjectInput = document.getElementById('subject-input');
    qInput = document.getElementById('question-input');
    aInput = document.getElementById('answer-input');

    const addCardBtn = document.getElementById('add-card-btn');
    const saveDeckBtn = document.getElementById('save-deck-btn'); 
    
    deckListContainer = document.getElementById('deck-list'); 
    cardCount = document.getElementById('card-count');
    messageArea = document.getElementById('message-area');
    deleteDeckBtn = document.getElementById('delete-deck-btn');
    
    // Modal elements
    deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    
    // 2. Deck Metadata listeners (trigger save on change)
    deckNameInput.addEventListener('input', () => saveDeck(false));
    subjectInput.addEventListener('input', () => saveDeck(false));

    // 3. Card Input listeners: automatically save the current card on input change
    qInput.addEventListener('input', saveCurrentCard);
    aInput.addEventListener('input', saveCurrentCard);
    
    // 4. Manual Save Deck listener (for users who prefer clicking the button)
    saveDeckBtn.addEventListener('click', () => saveDeck(true)); 

    // 5. Add Card listener (moves to new card mode)
    addCardBtn.addEventListener('click', () => {
        saveCurrentCard(); // Ensure any unsaved data is persisted
        clearEditor();
    });

    // 6. DECK Deletion Modal Handlers
    deleteDeckBtn.addEventListener('click', () => {
        deleteModal.style.display = 'flex'; // Show the custom confirmation modal
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none'; // Hide the modal
    });

    confirmDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        deleteDeck();
    });

    // 7. Start the initialization process
    initializeDeck();
};
