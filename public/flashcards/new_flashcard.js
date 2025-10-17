// Global array to hold all the flashcard data
let flashcardDeck = []; 
let currentCardIndex = -1; // -1 means no card is selected/new card mode

// Get DOM elements
const deckNameInput = document.getElementById('deck-name-input');
const subjectInput = document.getElementById('subject-input');
const qInput = document.getElementById('question-input');
const aInput = document.getElementById('answer-input');

const addCardBtn = document.getElementById('add-card-btn'); // "+ New Card" button
const saveDeckBtn = document.getElementById('save-deck-btn'); // Save Icon (💾)
// Note: settings and delete are placeholders in the HTML for now

const deckListContainer = document.getElementById('deck-list'); // Container for the card buttons
const cardCount = document.getElementById('card-count');
const messageArea = document.getElementById('message-area');

// --- Helper Functions ---

function clearEditor() {
    qInput.value = '';
    aInput.value = '';
    currentCardIndex = -1;
    qInput.placeholder = '+ question (New Card)';
    aInput.placeholder = '+ answer (New Card)';
}

function saveCurrentCard() {
    const question = qInput.value.trim();
    const answer = aInput.value.trim();

    if (!question || !answer) {
        // If question or answer are empty, only proceed if we were editing a card 
        // and cleared it, otherwise prompt the user.
        if (question === '' && answer === '') {
            return; // Allow clearing
        }
        // Instead of alert, we'll update the message area
        messageArea.textContent = "Please fill out both the question and answer fields.";
        return false;
    }
    
    // Create/Update the card object
    const newCard = {
        question: question,
        answer: answer
    };

    if (currentCardIndex === -1) {
        // This is a NEW CARD
        flashcardDeck.push(newCard);
    } else {
        // This is an EXISTING CARD being edited
        flashcardDeck[currentCardIndex] = newCard;
    }
    
    messageArea.textContent = 'Card saved/updated locally.';
    return true;
}

function renderDeckList() {
    deckListContainer.innerHTML = ''; // Clear the current list
    
    flashcardDeck.forEach((card, index) => {
        const button = document.createElement('button');
        button.className = 'card-list-item';
        
        // --- CHANGE START ---
        // Display the question preview, truncating if necessary
        const questionPreview = card.question.length > 30 
            ? card.question.substring(0, 30) + '...' 
            : card.question || `Card ${index + 1} (No Question)`; // Fallback text
            
        button.textContent = questionPreview;
        // --- CHANGE END ---
        
        button.dataset.index = index;

        // Add click handler to select and load card for editing
        button.addEventListener('click', () => {
            selectCardForEditing(index);
        });

        deckListContainer.appendChild(button);
    });
    cardCount.textContent = flashcardDeck.length;
}

function selectCardForEditing(index) {
    if (index >= 0 && index < flashcardDeck.length) {
        // 1. Save any pending changes to the current card first
        saveCurrentCard(); 

        // 2. Load the new card
        currentCardIndex = index;
        const card = flashcardDeck[index];
        qInput.value = card.question;
        aInput.value = card.answer;
        qInput.placeholder = 'Editing Card ' + (index + 1) + ' Question';
        aInput.placeholder = 'Editing Card ' + (index + 1) + ' Answer';
        
        messageArea.textContent = `Editing Card ${index + 1}.`;
        renderDeckList(); // Re-render to highlight selected card if we add active class later
    }
}


// --- Event Handlers ---

// 1. "+ New Card" button handler
addCardBtn.addEventListener('click', () => {
    // 1. First, save any pending changes on the card currently being edited
    saveCurrentCard();
    
    // 2. Clear the editor and set state to new card mode
    clearEditor();
    renderDeckList(); // Update the list display
});

// 2. Save Deck Button (💾 icon) handler
saveDeckBtn.addEventListener('click', async () => {
    // 1. Save any final changes in the editor
    if (saveCurrentCard() === false) {
        return; // Stop if the current card failed validation
    }

    if (flashcardDeck.length === 0) {
        messageArea.textContent = 'Please add at least one card before saving.';
        return;
    }

    const deckName = deckNameInput.value.trim() || 'Untitled Deck';
    const deckSubject = subjectInput.value.trim() || 'General';

    // Combine metadata and card data for submission
    const submissionData = {
        name: deckName,
        subject: deckSubject,
        cards: flashcardDeck
    };

    messageArea.textContent = 'Saving deck...';
    
    try {
        // Send the complete deck data as JSON to the Express server
        // Note: We are assuming your Express server is configured to accept POST at '/api/decks' 
        const response = await fetch('/api/decks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submissionData)
        });

        const result = await response.json();

        if (response.ok) {
            // Successful save to the backend
            messageArea.textContent = `Success! Deck "${deckName}" saved with ID: ${result.deckId || 'N/A'}`;
            // Optional: Redirect the user to a view page or reset the form
            // window.location.href = '/'; 
            
        } else {
            // Error response from the Express server
            messageArea.textContent = `Error: ${result.message || 'Failed to save deck.'}`;
        }
    } catch (error) {
        // Network or fetch error
        console.error('Submission Error:', error);
        messageArea.textContent = 'Network error. Could not connect to the server.';
    }
});

// Initialize by clearing the editor (though the default state is already new card)
clearEditor();
